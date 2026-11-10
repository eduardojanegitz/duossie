import { describe, expect, it } from "vitest";
import { miniCase } from "@/engine/fixtures";
import { reduce } from "@/engine/reducer";
import { initialState } from "@/engine/state";
import { simulateSolution } from "@/engine/validator";
import { evaluateAchievements } from "./achievements";

const def = miniCase();
const NOW = "2026-01-01T00:00:00.000Z";

describe("conquistas", () => {
  it("nada antes de concluir", () => {
    expect(evaluateAchievements(def, initialState(def), { boardLinks: 9 })).toEqual([]);
  });

  it("partida ideal (simulador) ganha as conquistas de mérito", () => {
    const state = simulateSolution(def).finalState!;
    const earned = evaluateAchievements(def, state, { boardLinks: 0 });
    expect(earned).toEqual(expect.arrayContaining(["primeiro-arquivo", "caso-encerrado", "sem-dicas", "de-primeira", "olhos-atentos"]));
    // O simulador resolve tudo com o papel A: sem "dupla completa"; sem conexões: sem "quadro montado".
    expect(earned).not.toContain("dupla-completa");
    expect(earned).not.toContain("quadro-montado");
    expect(evaluateAchievements(def, state, { boardLinks: 3 })).toContain("quadro-montado");
  });

  it("dica e erro tiram as conquistas correspondentes", () => {
    let s = initialState(def);
    const step = (role: "A" | "B", action: Parameters<typeof reduce>[3]) => {
      const r = reduce(def, s, role, action, NOW);
      if (!r.ok) throw new Error(r.error);
      s = r.state;
    };
    step("A", { type: "request_hint", puzzleId: "pz.cofre" });
    step("A", { type: "attempt_puzzle", puzzleId: "pz.cofre", answer: { code: "00" } });
    step("A", { type: "attempt_puzzle", puzzleId: "pz.cofre", answer: { code: "42" } });
    step("B", { type: "attempt_puzzle", puzzleId: "pz.fila", answer: { order: ["a", "b", "c"] } });
    step("A", { type: "propose_theory", answers: { "q.quem": ["y"], "q.provas": ["p3"] } });
    step("B", { type: "confirm_theory" });
    const earned = evaluateAchievements(def, s, { boardLinks: 0 });
    expect(earned).toContain("primeiro-arquivo");
    expect(earned).toContain("dupla-completa");
    expect(earned).not.toContain("sem-dicas");
    expect(earned).not.toContain("de-primeira");
    expect(earned).not.toContain("caso-encerrado");
  });
});
