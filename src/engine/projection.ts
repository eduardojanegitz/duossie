import { evidenceAccessible, isSharedWith, progressOf, puzzleAvailable, theoryAvailable } from "./availability";
import { evaluate } from "./conditions";
import type { Block, CaseDefinition, Role } from "./schema";
import { normalizeState, otherRole, type FeedEntry, type SessionState, type TheoryAnswers, type VerdictRecord } from "./state";

/**
 * Tudo que um jogador pode saber, e nada além disso.
 * É o ÚNICO formato de dados do caso que sai do servidor para o navegador.
 */
export type PlayerView = {
  caseId: string;
  caseTitle: string;
  role: Role;
  roleInfo: { name: string; tagline: string; briefing: string };
  partnerRoleName: string;
  status: SessionState["status"];
  progress: number;
  intro: string;
  chapter: { id: string; title: string; intro: string; index: number; total: number };
  chapters: { id: string; title: string; intro: string }[];
  evidence: EvidenceView[];
  puzzles: PuzzleView[];
  decisions: DecisionView[];
  feed: FeedView[];
  theory: TheoryView;
};

export type EvidenceView = {
  id: string;
  title: string;
  kind: string;
  summary: string;
  body: Block[];
  /** `own`: do papel; `shared`: enviada pelo parceiro; `common`: dos dois. */
  origin: "own" | "shared" | "common";
  seen: boolean;
  canShare: boolean;
  sharedByMe: boolean;
};

type PuzzleBaseView = {
  id: string;
  title: string;
  prompt: string;
  solved: boolean;
  solvedBy: Role | null;
  solvedText: string | null;
  attempts: number;
  hints: string[];
  hintsRemaining: number;
};

export type PuzzleView = PuzzleBaseView &
  (
    | { type: "code"; inputLabel: string }
    | { type: "sequence"; items: { id: string; label: string }[]; solution: string[] | null }
    | { type: "match"; left: { id: string; label: string }[]; options: { id: string; label: string }[]; solution: Record<string, string> | null }
    | {
        type: "contradiction";
        /** Só as afirmações do próprio papel. */
        statements: { id: string; source: string; label: string; inconsistent: boolean | null }[];
        myPart: string[] | null;
        partnerSubmitted: boolean;
      }
    | { type: "mechanism"; controls: { id: string; label: string }[]; progress: number; total: number }
  );

export type DecisionView = {
  id: string;
  kind: "individual" | "joint";
  title: string;
  prompt: string;
  options: { id: string; label: string }[];
  myVote: string | null;
  /** Só em decisões conjuntas: o voto do parceiro fica visível para a discussão. */
  partnerVote: string | null;
  resolved: { optionId: string; outcome: string } | null;
};

export type FeedView = Omit<FeedEntry, "to"> & { label: string };

export type TheoryView =
  | { available: false }
  | {
      available: true;
      intro: string;
      questions: { id: string; prompt: string; kind: "single" | "multiple"; options: { id: string; label: string }[] }[];
      draft: TheoryAnswers | null;
      proposedBy: Role | null;
      confirmedByMe: boolean;
      verdicts: VerdictRecord[];
      /** Só existe depois do envio oficial: solução e epílogo. */
      resolution: {
        verdict: { id: string; title: string; text: string; score: number };
        canReopen: boolean;
        answerKey: { id: string; correct: string[]; explanation: string }[];
        summary: string;
        overlooked: string[];
        epilogue: string;
      } | null;
    };

export function projectView(def: CaseDefinition, rawState: SessionState, role: Role): PlayerView {
  const state = normalizeState(rawState);
  const chapterIndex = def.chapters.findIndex((c) => c.id === state.chapter);
  const chapter = def.chapters[chapterIndex] ?? def.chapters[0]!;

  const evidence: EvidenceView[] = def.evidence
    .filter((ev) => evidenceAccessible(ev, state, role))
    .map((ev) => {
      const sharedByMe = state.shared.some((s) => s.evidenceId === ev.id && s.by === role);
      return {
        id: ev.id,
        title: ev.title,
        kind: ev.kind,
        summary: ev.summary,
        body: ev.body,
        origin: ev.visibleTo === "both" ? "common" : isSharedWith(ev, state, role) ? "shared" : "own",
        seen: state.seen[role].includes(ev.id),
        canShare: ev.visibleTo === role && ev.share === "full" && !sharedByMe && state.status === "active",
        sharedByMe,
      };
    });

  const puzzles: PuzzleView[] = def.puzzles
    .filter((p) => puzzleAvailable(p, state))
    .map((p) => {
      const solved = state.solved[p.id];
      const used = state.hints[p.id]?.[role] ?? 0;
      const base: PuzzleBaseView = {
        id: p.id,
        title: p.title,
        prompt: p.prompt[role],
        solved: Boolean(solved),
        solvedBy: solved?.by ?? null,
        solvedText: solved ? p.solvedText : null,
        attempts: state.attempts[p.id] ?? 0,
        hints: p.hints[role].slice(0, used).map((h) => h.text),
        hintsRemaining: solved ? 0 : p.hints[role].length - used,
      };
      if (p.type === "code") return { ...base, type: "code", inputLabel: p.inputLabel };
      if (p.type === "sequence") {
        return { ...base, type: "sequence", items: p.items, solution: solved ? p.answer.order : null };
      }
      if (p.type === "match") {
        return { ...base, type: "match", left: p.left, options: p.options, solution: solved ? p.answer.pairs : null };
      }
      if (p.type === "contradiction") {
        const wrong = new Set(p.answer.inconsistent);
        const parts = state.parts[p.id] ?? {};
        return {
          ...base,
          type: "contradiction",
          statements: p.statements
            .filter((st) => st.visibleTo === role)
            .map((st) => ({ id: st.id, source: st.source, label: st.label, inconsistent: solved ? wrong.has(st.id) : null })),
          myPart: parts[role] ?? null,
          partnerSubmitted: Boolean(parts[otherRole(role)]),
        };
      }
      return {
        ...base,
        type: "mechanism",
        controls: p.controls[role],
        progress: solved ? p.answer.steps.length : (state.mechanisms[p.id] ?? 0),
        total: p.answer.steps.length,
      };
    });

  const decisions: DecisionView[] = def.decisions
    .filter((d) => (d.kind === "joint" || d.role === role) && (evaluate(d.availableWhen, state) || state.decisions[d.id]?.resolved))
    .map((d) => {
      const record = state.decisions[d.id];
      const resolvedOption = record?.resolved ? d.options.find((o) => o.id === record.resolved) : undefined;
      return {
        id: d.id,
        kind: d.kind,
        title: d.title,
        prompt: d.prompt,
        options: d.options.map((o) => ({ id: o.id, label: o.label })),
        myVote: record?.votes[role] ?? null,
        partnerVote: d.kind === "joint" ? (record?.votes[otherRole(role)] ?? null) : null,
        resolved: resolvedOption ? { optionId: resolvedOption.id, outcome: resolvedOption.outcome } : null,
      };
    });

  const titles = new Map<string, string>([
    ...def.evidence.map((e) => [e.id, e.title] as const),
    ...def.puzzles.map((p) => [p.id, p.title] as const),
    ...def.chapters.map((c) => [c.id, c.title] as const),
    ...def.decisions.map((d) => [d.id, d.title] as const),
  ]);

  const feed: FeedView[] = state.feed
    .filter((f) => f.to === "both" || f.to === role)
    .map((f) => ({ seq: f.seq, at: f.at, kind: f.kind, text: f.text, ref: f.ref, by: f.by, label: feedLabel(f, titles, role) }));

  return {
    caseId: def.id,
    caseTitle: def.title,
    role,
    roleInfo: def.roles[role],
    partnerRoleName: def.roles[otherRole(role)].name,
    status: state.status,
    progress: progressOf(def, state),
    intro: def.intro,
    chapter: { id: chapter.id, title: chapter.title, intro: chapter.intro, index: Math.max(0, chapterIndex) + 1, total: def.chapters.length },
    chapters: def.chapters.filter((c) => state.chaptersReached.includes(c.id)),
    evidence,
    puzzles,
    decisions,
    feed,
    theory: projectTheory(def, state, role),
  };
}

function feedLabel(f: Omit<FeedEntry, "to">, titles: Map<string, string>, role: Role): string {
  const who = f.by === undefined ? "" : f.by === role ? "Você" : "Seu parceiro";
  switch (f.kind) {
    case "chapter":
      return `Novo capítulo: ${titles.get(f.ref ?? "") ?? ""}`;
    case "shared":
      return `${who} compartilhou: ${titles.get(f.ref ?? "") ?? "evidência"}`;
    case "solved":
      return `${who} resolveu: ${titles.get(f.ref ?? "") ?? "enigma"}`;
    case "puzzle":
      return f.by === undefined ? (f.text ?? "") : `${who} ${f.text ?? ""} em: ${titles.get(f.ref ?? "") ?? "enigma"}`;
    case "decision":
      return f.by === undefined
        ? `${titles.get(f.ref ?? "") ?? "Decisão"}: ${f.text ?? ""}`
        : `${who} ${f.text ?? ""} em: ${titles.get(f.ref ?? "") ?? "decisão"}`;
    case "theory":
    case "notice":
      return f.text ?? "";
  }
}

function projectTheory(def: CaseDefinition, state: SessionState, role: Role): TheoryView {
  if (!theoryAvailable(def, state) && state.theory.verdicts.length === 0) return { available: false };
  const latest = state.theory.verdicts.at(-1);
  const best = state.theory.verdicts.reduce<VerdictRecord | null>((b, v) => (!b || v.score > b.score ? v : b), null);
  const verdictDef = latest ? def.theory.verdicts.find((v) => v.id === latest.verdictId) : undefined;

  return {
    available: true,
    intro: def.theory.intro,
    questions: def.theory.questions.map((q) => ({ id: q.id, prompt: q.prompt, kind: q.kind, options: q.options })),
    draft: state.theory.draft,
    proposedBy: state.theory.proposedBy,
    confirmedByMe: state.theory.confirmedBy.includes(role),
    verdicts: state.theory.verdicts,
    resolution:
      latest && verdictDef && state.status === "completed"
        ? {
            verdict: { id: verdictDef.id, title: verdictDef.title, text: verdictDef.text, score: latest.score },
            canReopen: (best?.score ?? 0) < 100,
            answerKey: def.theory.questions.map((q) => ({ id: q.id, correct: q.correct, explanation: q.explanation })),
            summary: def.resolution.summary,
            overlooked: def.resolution.overlooked,
            epilogue: def.resolution.epilogue,
          }
        : null,
  };
}
