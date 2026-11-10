/**
 * Relatório de playtest a partir do log de eventos (sem spoilers: enigmas são numerados).
 *   npm run playtest:report               → todas as investigações
 *   npm run playtest:report -- <sessionId> → uma investigação
 *
 * Mede o que importa para a diversão: duração, tempo entre enigmas, tentativas, dicas,
 * tempo ocioso de cada papel (alguém ficou esperando?) e volume de conversa.
 */
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/server/supabase/database.types";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});

type Event = { state_version: number; type: string; payload: { role?: "A" | "B"; outcome?: Record<string, unknown> }; created_at: string; action_id: string | null };

const minutes = (ms: number) => `${(ms / 60000).toFixed(1)} min`;

async function report(sessionId: string) {
  const [{ data: session }, { data: events }, { data: messages }, { data: board }, { data: versions }] = await Promise.all([
    db.from("case_sessions").select("id, case_id, status, progress, started_at, completed_at, state, case_version_id").eq("id", sessionId).single(),
    db.from("session_events").select("state_version, type, payload, created_at, action_id").eq("session_id", sessionId).order("state_version"),
    db.from("session_messages").select("author_id, kind, created_at").eq("session_id", sessionId),
    db.from("board_items").select("author_id, kind").eq("session_id", sessionId),
    db.from("session_players").select("user_id, role").eq("session_id", sessionId),
  ]);
  if (!session) return console.log(`Sessão ${sessionId} não encontrada.`);
  const ev = (events ?? []) as unknown as Event[];
  const roleOf = new Map((versions ?? []).map((p) => [p.user_id, p.role]));
  const start = new Date(session.started_at).getTime();
  const end = session.completed_at ? new Date(session.completed_at).getTime() : new Date(ev.at(-1)?.created_at ?? session.started_at).getTime();

  console.log(`\n═══ ${session.case_id} · sessão ${session.id.slice(0, 8)} · ${session.status} (${session.progress}%)`);
  console.log(`Duração: ${minutes(end - start)}${session.completed_at ? "" : " (em andamento)"}`);

  // Enigmas: tempo desde o enigma anterior (ou início), tentativas e dicas.
  let last = start;
  let index = 0;
  const attempts = new Map<string, number>();
  const hints = { A: 0, B: 0 };
  for (const e of ev) {
    const t = new Date(e.created_at).getTime();
    const o = e.payload?.outcome ?? {};
    if (e.type === "request_hint" && e.payload.role) hints[e.payload.role]++;
    if (e.type === "attempt_puzzle" || e.type === "operate_mechanism") {
      const key = `p${index + 1}`;
      attempts.set(key, (attempts.get(key) ?? 0) + 1);
      const solved = (o.kind === "puzzle" && o.correct === true) || (o.kind === "mechanism" && o.solved === true);
      if (solved) {
        index++;
        console.log(`  Enigma ${index}: ${minutes(t - last)} · ${attempts.get(key)} ação(ões) até resolver · por ${e.payload.role}`);
        last = t;
      }
    }
    if (e.type === "confirm_theory" && o.kind === "theory_submitted") {
      console.log(`  Relatório: ${minutes(t - last)} depois do último enigma · nota ${String(o.score)} (${String(o.verdictId)})`);
    }
  }
  console.log(`Dicas: A=${hints.A} · B=${hints.B}`);

  // Ociosidade: maior intervalo sem ação de cada papel (com o parceiro agindo no meio).
  for (const role of ["A", "B"] as const) {
    const times = ev.filter((e) => e.payload?.role === role).map((e) => new Date(e.created_at).getTime());
    const all = [start, ...times, end];
    let gap = 0;
    for (let i = 1; i < all.length; i++) gap = Math.max(gap, all[i]! - all[i - 1]!);
    const actions = times.length;
    console.log(`Papel ${role}: ${actions} ações · maior pausa ${minutes(gap)}${gap > 3 * 60000 ? "  ⚠️ possível ociosidade" : ""}`);
  }

  const byRole = (rows: { author_id: string }[] | null) => {
    const c = { A: 0, B: 0 };
    for (const r of rows ?? []) {
      const role = roleOf.get(r.author_id);
      if (role) c[role]++;
    }
    return c;
  };
  const msgs = byRole(messages);
  const items = byRole(board);
  console.log(`Chat: A=${msgs.A} · B=${msgs.B} mensagens · pedidos de ajuda: ${(messages ?? []).filter((m) => m.kind === "help").length}`);
  console.log(`Quadro: A=${items.A} · B=${items.B} itens`);
}

async function main() {
  const only = process.argv[2];
  if (only) return report(only);
  const { data } = await db.from("case_sessions").select("id").order("started_at");
  if (!data?.length) return console.log("Nenhuma investigação registrada.");
  for (const s of data) await report(s.id);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
