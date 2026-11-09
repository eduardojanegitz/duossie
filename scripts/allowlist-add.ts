/**
 * Adiciona e-mails à allowlist de cadastro.
 *   npm run allowlist:add -- pessoa@exemplo.com outra@exemplo.com
 *
 * Usa DB_URL (padrão: banco local do Supabase). Para produção, defina DB_URL com a
 * connection string do projeto (nunca faça commit dela).
 */
import { execFileSync } from "node:child_process";

const emails = process.argv.slice(2).map((e) => e.trim().toLowerCase());
const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (emails.length === 0 || emails.some((e) => !valid.test(e))) {
  console.error("Uso: npm run allowlist:add -- email@exemplo.com [outro@exemplo.com]");
  process.exit(1);
}

const dbUrl = process.env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const values = emails.map((e) => `('${e.replace(/'/g, "''")}')`).join(", ");
const sql = `insert into private.auth_allowlist (email) values ${values} on conflict do nothing;`;

// psql do container local do Supabase, sem exigir psql instalado na máquina.
const isLocal = !process.env.DB_URL;
if (isLocal) {
  execFileSync("docker", ["exec", "-i", "supabase_db_duossie", "psql", "-U", "postgres", "-c", sql], {
    stdio: "inherit",
  });
} else {
  execFileSync("psql", [dbUrl, "-c", sql], { stdio: "inherit" });
}
console.log(`Allowlist atualizada: ${emails.length} e-mail(s).`);
