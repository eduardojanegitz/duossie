/**
 * Importa o conteúdo de `content/` para o banco (catálogo público de temporadas e casos).
 *   npm run content:import            → banco local (usa .env.local)
 *   npm run content:import -- --check → só valida, sem gravar
 *
 * Para produção, defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY do projeto.
 */
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/server/supabase/database.types";
import { loadSeasonCatalogs } from "./lib/load-content";

const checkOnly = process.argv.includes("--check");

async function main() {
  const { seasons, problems } = loadSeasonCatalogs();
  if (problems.length > 0) {
    console.error("Conteúdo inválido:\n" + problems.map((p) => `  - ${p}`).join("\n"));
    process.exit(1);
  }
  console.log(`✓ ${seasons.length} temporada(s), ${seasons.reduce((n, s) => n + s.cases.length, 0)} caso(s) válidos.`);
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
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
