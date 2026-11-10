import type { CaseDefinition, Question } from "./schema";
import type { TheoryAnswers, VerdictRecord } from "./state";

/**
 * Nota de uma pergunta (0–1).
 * - single: 1 se acertou, 0 caso contrário.
 * - multiple: (acertos − erros) / total de corretas, limitado a [0, 1].
 *   Marcar tudo não compensa: cada opção errada desconta.
 */
export function scoreQuestion(question: Question, picked: readonly string[]): number {
  const correct = new Set(question.correct);
  const unique = [...new Set(picked)];
  if (question.kind === "single") return unique.length === 1 && correct.has(unique[0]!) ? 1 : 0;
  const hits = unique.filter((p) => correct.has(p)).length;
  const misses = unique.length - hits;
  return Math.max(0, Math.min(1, (hits - misses) / correct.size));
}

export function gradeTheory(def: CaseDefinition, answers: TheoryAnswers, at: string): VerdictRecord {
  const perQuestion: Record<string, number> = {};
  let total = 0;
  let max = 0;
  for (const q of def.theory.questions) {
    const s = scoreQuestion(q, answers[q.id] ?? []);
    perQuestion[q.id] = s;
    total += s * q.weight;
    max += q.weight;
  }
  const score = Math.round((total / max) * 100);
  const verdict = [...def.theory.verdicts].sort((a, b) => b.minScore - a.minScore).find((v) => score >= v.minScore);
  return { at, score, verdictId: verdict?.id ?? "archived", answers, perQuestion };
}

/** Valida o formato das respostas contra as perguntas (ids e quantidade). */
export function validateTheoryAnswers(def: CaseDefinition, answers: TheoryAnswers): boolean {
  const questions = new Map(def.theory.questions.map((q) => [q.id, q]));
  if (Object.keys(answers).some((k) => !questions.has(k))) return false;
  for (const q of def.theory.questions) {
    const picked = answers[q.id];
    if (!picked || picked.length === 0) return false;
    const options = new Set(q.options.map((o) => o.id));
    if (!picked.every((p) => options.has(p))) return false;
    if (q.kind === "single" && picked.length !== 1) return false;
    if (new Set(picked).size !== picked.length) return false;
  }
  return true;
}
