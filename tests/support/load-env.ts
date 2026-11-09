import { existsSync } from "node:fs";

// Carrega .env.local (gerado a partir de `supabase status`) para os testes de integração.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}
