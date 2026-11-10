import type { CaseDefinition, Role } from "./schema";

export type FeedEntry = {
  seq: number;
  at: string;
  /** Destinatário: um papel ou os dois. */
  to: Role | "both";
  kind: "notice" | "chapter" | "shared" | "solved" | "theory";
  text?: string;
  /** Referência (evidência, enigma, capítulo) quando aplicável. */
  ref?: string;
  by?: Role;
};

export type TheoryAnswers = Record<string, string[]>;

export type VerdictRecord = {
  at: string;
  score: number;
  verdictId: "closed" | "partial" | "archived";
  answers: TheoryAnswers;
  perQuestion: Record<string, number>;
};

/** Estado persistido de uma investigação (snapshot em `case_sessions.state`). */
export type SessionState = {
  engine: 1;
  status: "active" | "completed";
  chapter: string;
  chaptersReached: string[];
  flags: string[];
  seen: Record<Role, string[]>;
  shared: { evidenceId: string; by: Role; at: string }[];
  solved: Record<string, { by: Role; at: string }>;
  attempts: Record<string, number>;
  hints: Record<string, Record<Role, number>>;
  firedEvents: string[];
  feed: FeedEntry[];
  theory: {
    draft: TheoryAnswers | null;
    proposedBy: Role | null;
    confirmedBy: Role[];
    verdicts: VerdictRecord[];
  };
};

export function initialState(def: CaseDefinition): SessionState {
  const first = def.chapters[0]!;
  return {
    engine: 1,
    status: "active",
    chapter: first.id,
    chaptersReached: [first.id],
    flags: [],
    seen: { A: [], B: [] },
    shared: [],
    solved: {},
    attempts: {},
    hints: {},
    firedEvents: [],
    feed: [],
    theory: { draft: null, proposedBy: null, confirmedBy: [], verdicts: [] },
  };
}

export function otherRole(role: Role): Role {
  return role === "A" ? "B" : "A";
}
