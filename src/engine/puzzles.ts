import { z } from "zod";
import type { Puzzle } from "./schema";

/** Formato da resposta enviada pelo cliente, por tipo de enigma. */
export const puzzleAnswerSchema = z.union([
  z.object({ code: z.string().max(64) }).strict(),
  z.object({ order: z.array(z.string().max(30)).max(30) }).strict(),
  z.object({ pairs: z.record(z.string().max(30), z.string().max(30)) }).strict(),
]);
export type PuzzleAnswer = z.infer<typeof puzzleAnswerSchema>;

/** Normaliza códigos: maiúsculas, sem acentos, sem espaços/pontuação. */
export function normalizeCode(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export type CheckResult =
  | { valid: false }
  | { valid: true; correct: boolean; /** Para sequência/correspondência: quantos itens estão certos. */ partial?: number };

/** Confere a resposta. `valid: false` = formato incompatível com o tipo (não conta tentativa). */
export function checkAnswer(puzzle: Puzzle, answer: PuzzleAnswer): CheckResult {
  switch (puzzle.type) {
    case "code": {
      if (!("code" in answer)) return { valid: false };
      const given = normalizeCode(answer.code);
      if (!given) return { valid: false };
      return { valid: true, correct: puzzle.answer.accepted.some((a) => normalizeCode(a) === given) };
    }
    case "sequence": {
      if (!("order" in answer)) return { valid: false };
      const expected = puzzle.answer.order;
      const ids = new Set(puzzle.items.map((i) => i.id));
      if (answer.order.length !== expected.length || new Set(answer.order).size !== expected.length) return { valid: false };
      if (!answer.order.every((id) => ids.has(id))) return { valid: false };
      const partial = expected.filter((id, i) => answer.order[i] === id).length;
      return { valid: true, correct: partial === expected.length, partial };
    }
    case "match": {
      if (!("pairs" in answer)) return { valid: false };
      const left = puzzle.left.map((l) => l.id);
      const options = new Set(puzzle.options.map((o) => o.id));
      if (!left.every((l) => typeof answer.pairs[l] === "string" && options.has(answer.pairs[l]!))) return { valid: false };
      const partial = left.filter((l) => answer.pairs[l] === puzzle.answer.pairs[l]).length;
      return { valid: true, correct: partial === left.length, partial };
    }
  }
}

/** Resposta correta no formato do cliente (usada pelo simulador e testes). */
export function solutionOf(puzzle: Puzzle): PuzzleAnswer {
  switch (puzzle.type) {
    case "code":
      return { code: puzzle.answer.accepted[0]! };
    case "sequence":
      return { order: [...puzzle.answer.order] };
    case "match":
      return { pairs: { ...puzzle.answer.pairs } };
  }
}
