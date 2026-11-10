import type { Condition } from "./schema";
import type { SessionState } from "./state";

/** Avalia uma condição contra o estado. Interpretador fechado: sem `eval`, sem efeitos. */
export function evaluate(condition: Condition | undefined, state: SessionState): boolean {
  if (!condition) return true;
  if ("always" in condition) return true;
  if ("all" in condition) return condition.all.every((c) => evaluate(c, state));
  if ("any" in condition) return condition.any.some((c) => evaluate(c, state));
  if ("not" in condition) return !evaluate(condition.not, state);
  if ("flag" in condition) return state.flags.includes(condition.flag);
  if ("puzzleSolved" in condition) return condition.puzzleSolved in state.solved;
  if ("chapterReached" in condition) return state.chaptersReached.includes(condition.chapterReached);
  if ("evidenceSeen" in condition) {
    const { id, by } = condition.evidenceSeen;
    const a = state.seen.A.includes(id);
    const b = state.seen.B.includes(id);
    if (by === "A") return a;
    if (by === "B") return b;
    if (by === "both") return a && b;
    return a || b;
  }
  if ("decisionMade" in condition) {
    const made = state.decisions[condition.decisionMade.id]?.resolved;
    if (!made) return false;
    return condition.decisionMade.option === undefined || made === condition.decisionMade.option;
  }
  const exhaustive: never = condition;
  throw new Error(`condição desconhecida: ${JSON.stringify(exhaustive)}`);
}

/** Lista todas as referências feitas por uma condição (usado pelo validador). */
export function conditionRefs(condition: Condition | undefined): {
  flags: string[];
  puzzles: string[];
  chapters: string[];
  evidence: string[];
  decisions: { id: string; option?: string }[];
} {
  const refs = {
    flags: [] as string[],
    puzzles: [] as string[],
    chapters: [] as string[],
    evidence: [] as string[],
    decisions: [] as { id: string; option?: string }[],
  };
  const walk = (c: Condition | undefined) => {
    if (!c || "always" in c) return;
    if ("all" in c) return c.all.forEach(walk);
    if ("any" in c) return c.any.forEach(walk);
    if ("not" in c) return walk(c.not);
    if ("flag" in c) return void refs.flags.push(c.flag);
    if ("puzzleSolved" in c) return void refs.puzzles.push(c.puzzleSolved);
    if ("chapterReached" in c) return void refs.chapters.push(c.chapterReached);
    if ("evidenceSeen" in c) return void refs.evidence.push(c.evidenceSeen.id);
    if ("decisionMade" in c) return void refs.decisions.push(c.decisionMade);
  };
  walk(condition);
  return refs;
}
