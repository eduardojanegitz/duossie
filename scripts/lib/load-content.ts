import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import {
  seasonCatalogSchema,
  validateCatalogReferences,
  type SeasonCatalog,
} from "../../src/content/catalog-schema";

export const CONTENT_DIR = join(process.cwd(), "content");

/** Lê e valida todos os arquivos `content/seasons/*.yaml`. */
export function loadSeasonCatalogs(dir = join(CONTENT_DIR, "seasons")) {
  const seasons: SeasonCatalog[] = [];
  const problems: string[] = [];

  for (const file of readdirSync(dir).filter((f) => f.endsWith(".yaml")).sort()) {
    const raw: unknown = parse(readFileSync(join(dir, file), "utf8"));
    const parsed = seasonCatalogSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        problems.push(`${file}: ${issue.path.join(".") || "(raiz)"} — ${issue.message}`);
      }
      continue;
    }
    seasons.push(parsed.data);
  }
  problems.push(...validateCatalogReferences(seasons));
  return { seasons, problems };
}
