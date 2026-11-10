/**
 * Motor do Duossie: regras puras, sem React, sem banco, sem I/O.
 * O servidor carrega a definição + estado, chama `reduce` e grava o resultado;
 * o cliente só recebe `PlayerView` (via `projectView`).
 */
export * from "./schema";
export * from "./state";
export { evaluate } from "./conditions";
export { checkAnswer, normalizeCode, puzzleAnswerSchema, type PuzzleAnswer } from "./puzzles";
export { gameActionSchema, reduce, type ActionError, type ActionOutcome, type GameAction, type ReduceResult } from "./reducer";
export { projectView, type EvidenceView, type FeedView, type PlayerView, type PuzzleView, type TheoryView } from "./projection";
export { progressOf } from "./availability";
export { scoreQuestion, gradeTheory } from "./theory";
export { simulateSolution, validateCase, type ValidationReport } from "./validator";
