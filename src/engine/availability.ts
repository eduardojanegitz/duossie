import { evaluate } from "./conditions";
import type { CaseDefinition, Evidence, Puzzle, Role } from "./schema";
import type { SessionState } from "./state";

/** A evidência está liberada pelo andamento do caso (independe de quem vê). */
export function evidenceUnlocked(ev: Evidence, state: SessionState): boolean {
  return evaluate(ev.availableWhen, state);
}

/** O papel tem acesso à evidência: é dele (ou de ambos) e está liberada, ou o parceiro compartilhou. */
export function evidenceAccessible(ev: Evidence, state: SessionState, role: Role): boolean {
  const own = (ev.visibleTo === role || ev.visibleTo === "both") && evidenceUnlocked(ev, state);
  return own || isSharedWith(ev, state, role);
}

export function isSharedWith(ev: Evidence, state: SessionState, role: Role): boolean {
  return ev.visibleTo !== role && ev.visibleTo !== "both" && state.shared.some((s) => s.evidenceId === ev.id && s.by !== role);
}

export function puzzleAvailable(puzzle: Puzzle, state: SessionState): boolean {
  return evaluate(puzzle.availableWhen, state);
}

export function theoryAvailable(def: CaseDefinition, state: SessionState): boolean {
  return evaluate(def.theory.availableWhen, state);
}

/** Progresso (0–100): enigmas resolvidos + relatório final. */
export function progressOf(def: CaseDefinition, state: SessionState): number {
  const steps = def.puzzles.length + 1;
  const done = Object.keys(state.solved).length + (state.status === "completed" ? 1 : 0);
  return Math.round((done / steps) * 100);
}
