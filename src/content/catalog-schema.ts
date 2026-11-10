import { z } from "zod";

/** Capas disponíveis (ilustrações SVG em `components/case/case-cover.tsx`). */
export const COVER_KEYS = ["train", "house", "phone", "folder"] as const;
export type CoverKey = (typeof COVER_KEYS)[number];

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

const slug = z.string().regex(/^[a-z0-9-]{2,40}$/, "use letras minúsculas, números e hífen");

export const catalogCaseSchema = z
  .object({
    id: slug,
    code: z.string().regex(/^\d{3}$/),
    title: z.string().min(2).max(80),
    synopsis: z.string().min(2).max(600),
    category: z.string().min(2).max(40),
    difficulty: z.enum(DIFFICULTIES),
    duration: z
      .object({ min: z.number().int().positive(), max: z.number().int().positive() })
      .refine((d) => d.max >= d.min, "duration.max deve ser >= duration.min")
      .optional(),
    cover: z.enum(COVER_KEYS),
    unlockRequires: z.array(slug).default([]),
  })
  .strict();

export const seasonCatalogSchema = z
  .object({
    id: slug,
    number: z.number().int().positive(),
    title: z.string().min(2).max(80),
    tagline: z.string().max(140).optional(),
    cases: z.array(catalogCaseSchema).min(1),
  })
  .strict()
  .superRefine((season, ctx) => {
    const ids = new Set<string>();
    const codes = new Set<string>();
    for (const [i, c] of season.cases.entries()) {
      if (ids.has(c.id)) ctx.addIssue({ code: "custom", path: ["cases", i, "id"], message: `id duplicado: ${c.id}` });
      if (codes.has(c.code)) ctx.addIssue({ code: "custom", path: ["cases", i, "code"], message: `código duplicado: ${c.code}` });
      ids.add(c.id);
      codes.add(c.code);
    }
  });

export type SeasonCatalog = z.infer<typeof seasonCatalogSchema>;
export type CatalogCase = z.infer<typeof catalogCaseSchema>;

/**
 * Valida referências entre temporadas: requisitos devem existir e não podem formar ciclos.
 * Retorna a lista de problemas (vazia = válido).
 */
export function validateCatalogReferences(seasons: readonly SeasonCatalog[]): string[] {
  const all = new Map<string, CatalogCase>();
  const problems: string[] = [];
  for (const season of seasons) {
    for (const c of season.cases) {
      if (all.has(c.id)) problems.push(`caso ${c.id} aparece em mais de uma temporada`);
      all.set(c.id, c);
    }
  }
  for (const c of all.values()) {
    for (const req of c.unlockRequires) {
      if (!all.has(req)) problems.push(`${c.id} exige ${req}, que não existe`);
      if (req === c.id) problems.push(`${c.id} exige a si mesmo`);
    }
  }
  // Detecção de ciclo por DFS.
  const state = new Map<string, "visiting" | "done">();
  const visit = (id: string, path: string[]) => {
    if (state.get(id) === "done") return;
    if (state.get(id) === "visiting") {
      problems.push(`ciclo de desbloqueio: ${[...path, id].join(" → ")}`);
      return;
    }
    state.set(id, "visiting");
    for (const req of all.get(id)?.unlockRequires ?? []) visit(req, [...path, id]);
    state.set(id, "done");
  };
  for (const id of all.keys()) visit(id, []);
  return [...new Set(problems)];
}
