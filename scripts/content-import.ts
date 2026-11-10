/**
 * Importa o conteúdo de `content/` para o banco (catálogo público de temporadas e casos).
 *   npm run content:import            → banco local (usa .env.local)
 *   npm run content:import -- --check → só valida, sem gravar
 *
 * Para produção, defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY do projeto.
 */
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "../src/server/supabase/database.types";
import { loadAllContent } from "./lib/load-content";

const checkOnly = process.argv.includes("--check");

async function main() {
  const { seasons, cases, problems } = loadAllContent();
  if (problems.length > 0) {
    console.error("Conteúdo inválido:\n" + problems.map((p) => `  - ${p}`).join("\n"));
    process.exit(1);
  }
  console.log(
    `✓ ${seasons.length} temporada(s), ${seasons.reduce((n, s) => n + s.cases.length, 0)} caso(s) no catálogo, ` +
      `${cases.length} caso(s) jogável(is) válidos (schema, referências e simulação).`,
  );
  for (const c of cases) for (const w of c.warnings) console.warn(`  aviso ${c.definition.id}: ${w}`);
  if (checkOnly) return;

  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY são obrigatórios.");
  const db = createClient<Database>(url, key, { auth: { persistSession: false } });

  for (const season of seasons) {
    const { error: seasonError } = await db
      .from("seasons")
      .upsert({ id: season.id, number: season.number, title: season.title, tagline: season.tagline ?? null });
    if (seasonError) throw seasonError;

    const rows = season.cases.map((c, index) => ({
      id: c.id,
      season_id: season.id,
      code: c.code,
      title: c.title,
      synopsis: c.synopsis,
      category: c.category,
      difficulty: c.difficulty,
      duration_min: c.duration?.min ?? null,
      duration_max: c.duration?.max ?? null,
      cover: c.cover,
      unlock_requires: c.unlockRequires,
      sort_order: index,
    }));
    // `is_playable` e `puzzle_count` não são tocados aqui: vêm da definição do caso (Fase 3).
    const { error: casesError } = await db.from("cases").upsert(rows);
    if (casesError) throw casesError;
    console.log(`✓ Temporada ${season.number} importada (${rows.length} casos).`);
  }

  // Definições jogáveis: cada versão é imutável. Mudou o conteúdo → incremente `version`.
  for (const c of cases) {
    const def = c.definition;
    const { data: existing, error: readError } = await db
      .from("case_versions")
      .select("id, content_hash")
      .eq("case_id", def.id)
      .eq("version", def.version)
      .maybeSingle();
    if (readError) throw readError;

    if (existing && existing.content_hash !== c.contentHash) {
      throw new Error(
        `${def.id} v${def.version}: o conteúdo mudou mas a versão não. Incremente "version" em case.yaml ` +
          "(investigações em andamento continuam na versão antiga).",
      );
    }
    if (!existing) {
      const { error } = await db.from("case_versions").insert({
        case_id: def.id,
        version: def.version,
        content_hash: c.contentHash,
        definition: def as unknown as Json & object,
      });
      if (error) throw error;
      console.log(`✓ ${def.id} v${def.version} publicado.`);
    } else {
      console.log(`= ${def.id} v${def.version} já publicado (sem alterações).`);
    }
    const { error: updateError } = await db
      .from("cases")
      .update({ is_playable: true, puzzle_count: def.puzzles.length })
      .eq("id", def.id);
    if (updateError) throw updateError;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
