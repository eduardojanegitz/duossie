/**
 * ⚠️ Este arquivo usa as respostas do Caso 001 (lidas do conteúdo, não escritas aqui).
 * Ele não imprime conteúdo; só verifica regras.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { solutionOf } from "@/engine/puzzles";
import type { CaseDefinition } from "@/engine/schema";
import type { Viewer } from "@/server/auth/viewer";
import type { Database } from "@/server/supabase/database.types";
import { GameError, getPlayerView, performAction, startInvestigation } from "@/server/game/service";
import { loadCases } from "../../scripts/lib/load-content";
import { adminClient, deleteTestUsers, signInAs, TEST_EMAILS } from "../support/supabase";

type Client = SupabaseClient<Database>;
type Player = { client: Client; userId: string; viewer: Viewer };

const def: CaseDefinition = loadCases().cases.find((c) => c.definition.id === "case-001")!.definition;

function viewerFor(userId: string, duo: Viewer["duo"]): Viewer {
  return { userId, email: null, profile: { id: userId, codename: "x" }, duo };
}

describe("investigação do Caso 001", () => {
  let a: Player;
  let b: Player;
  let c: Player;
  let sessionId: string;

  beforeAll(async () => {
    await deleteTestUsers();
    const [sa, sb, sc] = await Promise.all([signInAs(TEST_EMAILS.a), signInAs(TEST_EMAILS.b), signInAs(TEST_EMAILS.c)]);
    const { data: duoId } = await sa.client.rpc("create_duo", { p_name: "Unidade Noturna" });
    const { data: invite } = await sa.client.rpc("create_duo_invite");
    await sb.client.rpc("join_duo", { p_code: invite![0]!.code });
    const duo = {
      id: duoId!,
      name: "Unidade Noturna",
      members: [
        { id: sa.userId, codename: "Corvo" },
        { id: sb.userId, codename: "Lince" },
      ],
    };
    a = { ...sa, viewer: viewerFor(sa.userId, duo) };
    b = { ...sb, viewer: viewerFor(sb.userId, duo) };
    c = { ...sc, viewer: viewerFor(sc.userId, null) };
    // Garante que o catálogo e a versão publicada existem (npm run content:import).
    const { data } = await adminClient().from("cases").select("is_playable").eq("id", "case-001").single();
    if (!data?.is_playable) throw new Error("Rode `npm run content:import` antes dos testes de integração.");
  });

  afterAll(async () => {
    await deleteTestUsers();
  });

  it("abre a investigação: quem abre escolhe o papel, o parceiro fica com o outro", async () => {
    sessionId = await startInvestigation(a.viewer, "case-001", "A");
    const { data } = await a.client.from("session_players").select("user_id, role").eq("session_id", sessionId);
    expect(data?.find((p) => p.user_id === a.userId)?.role).toBe("A");
    expect(data?.find((p) => p.user_id === b.userId)?.role).toBe("B");
    await expect(startInvestigation(b.viewer, "case-001", "B")).rejects.toThrow(new GameError("already_started"));
  });

  it("casos bloqueados não podem ser abertos", async () => {
    await expect(startInvestigation(a.viewer, "case-002", "A")).rejects.toBeInstanceOf(GameError);
  });

  it("o cliente não lê o estado bruto, as versões nem o log", async () => {
    const state = await a.client.from("case_sessions").select("state").eq("id", sessionId);
    expect(state.error).not.toBeNull();
    const meta = await a.client.from("case_sessions").select("id, status, progress").eq("id", sessionId).single();
    expect(meta.data).toMatchObject({ id: sessionId, status: "active" });
    for (const table of ["case_versions", "session_events", "session_actions"] as const) {
      const { data } = await a.client.from(table).select("*");
      expect(data ?? []).toHaveLength(0);
    }
  });

  it("terceiro não vê a sessão nem consegue a visão de um jogador", async () => {
    const { data } = await c.client.from("case_sessions").select("id");
    expect(data ?? []).toHaveLength(0);
    await expect(getPlayerView(c.viewer, sessionId)).rejects.toBeInstanceOf(GameError);
  });

  it("cada jogador recebe só as próprias evidências; nada do outro vaza na resposta", async () => {
    const [va, vb] = await Promise.all([getPlayerView(a.viewer, sessionId), getPlayerView(b.viewer, sessionId)]);
    const onlyA = def.evidence.filter((e) => e.visibleTo === "A");
    const onlyB = def.evidence.filter((e) => e.visibleTo === "B");
    const jsonA = JSON.stringify(va);
    const jsonB = JSON.stringify(vb);
    for (const e of onlyB) expect(jsonA).not.toContain(e.id);
    for (const e of onlyA) expect(jsonB).not.toContain(e.id);
    for (const p of def.puzzles) {
      expect(jsonA).not.toContain(p.prompt.B);
      expect(jsonB).not.toContain(p.prompt.A);
      if (p.type === "code") for (const ans of p.answer.accepted) expect(jsonA + jsonB).not.toContain(`"${ans}"`);
    }
    expect(jsonA + jsonB).not.toContain(def.resolution.epilogue);
  });

  it("não deixa ver evidência do outro papel pela ação", async () => {
    const foreign = def.evidence.find((e) => e.visibleTo === "B")!;
    await expect(performAction(a.viewer, sessionId, randomUUID(), { type: "view_evidence", evidenceId: foreign.id })).rejects.toThrow(
      new GameError("evidence_unavailable"),
    );
  });

  it("ação repetida com o mesmo id é aplicada uma única vez (idempotência)", async () => {
    const actionId = randomUUID();
    const ev = def.evidence.find((e) => e.visibleTo === "both")!;
    const before = await adminClient().from("case_sessions").select("state_version").eq("id", sessionId).single();
    const first = await performAction(a.viewer, sessionId, actionId, { type: "view_evidence", evidenceId: ev.id });
    const second = await performAction(a.viewer, sessionId, actionId, { type: "share_evidence", evidenceId: ev.id }).catch((e) => e);
    const after = await adminClient().from("case_sessions").select("state_version").eq("id", sessionId).single();
    expect(first.duplicate).toBe(false);
    // A segunda chamada falha na validação (não compartilhável) ou é ignorada — nunca aplica nada.
    expect(second instanceof GameError || second.duplicate === true).toBe(true);
    expect(after.data!.state_version).toBe(before.data!.state_version + 1);
  });

  it("ações simultâneas dos dois jogadores não se perdem (concorrência otimista)", async () => {
    const evA = def.evidence.filter((e) => e.visibleTo === "A" && !e.availableWhen).map((e) => e.id);
    const evB = def.evidence.filter((e) => e.visibleTo === "B" && !e.availableWhen).map((e) => e.id);
    await Promise.all([
      ...evA.map((id) => performAction(a.viewer, sessionId, randomUUID(), { type: "view_evidence", evidenceId: id })),
      ...evB.map((id) => performAction(b.viewer, sessionId, randomUUID(), { type: "view_evidence", evidenceId: id })),
    ]);
    const [va, vb] = await Promise.all([getPlayerView(a.viewer, sessionId), getPlayerView(b.viewer, sessionId)]);
    expect(evA.every((id) => va.evidence.find((e) => e.id === id)?.seen)).toBe(true);
    expect(evB.every((id) => vb.evidence.find((e) => e.id === id)?.seen)).toBe(true);
  });

  it("o parceiro recebe o sinal de atualização pelo canal da dupla", async () => {
    await b.client.realtime.setAuth();
    const channel = b.client.channel(`duo:${a.viewer.duo!.id}`, { config: { private: true } });
    const received = new Promise<{ sessionId: string; version: number }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("sinal não chegou")), 10_000);
      channel.on("broadcast", { event: "session_updated" }, (m) => {
        clearTimeout(timer);
        resolve(m.payload as { sessionId: string; version: number });
      });
    });
    await new Promise<void>((resolve) => channel.subscribe((s) => s === "SUBSCRIBED" && resolve()));
    const wrong = def.puzzles[0]!;
    await performAction(a.viewer, sessionId, randomUUID(), {
      type: "request_hint",
      puzzleId: wrong.id,
    });
    const payload = await received;
    expect(payload.sessionId).toBe(sessionId);
    // O sinal não carrega conteúdo do jogo (o Realtime acrescenta só um `id` de mensagem).
    expect(Object.keys(payload).filter((k) => k !== "id").sort()).toEqual(["sessionId", "version"]);
    await b.client.removeChannel(channel);
  });

  it("os enigmas só são resolvidos com a resposta certa e liberam o próximo capítulo", async () => {
    for (const [i, p] of def.puzzles.entries()) {
      const actor = i % 2 === 0 ? b : a;
      if (p.type === "code") {
        const wrong = await performAction(actor.viewer, sessionId, randomUUID(), { type: "attempt_puzzle", puzzleId: p.id, answer: { code: "0000" } });
        expect(wrong.outcome).toMatchObject({ kind: "puzzle", correct: false });
      }
      const right = await performAction(actor.viewer, sessionId, randomUUID(), { type: "attempt_puzzle", puzzleId: p.id, answer: solutionOf(p) });
      expect(right.outcome).toMatchObject({ kind: "puzzle", correct: true });
    }
    const vb = await getPlayerView(b.viewer, sessionId);
    expect(vb.chapter.index).toBe(def.chapters.length);
    expect(vb.theory.available).toBe(true);
  });

  it("o relatório exige os dois, é persistido e conclui o caso", async () => {
    const answers = Object.fromEntries(def.theory.questions.map((q) => [q.id, [...q.correct]]));
    await performAction(b.viewer, sessionId, randomUUID(), { type: "propose_theory", answers });
    await expect(performAction(b.viewer, sessionId, randomUUID(), { type: "confirm_theory" })).rejects.toThrow(new GameError("own_proposal"));
    const done = await performAction(a.viewer, sessionId, randomUUID(), { type: "confirm_theory" });
    expect(done.outcome).toEqual({ kind: "theory_submitted", score: 100, verdictId: "closed" });

    const { data } = await a.client.from("case_sessions").select("status, progress, completed_at").eq("id", sessionId).single();
    expect(data).toMatchObject({ status: "completed", progress: 100 });
    expect(data?.completed_at).not.toBeNull();

    // Reconexão: uma nova leitura traz a resolução para os dois.
    const [va, vb] = await Promise.all([getPlayerView(a.viewer, sessionId), getPlayerView(b.viewer, sessionId)]);
    for (const v of [va, vb]) {
      expect(v.status).toBe("completed");
      expect(v.theory.available && v.theory.resolution?.verdict.id).toBe("closed");
    }
  });

  it("concluir o caso libera o seguinte no catálogo (requisito cumprido)", async () => {
    // case-002 ainda não tem definição: continua indisponível, mas deixa de exigir o 001.
    await expect(startInvestigation(a.viewer, "case-002", "A")).rejects.toThrow(new GameError("not_playable"));
  });
});
