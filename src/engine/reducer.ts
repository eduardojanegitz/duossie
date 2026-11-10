import { z } from "zod";
import { evidenceAccessible, puzzleAvailable, theoryAvailable } from "./availability";
import { evaluate } from "./conditions";
import { checkAnswer, puzzleAnswerSchema } from "./puzzles";
import type { CaseDefinition, Effect, Role } from "./schema";
import { normalizeState, otherRole, type FeedEntry, type SessionState } from "./state";
import { gradeTheory, validateTheoryAnswers } from "./theory";

/** Ações que um jogador pode enviar. Validadas no servidor antes de chegar ao motor. */
export const gameActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("view_evidence"), evidenceId: z.string().max(60) }).strict(),
  z.object({ type: z.literal("share_evidence"), evidenceId: z.string().max(60) }).strict(),
  z.object({ type: z.literal("attempt_puzzle"), puzzleId: z.string().max(60), answer: puzzleAnswerSchema }).strict(),
  z.object({ type: z.literal("request_hint"), puzzleId: z.string().max(60) }).strict(),
  z.object({ type: z.literal("operate_mechanism"), puzzleId: z.string().max(60), control: z.string().max(30) }).strict(),
  z.object({ type: z.literal("vote_decision"), decisionId: z.string().max(60), optionId: z.string().max(30) }).strict(),
  z
    .object({
      type: z.literal("propose_theory"),
      answers: z.record(z.string().max(60), z.array(z.string().max(30)).max(20)),
    })
    .strict(),
  z.object({ type: z.literal("confirm_theory") }).strict(),
  z.object({ type: z.literal("withdraw_theory") }).strict(),
  z.object({ type: z.literal("reopen_theory") }).strict(),
]);
export type GameAction = z.infer<typeof gameActionSchema>;

export type ActionError =
  | "case_completed"
  | "unknown_evidence"
  | "evidence_unavailable"
  | "not_shareable"
  | "already_shared"
  | "unknown_puzzle"
  | "puzzle_unavailable"
  | "already_solved"
  | "invalid_answer"
  | "no_more_hints"
  | "theory_unavailable"
  | "invalid_theory"
  | "no_proposal"
  | "own_proposal"
  | "already_confirmed"
  | "cannot_reopen"
  | "not_your_control"
  | "unknown_decision"
  | "decision_unavailable"
  | "decision_resolved"
  | "invalid_option";

/** Resultado visível para quem agiu (ex.: "errou", "acertou 3 de 5"). */
export type ActionOutcome =
  | { kind: "none" }
  | { kind: "puzzle"; correct: boolean; partial?: number; total?: number }
  | { kind: "hint"; index: number }
  | { kind: "theory_submitted"; score: number; verdictId: string }
  | { kind: "part_submitted" }
  | { kind: "mechanism"; ok: boolean; progress: number; total: number; solved: boolean }
  | { kind: "decision"; resolved: boolean };

export type ReduceResult =
  | { ok: true; state: SessionState; outcome: ActionOutcome; changed: boolean }
  | { ok: false; error: ActionError };

const MAX_SETTLE_ITERATIONS = 50;

/**
 * Função pura: aplica uma ação de um papel ao estado. Nunca muta o estado recebido.
 * `now` é injetado para tornar o motor determinístico em testes.
 */
export function reduce(
  def: CaseDefinition,
  current: SessionState,
  role: Role,
  action: GameAction,
  now: string,
): ReduceResult {
  const state: SessionState = normalizeState(structuredClone(current));
  const feed = (entry: Omit<FeedEntry, "seq" | "at">) =>
    state.feed.push({ ...entry, seq: (state.feed.at(-1)?.seq ?? 0) + 1, at: now });

  if (state.status === "completed" && action.type !== "view_evidence" && action.type !== "reopen_theory") {
    return { ok: false, error: "case_completed" };
  }

  let outcome: ActionOutcome = { kind: "none" };
  let changed = true;

  switch (action.type) {
    case "view_evidence": {
      const ev = def.evidence.find((e) => e.id === action.evidenceId);
      if (!ev) return { ok: false, error: "unknown_evidence" };
      if (!evidenceAccessible(ev, state, role)) return { ok: false, error: "evidence_unavailable" };
      if (state.seen[role].includes(ev.id)) {
        changed = false;
      } else {
        state.seen[role].push(ev.id);
      }
      break;
    }

    case "share_evidence": {
      const ev = def.evidence.find((e) => e.id === action.evidenceId);
      if (!ev) return { ok: false, error: "unknown_evidence" };
      if (ev.visibleTo !== role) return { ok: false, error: "not_shareable" };
      if (!evidenceAccessible(ev, state, role)) return { ok: false, error: "evidence_unavailable" };
      if (ev.share !== "full") return { ok: false, error: "not_shareable" };
      if (state.shared.some((s) => s.evidenceId === ev.id)) return { ok: false, error: "already_shared" };
      state.shared.push({ evidenceId: ev.id, by: role, at: now });
      feed({ to: otherRole(role), kind: "shared", ref: ev.id, by: role });
      break;
    }

    case "attempt_puzzle": {
      const puzzle = def.puzzles.find((p) => p.id === action.puzzleId);
      if (!puzzle) return { ok: false, error: "unknown_puzzle" };
      if (!puzzleAvailable(puzzle, state)) return { ok: false, error: "puzzle_unavailable" };
      if (puzzle.id in state.solved) return { ok: false, error: "already_solved" };

      if (puzzle.type === "mechanism") return { ok: false, error: "invalid_answer" };
      if (puzzle.type === "contradiction") {
        if (!("flags" in action.answer)) return { ok: false, error: "invalid_answer" };
        const mine = new Set(puzzle.statements.filter((st) => st.visibleTo === role).map((st) => st.id));
        const flags = [...new Set(action.answer.flags)];
        if (!flags.every((f) => mine.has(f))) return { ok: false, error: "invalid_answer" };
        const parts = (state.parts[puzzle.id] ??= {});
        parts[role] = flags;
        const other = parts[otherRole(role)];
        if (!other) {
          outcome = { kind: "part_submitted" };
          feed({ to: otherRole(role), kind: "puzzle", ref: puzzle.id, by: role, text: "enviou as marcações dele" });
          break;
        }
        // As duas partes chegaram: avaliação conjunta.
        const marked = new Set([...flags, ...other]);
        const wrong = new Set(puzzle.answer.inconsistent);
        const right = puzzle.statements.filter((st) => marked.has(st.id) === wrong.has(st.id)).length;
        const total = puzzle.statements.length;
        state.attempts[puzzle.id] = (state.attempts[puzzle.id] ?? 0) + 1;
        delete state.parts[puzzle.id];
        outcome = { kind: "puzzle", correct: right === total, partial: right, total };
        if (right === total) {
          state.solved[puzzle.id] = { by: role, at: now };
          feed({ to: "both", kind: "solved", ref: puzzle.id, by: role, text: puzzle.solvedText });
          applyEffects(puzzle.onSolve, state, feed);
        } else {
          feed({
            to: "both",
            kind: "puzzle",
            ref: puzzle.id,
            text: `As marcações não fecharam: ${right} de ${total} afirmações classificadas corretamente.`,
          });
        }
        break;
      }

      const check = checkAnswer(puzzle, action.answer);
      if (!check.valid) return { ok: false, error: "invalid_answer" };
      state.attempts[puzzle.id] = (state.attempts[puzzle.id] ?? 0) + 1;
      const total = puzzle.type === "sequence" ? puzzle.items.length : puzzle.type === "match" ? puzzle.left.length : undefined;
      outcome = { kind: "puzzle", correct: check.correct, partial: check.partial, total };
      if (check.correct) {
        state.solved[puzzle.id] = { by: role, at: now };
        feed({ to: "both", kind: "solved", ref: puzzle.id, by: role, text: puzzle.solvedText });
        applyEffects(puzzle.onSolve, state, feed);
      }
      break;
    }

    case "request_hint": {
      const puzzle = def.puzzles.find((p) => p.id === action.puzzleId);
      if (!puzzle) return { ok: false, error: "unknown_puzzle" };
      if (!puzzleAvailable(puzzle, state)) return { ok: false, error: "puzzle_unavailable" };
      if (puzzle.id in state.solved) return { ok: false, error: "already_solved" };
      const used = state.hints[puzzle.id]?.[role] ?? 0;
      if (used >= puzzle.hints[role].length) return { ok: false, error: "no_more_hints" };
      state.hints[puzzle.id] = { A: 0, B: 0, ...state.hints[puzzle.id], [role]: used + 1 };
      outcome = { kind: "hint", index: used };
      break;
    }

    case "operate_mechanism": {
      const puzzle = def.puzzles.find((p) => p.id === action.puzzleId);
      if (!puzzle) return { ok: false, error: "unknown_puzzle" };
      if (puzzle.type !== "mechanism") return { ok: false, error: "invalid_answer" };
      if (!puzzleAvailable(puzzle, state)) return { ok: false, error: "puzzle_unavailable" };
      if (puzzle.id in state.solved) return { ok: false, error: "already_solved" };
      if (!puzzle.controls[role].some((c) => c.id === action.control)) return { ok: false, error: "not_your_control" };
      const progress = state.mechanisms[puzzle.id] ?? 0;
      const expected = puzzle.answer.steps[progress]!;
      const total = puzzle.answer.steps.length;
      if (expected.role === role && expected.control === action.control) {
        state.mechanisms[puzzle.id] = progress + 1;
        const solved = progress + 1 === total;
        outcome = { kind: "mechanism", ok: true, progress: progress + 1, total, solved };
        if (solved) {
          state.solved[puzzle.id] = { by: role, at: now };
          delete state.mechanisms[puzzle.id];
          feed({ to: "both", kind: "solved", ref: puzzle.id, by: role, text: puzzle.solvedText });
          applyEffects(puzzle.onSolve, state, feed);
        }
      } else {
        state.mechanisms[puzzle.id] = 0;
        state.attempts[puzzle.id] = (state.attempts[puzzle.id] ?? 0) + 1;
        outcome = { kind: "mechanism", ok: false, progress: 0, total, solved: false };
        feed({ to: "both", kind: "puzzle", ref: puzzle.id, by: role, text: "travou o mecanismo — ele voltou ao início" });
      }
      break;
    }

    case "vote_decision": {
      const decision = def.decisions.find((d) => d.id === action.decisionId);
      if (!decision) return { ok: false, error: "unknown_decision" };
      if (decision.kind === "individual" && decision.role !== role) return { ok: false, error: "unknown_decision" };
      if (!evaluate(decision.availableWhen, state)) return { ok: false, error: "decision_unavailable" };
      const record = (state.decisions[decision.id] ??= { votes: {} });
      if (record.resolved) return { ok: false, error: "decision_resolved" };
      const option = decision.options.find((o) => o.id === action.optionId);
      if (!option) return { ok: false, error: "invalid_option" };
      if (record.votes[role] === option.id) {
        changed = false;
        break;
      }
      record.votes[role] = option.id;
      const agreed = decision.kind === "individual" || record.votes[otherRole(role)] === option.id;
      outcome = { kind: "decision", resolved: agreed };
      if (agreed) {
        record.resolved = option.id;
        record.at = now;
        feed({ to: decision.kind === "individual" ? role : "both", kind: "decision", ref: decision.id, text: option.outcome });
        applyEffects(option.effects, state, feed);
      } else {
        feed({ to: otherRole(role), kind: "decision", ref: decision.id, by: role, text: "votou" });
      }
      break;
    }

    case "propose_theory": {
      if (!theoryAvailable(def, state)) return { ok: false, error: "theory_unavailable" };
      if (!validateTheoryAnswers(def, action.answers)) return { ok: false, error: "invalid_theory" };
      state.theory.draft = action.answers;
      state.theory.proposedBy = role;
      state.theory.confirmedBy = [role];
      feed({ to: otherRole(role), kind: "theory", by: role, text: "Relatório final proposto. Revise e confirme." });
      break;
    }

    case "withdraw_theory": {
      if (!state.theory.draft) return { ok: false, error: "no_proposal" };
      state.theory.draft = null;
      state.theory.proposedBy = null;
      state.theory.confirmedBy = [];
      feed({ to: otherRole(role), kind: "theory", by: role, text: "O relatório voltou para revisão." });
      break;
    }

    case "confirm_theory": {
      const draft = state.theory.draft;
      if (!draft) return { ok: false, error: "no_proposal" };
      if (state.theory.confirmedBy.includes(role)) {
        return { ok: false, error: state.theory.proposedBy === role ? "own_proposal" : "already_confirmed" };
      }
      state.theory.confirmedBy.push(role);
      // Os dois confirmaram: avaliação oficial.
      const verdict = gradeTheory(def, draft, now);
      state.theory.verdicts.push(verdict);
      state.theory.draft = null;
      state.theory.proposedBy = null;
      state.theory.confirmedBy = [];
      state.status = "completed";
      feed({ to: "both", kind: "theory", text: "Relatório final enviado." });
      outcome = { kind: "theory_submitted", score: verdict.score, verdictId: verdict.verdictId };
      break;
    }

    case "reopen_theory": {
      const best = Math.max(0, ...state.theory.verdicts.map((v) => v.score));
      if (state.status !== "completed" || best >= 100) return { ok: false, error: "cannot_reopen" };
      state.status = "active";
      feed({ to: otherRole(role), kind: "theory", by: role, text: "A investigação foi reaberta para revisar o relatório." });
      break;
    }
  }

  if (changed) settle(def, state, feed);
  return { ok: true, state, outcome, changed };
}

function applyEffects(
  effects: readonly Effect[],
  state: SessionState,
  feed: (entry: Omit<FeedEntry, "seq" | "at">) => void,
) {
  for (const effect of effects) {
    if ("setFlag" in effect) {
      if (!state.flags.includes(effect.setFlag)) state.flags.push(effect.setFlag);
    } else if ("startChapter" in effect) {
      if (!state.chaptersReached.includes(effect.startChapter)) {
        state.chaptersReached.push(effect.startChapter);
        state.chapter = effect.startChapter;
        feed({ to: "both", kind: "chapter", ref: effect.startChapter });
      }
    } else if ("notify" in effect) {
      feed({ to: effect.notify.to, kind: "notice", text: effect.notify.text });
    }
  }
}

/** Dispara eventos automáticos cujas condições ficaram verdadeiras, até estabilizar. */
function settle(def: CaseDefinition, state: SessionState, feed: (entry: Omit<FeedEntry, "seq" | "at">) => void) {
  for (let i = 0; i < MAX_SETTLE_ITERATIONS; i++) {
    const next = def.events.find((e) => !state.firedEvents.includes(e.id) && evaluate(e.when, state));
    if (!next) return;
    state.firedEvents.push(next.id);
    applyEffects(next.effects, state, feed);
  }
  throw new Error("eventos não estabilizaram (possível laço na definição do caso)");
}
