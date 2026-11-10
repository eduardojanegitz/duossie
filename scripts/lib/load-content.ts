import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import {
  seasonCatalogSchema,
  validateCatalogReferences,
  type SeasonCatalog,
} from "../../src/content/catalog-schema";
import type { CaseDefinition } from "../../src/engine/schema";
import { validateCase } from "../../src/engine/validator";

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

// ---------------------------------------------------------------------------
// Casos jogáveis: content/cases/<id>/{case,evidence,puzzles}.yaml
// ---------------------------------------------------------------------------

export type LoadedCase = {
  dir: string;
  definition: CaseDefinition;
  contentHash: string;
  warnings: string[];
};

function readYaml(path: string): unknown {
  return parse(readFileSync(path, "utf8"));
}

/** Hash estável do conteúdo validado (chaves ordenadas). */
export function contentHash(value: unknown): string {
  const canonical = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(canonical)
      : v && typeof v === "object"
        ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical((v as Record<string, unknown>)[k])]))
        : v;
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

export function loadCases(dir = join(CONTENT_DIR, "cases")) {
  const cases: LoadedCase[] = [];
  const problems: string[] = [];
  if (!existsSync(dir)) return { cases, problems };

  for (const name of readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    const base = join(dir, name);
    try {
      const root = readYaml(join(base, "case.yaml")) as Record<string, unknown>;
      const merged = {
        ...root,
        evidence: existsSync(join(base, "evidence.yaml")) ? readYaml(join(base, "evidence.yaml")) : root.evidence,
        puzzles: existsSync(join(base, "puzzles.yaml")) ? readYaml(join(base, "puzzles.yaml")) : root.puzzles,
      };
      const report = validateCase(merged);
      if (report.errors.length > 0 || !report.definition) {
        problems.push(...report.errors.map((e) => `${name}: ${e}`));
        continue;
      }
      if (report.definition.id !== name) problems.push(`${name}: o id do caso (${report.definition.id}) difere da pasta`);
      // Hash do conteúdo-FONTE (antes de defaults do schema): evoluir o motor não invalida versões publicadas.
      cases.push({ dir: base, definition: report.definition, contentHash: contentHash(merged), warnings: report.warnings });
    } catch (error) {
      problems.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { cases, problems };
}

/** Carrega catálogo + casos e confere se cada caso jogável existe no catálogo. */
export function loadAllContent() {
  const catalog = loadSeasonCatalogs();
  const loaded = loadCases();
  const problems = [...catalog.problems, ...loaded.problems];
  const catalogIds = new Set(catalog.seasons.flatMap((s) => s.cases.map((c) => c.id)));
  for (const c of loaded.cases) {
    if (!catalogIds.has(c.definition.id)) problems.push(`${c.definition.id}: não está em nenhum catálogo de temporada`);
  }
  return { seasons: catalog.seasons, cases: loaded.cases, problems };
}
