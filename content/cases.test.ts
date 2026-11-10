import { describe, expect, it } from "vitest";
import { projectView } from "@/engine/projection";
import { initialState } from "@/engine/state";
import { simulateSolution } from "@/engine/validator";
import { loadAllContent } from "../scripts/lib/load-content";

/**
 * Testes de coerência do conteúdo versionado. Não imprimem nada do conteúdo
 * (spoilers): só conferem estrutura, justiça e o caminho de solução.
 */
const { cases, problems } = loadAllContent();

describe("conteúdo dos casos", () => {
  it("todos os casos e catálogos são válidos", () => {
    expect(problems).toEqual([]);
    expect(cases.length).toBeGreaterThan(0);
  });

  for (const { definition: def } of cases) {
    describe(def.id, () => {
      it("o simulador conclui o caso com o veredito máximo", () => {
        const sim = simulateSolution(def);
        expect(sim.errors).toEqual([]);
        expect(sim.finalState?.status).toBe("completed");
      });

      it("tem pelo menos 3 enigmas cooperativos e carga equilibrada entre os papéis", () => {
        expect(def.puzzles.length).toBeGreaterThanOrEqual(3);
        const a = def.evidence.filter((e) => e.visibleTo === "A").length;
        const b = def.evidence.filter((e) => e.visibleTo === "B").length;
        expect(Math.abs(a - b)).toBeLessThanOrEqual(2);
      });

      it("a visão inicial de cada papel não contém evidência exclusiva do outro", () => {
        const s = initialState(def);
        for (const role of ["A", "B"] as const) {
          const other = role === "A" ? "B" : "A";
          const ids = projectView(def, s, role).evidence.map((e) => e.id);
          const foreign = def.evidence.filter((e) => e.visibleTo === other).map((e) => e.id);
          expect(ids.filter((id) => foreign.includes(id))).toEqual([]);
        }
      });

      it("nenhuma visão expõe respostas de enigmas ou o gabarito antes do fim", () => {
        const s = initialState(def);
        for (const role of ["A", "B"] as const) {
          const json = JSON.stringify(projectView(def, s, role));
          for (const p of def.puzzles) {
            if (p.type === "code") for (const a of p.answer.accepted) expect(json).not.toContain(`"${a}"`);
          }
          for (const q of def.theory.questions) expect(json).not.toContain(q.explanation);
          expect(json).not.toContain(def.resolution.epilogue);
        }
      });
    });
  }
});
