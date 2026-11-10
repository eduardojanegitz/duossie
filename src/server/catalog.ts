import "server-only";
import { cache } from "react";
import type { CoverKey, Difficulty } from "@/content/catalog-schema";
import { caseStatus, type CaseStatus, type DuoProgress } from "@/lib/case-status";
import { createSupabaseServerClient } from "@/server/supabase/server";

export type CaseSummary = {
  id: string;
  code: string;
  title: string;
  synopsis: string;
  category: string;
  difficulty: Difficulty;
  durationMin: number | null;
  durationMax: number | null;
  puzzleCount: number | null;
  cover: CoverKey;
  unlockRequires: { id: string; code: string; title: string }[];
  status: CaseStatus;
  /** 0–100; `null` enquanto não há investigação iniciada. */
  progress: number | null;
};

export type SeasonSummary = {
  id: string;
  number: number;
  title: string;
  tagline: string | null;
  cases: CaseSummary[];
};

/**
 * Progresso da dupla. As sessões de investigação chegam na Fase 3; até lá nenhuma
 * dupla tem casos iniciados ou concluídos, e este é o valor real.
 */
async function getDuoProgress(): Promise<DuoProgress> {
  return { completed: new Set(), inProgress: new Set() };
}

/** Catálogo completo com a situação de cada caso para a dupla do jogador. */
export const getCatalog = cache(async (): Promise<SeasonSummary[]> => {
  const supabase = await createSupabaseServerClient();
  const [{ data: seasons, error: seasonsError }, { data: cases, error: casesError }, progress] = await Promise.all([
    supabase.from("seasons").select("id, number, title, tagline").order("number"),
    supabase
      .from("cases")
      .select(
        "id, season_id, code, title, synopsis, category, difficulty, duration_min, duration_max, puzzle_count, cover, unlock_requires, is_playable, sort_order",
      )
      .order("sort_order"),
    getDuoProgress(),
  ]);
  if (seasonsError) throw seasonsError;
  if (casesError) throw casesError;

  const byId = new Map((cases ?? []).map((c) => [c.id, c]));

  return (seasons ?? []).map((season) => ({
    id: season.id,
    number: season.number,
    title: season.title,
    tagline: season.tagline,
    cases: (cases ?? [])
      .filter((c) => c.season_id === season.id)
      .map((c): CaseSummary => {
        const status = caseStatus(
          { id: c.id, isPlayable: c.is_playable, unlockRequires: c.unlock_requires },
          progress,
        );
        return {
          id: c.id,
          code: c.code,
          title: c.title,
          synopsis: c.synopsis,
          category: c.category,
          difficulty: c.difficulty,
          durationMin: c.duration_min,
          durationMax: c.duration_max,
          puzzleCount: c.puzzle_count,
          cover: c.cover as CoverKey,
          unlockRequires: c.unlock_requires.map((id) => {
            const req = byId.get(id);
            return { id, code: req?.code ?? "???", title: req?.title ?? id };
          }),
          status,
          progress: null,
        };
      }),
  }));
});

export async function getCaseSummary(caseId: string) {
  const catalog = await getCatalog();
  for (const season of catalog) {
    const found = season.cases.find((c) => c.id === caseId);
    if (found) return { season, caseSummary: found };
  }
  return null;
}
