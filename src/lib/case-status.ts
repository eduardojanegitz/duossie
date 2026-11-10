/** Situação de um caso para uma dupla específica (regra pura, testável). */
export type CaseStatus = "locked" | "in_preparation" | "available" | "in_progress" | "completed";

export type CaseStatusInput = {
  id: string;
  isPlayable: boolean;
  unlockRequires: readonly string[];
};

export type DuoProgress = {
  completed: ReadonlySet<string>;
  inProgress: ReadonlySet<string>;
};

export function caseStatus(c: CaseStatusInput, progress: DuoProgress): CaseStatus {
  if (progress.completed.has(c.id)) return "completed";
  if (progress.inProgress.has(c.id)) return "in_progress";
  if (c.unlockRequires.some((req) => !progress.completed.has(req))) return "locked";
  if (!c.isPlayable) return "in_preparation";
  return "available";
}

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  locked: "Bloqueado",
  in_preparation: "Em preparação",
  available: "Disponível",
  in_progress: "Em andamento",
  completed: "Concluído",
};

export const DIFFICULTY_LABEL = { easy: "Leve", medium: "Moderada", hard: "Difícil" } as const;

export function formatDuration(min: number | null, max: number | null): string | null {
  if (!min) return null;
  if (!max || max === min) return `~${min} min`;
  return `${min}–${max} min`;
}
