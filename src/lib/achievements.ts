import { projectView } from "@/engine/projection";
import type { CaseDefinition } from "@/engine/schema";
import type { SessionState } from "@/engine/state";

/**
 * Conquistas da dupla (regra pura, testável). Premiam raciocínio e colaboração —
 * nenhuma depende de velocidade.
 */
export const ACHIEVEMENTS = [
  { id: "primeiro-arquivo", title: "Primeiro arquivo fechado", description: "Concluir uma investigação." },
  { id: "caso-encerrado", title: "Caso encerrado", description: "Chegar ao veredito máximo num caso." },
  { id: "sem-dicas", title: "Sem rodinhas", description: "Concluir um caso sem pedir nenhuma dica." },
  { id: "de-primeira", title: "De primeira", description: "Resolver todos os enigmas de um caso sem errar." },
  { id: "olhos-atentos", title: "Olhos atentos", description: "Os dois leram todas as evidências a que tinham acesso." },
  { id: "dupla-completa", title: "Dupla completa", description: "Cada um resolveu pelo menos um enigma do caso." },
  { id: "quadro-montado", title: "Quadro montado", description: "Fazer pelo menos 3 conexões no quadro de evidências." },
] as const;

export type AchievementId = (typeof ACHIEVEMENTS)[number]["id"];

export function evaluateAchievements(def: CaseDefinition, state: SessionState, extras: { boardLinks: number }): AchievementId[] {
  if (state.status !== "completed") return [];
  const earned: AchievementId[] = ["primeiro-arquivo"];

  if (state.theory.verdicts.some((v) => v.verdictId === "closed")) earned.push("caso-encerrado");

  const hints = Object.values(state.hints).reduce((n, h) => n + (h.A ?? 0) + (h.B ?? 0), 0);
  if (hints === 0) earned.push("sem-dicas");

  // Tentativa contada = avaliação; o mecanismo só conta falhas.
  const flawless = def.puzzles.every((p) => {
    const attempts = state.attempts[p.id] ?? 0;
    return p.type === "mechanism" ? attempts === 0 : attempts <= 1;
  });
  if (def.puzzles.length > 0 && flawless) earned.push("de-primeira");

  const readAll = (["A", "B"] as const).every((role) =>
    projectView(def, state, role).evidence.every((e) => e.seen),
  );
  if (readAll) earned.push("olhos-atentos");

  const solvers = new Set(Object.values(state.solved).map((s) => s.by));
  if (solvers.has("A") && solvers.has("B")) earned.push("dupla-completa");

  if (extras.boardLinks >= 3) earned.push("quadro-montado");
  return earned;
}

export function achievementInfo(id: string) {
  return ACHIEVEMENTS.find((a) => a.id === id) ?? null;
}
