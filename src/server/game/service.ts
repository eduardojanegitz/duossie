import "server-only";
import {
  caseDefinitionSchema,
  gameActionSchema,
  initialState,
  progressOf,
  projectView,
  reduce,
  type ActionError,
  type ActionOutcome,
  type CaseDefinition,
  type GameAction,
  type PlayerView,
  type Role,
  type SessionState,
} from "@/engine";
import { evaluateAchievements } from "@/lib/achievements";
import type { Viewer } from "@/server/auth/viewer";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import type { Json } from "@/server/supabase/database.types";

/**
 * Serviço de investigações. Toda leitura/escrita de definição e estado passa por aqui,
 * com o cliente admin (ignora RLS) — por isso cada função valida a dupla e o papel do
 * jogador ANTES de tocar nos dados.
 */

export class GameError extends Error {
  constructor(
    public readonly code: ActionError | "not_found" | "forbidden" | "not_playable" | "locked" | "already_started" | "conflict" | "rate_limited",
  ) {
    super(code);
  }
}

// Versões de caso são imutáveis: cache em memória por id de versão é seguro.
const definitionCache = new Map<string, CaseDefinition>();

async function loadDefinition(caseVersionId: string): Promise<CaseDefinition> {
  const cached = definitionCache.get(caseVersionId);
  if (cached) return cached;
  const db = createSupabaseAdminClient();
  const { data, error } = await db.from("case_versions").select("definition").eq("id", caseVersionId).single();
  if (error || !data) throw new GameError("not_found");
  const def = caseDefinitionSchema.parse(data.definition);
  definitionCache.set(caseVersionId, def);
  return def;
}

type SessionRow = {
  id: string;
  duo_id: string;
  case_id: string;
  case_version_id: string;
  status: "active" | "completed";
  state: SessionState;
  state_version: number;
};

export type PlayerContext = { session: SessionRow; role: Role; def: CaseDefinition; partnerId: string | null };

export async function loadContext(viewer: Viewer, sessionId: string): Promise<PlayerContext> {
  if (!viewer.duo) throw new GameError("forbidden");
  const db = createSupabaseAdminClient();
  const [{ data: session }, { data: players }] = await Promise.all([
    db
      .from("case_sessions")
      .select("id, duo_id, case_id, case_version_id, status, state, state_version")
      .eq("id", sessionId)
      .maybeSingle(),
    db.from("session_players").select("user_id, role").eq("session_id", sessionId),
  ]);
  // Mesmo erro para "não existe" e "não é sua": não revela a existência de sessões alheias.
  if (!session || session.duo_id !== viewer.duo.id) throw new GameError("not_found");
  const me = players?.find((p) => p.user_id === viewer.userId);
  if (!me) throw new GameError("forbidden");
  const def = await loadDefinition(session.case_version_id);
  return {
    session: session as unknown as SessionRow,
    role: me.role,
    def,
    partnerId: players?.find((p) => p.user_id !== viewer.userId)?.user_id ?? null,
  };
}

export async function getPlayerView(viewer: Viewer, sessionId: string): Promise<PlayerView & { sessionId: string; stateVersion: number }> {
  const ctx = await loadContext(viewer, sessionId);
  return { ...projectView(ctx.def, ctx.session.state, ctx.role), sessionId, stateVersion: ctx.session.state_version };
}

/** Sessão da dupla para um caso (se existir), sem estado. */
export async function findDuoSession(viewer: Viewer, caseId: string) {
  if (!viewer.duo) return null;
  const db = createSupabaseAdminClient();
  const { data } = await db
    .from("case_sessions")
    .select("id, status, progress, session_players(user_id, role)")
    .eq("duo_id", viewer.duo.id)
    .eq("case_id", caseId)
    .maybeSingle();
  return data;
}

/** Abre a investigação de um caso. Quem abre escolhe o papel; o parceiro fica com o outro. */
export async function startInvestigation(viewer: Viewer, caseId: string, role: Role): Promise<string> {
  const duo = viewer.duo;
  if (!duo || duo.members.length !== 2) throw new GameError("forbidden");
  const partner = duo.members.find((m) => m.id !== viewer.userId)!;
  const db = createSupabaseAdminClient();

  const { data: caseRow } = await db.from("cases").select("id, is_playable, unlock_requires").eq("id", caseId).maybeSingle();
  if (!caseRow) throw new GameError("not_found");
  if (!caseRow.is_playable) throw new GameError("not_playable");

  if (caseRow.unlock_requires.length > 0) {
    const { data: done } = await db
      .from("case_sessions")
      .select("case_id")
      .eq("duo_id", duo.id)
      .eq("status", "completed")
      .in("case_id", caseRow.unlock_requires);
    if ((done?.length ?? 0) < caseRow.unlock_requires.length) throw new GameError("locked");
  }

  const { data: version } = await db
    .from("case_versions")
    .select("id")
    .eq("case_id", caseId)
    .order("version", { ascending: false })
    .limit(1)
    .single();
  if (!version) throw new GameError("not_playable");
  const def = await loadDefinition(version.id);

  const { data: session, error } = await db
    .from("case_sessions")
    .insert({
      duo_id: duo.id,
      case_id: caseId,
      case_version_id: version.id,
      state: initialState(def) as unknown as Json & object,
      started_by: viewer.userId,
    })
    .select("id")
    .single();
  if (error?.code === "23505") throw new GameError("already_started");
  if (error || !session) throw error ?? new Error("falha ao criar sessão");

  const { error: playersError } = await db.from("session_players").insert([
    { session_id: session.id, user_id: viewer.userId, role },
    { session_id: session.id, user_id: partner.id, role: role === "A" ? "B" : "A" },
  ]);
  if (playersError) {
    await db.from("case_sessions").delete().eq("id", session.id);
    throw playersError;
  }

  await db.from("session_events").insert({
    session_id: session.id,
    state_version: 0,
    actor_id: viewer.userId,
    type: "session_started",
    payload: { role, version: def.version },
  });
  return session.id;
}

const MAX_RETRIES = 8;

const backoff = (attempt: number) => new Promise((r) => setTimeout(r, 15 * attempt + Math.random() * 40));

/**
 * Aplica uma ação do jogador: valida, roda o motor e grava de forma atômica.
 * - Idempotente: o mesmo `actionId` nunca é aplicado duas vezes.
 * - Concorrência otimista: se o parceiro gravou antes, recarrega e tenta de novo.
 */
export async function performAction(
  viewer: Viewer,
  sessionId: string,
  actionId: string,
  rawAction: unknown,
): Promise<{ outcome: ActionOutcome; duplicate: boolean }> {
  const action: GameAction = gameActionSchema.parse(rawAction);
  const db = createSupabaseAdminClient();

  if (action.type === "attempt_puzzle" || action.type === "request_hint") {
    const { data: allowed } = await db.rpc("consume_rate_limit", {
      p_key: `puzzle:${viewer.userId}:${sessionId}`,
      p_max: 30,
      p_window_seconds: 300,
    });
    if (allowed === false) throw new GameError("rate_limited");
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) await backoff(attempt);
    const ctx = await loadContext(viewer, sessionId);
    const result = reduce(ctx.def, ctx.session.state, ctx.role, action, new Date().toISOString());
    if (!result.ok) throw new GameError(result.error);
    if (!result.changed) return { outcome: result.outcome, duplicate: false };

    const { data, error } = await db.rpc("commit_session_transition", {
      p_session_id: sessionId,
      p_expected_version: ctx.session.state_version,
      p_actor_id: viewer.userId,
      p_action_id: actionId,
      p_action: action as unknown as Json,
      p_outcome: result.outcome as unknown as Json,
      p_state: result.state as unknown as Json,
      p_status: result.state.status,
      p_progress: progressOf(ctx.def, result.state),
      p_event_type: action.type,
      p_event_payload: { role: ctx.role, outcome: result.outcome } as unknown as Json,
    });

    if (error?.message === "version_conflict") continue;
    if (error) throw error;
    if (data === "duplicate") {
      const { data: previous } = await db
        .from("session_actions")
        .select("outcome")
        .eq("session_id", sessionId)
        .eq("action_id", actionId)
        .single();
      return { outcome: (previous?.outcome as ActionOutcome | undefined) ?? { kind: "none" }, duplicate: true };
    }
    if (result.state.status === "completed") await grantAchievements(ctx, result.state);
    return { outcome: result.outcome, duplicate: false };
  }
  throw new GameError("conflict");
}

/** Papéis do caso (sem spoilers) para a tela de abertura da investigação. */
export async function getCaseRoles(caseId: string) {
  const db = createSupabaseAdminClient();
  const { data: version } = await db
    .from("case_versions")
    .select("id")
    .eq("case_id", caseId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!version) return null;
  const def = await loadDefinition(version.id);
  return {
    A: { name: def.roles.A.name, tagline: def.roles.A.tagline, briefing: def.roles.A.briefing },
    B: { name: def.roles.B.name, tagline: def.roles.B.tagline, briefing: def.roles.B.briefing },
  };
}

/** Concede (uma vez por dupla) as conquistas obtidas ao concluir o caso. Nunca falha a ação. */
async function grantAchievements(ctx: PlayerContext, state: SessionState) {
  try {
    const db = createSupabaseAdminClient();
    const { count } = await db.from("board_links").select("id", { count: "exact", head: true }).eq("session_id", ctx.session.id);
    const earned = evaluateAchievements(ctx.def, state, { boardLinks: count ?? 0 });
    if (earned.length === 0) return;
    await db
      .from("duo_achievements")
      .upsert(
        earned.map((id) => ({ duo_id: ctx.session.duo_id, achievement_id: id, session_id: ctx.session.id })),
        { onConflict: "duo_id,achievement_id", ignoreDuplicates: true },
      );
  } catch (error) {
    console.error("[grantAchievements]", error instanceof Error ? error.message : error);
  }
}

export type HistoryEntry = {
  sessionId: string;
  caseId: string;
  startedAt: string;
  completedAt: string;
  minutes: number;
  hints: number;
  verdict: { id: string; title: string; score: number } | null;
};

/** Investigações concluídas da dupla, com o melhor veredito obtido. */
export async function getHistory(viewer: Viewer): Promise<HistoryEntry[]> {
  if (!viewer.duo) return [];
  const db = createSupabaseAdminClient();
  const { data } = await db
    .from("case_sessions")
    .select("id, case_id, case_version_id, started_at, completed_at, state")
    .eq("duo_id", viewer.duo.id)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false });
  const entries: HistoryEntry[] = [];
  for (const row of data ?? []) {
    const def = await loadDefinition(row.case_version_id);
    const state = row.state as unknown as SessionState;
    const best = (state.theory?.verdicts ?? []).reduce<SessionState["theory"]["verdicts"][number] | null>(
      (b, v) => (!b || v.score > b.score ? v : b),
      null,
    );
    const verdictDef = best ? def.theory.verdicts.find((v) => v.id === best.verdictId) : undefined;
    entries.push({
      sessionId: row.id,
      caseId: row.case_id,
      startedAt: row.started_at,
      completedAt: row.completed_at!,
      minutes: Math.max(1, Math.round((new Date(row.completed_at!).getTime() - new Date(row.started_at).getTime()) / 60000)),
      hints: Object.values(state.hints ?? {}).reduce((n, h) => n + (h.A ?? 0) + (h.B ?? 0), 0),
      verdict: best && verdictDef ? { id: best.verdictId, title: verdictDef.title, score: best.score } : null,
    });
  }
  return entries;
}
