import "server-only";
import { z } from "zod";

const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
});

let cached: z.infer<typeof serverSchema> | undefined;

/** Variáveis exclusivas do servidor. Nunca importe este módulo em Client Components. */
export function serverEnv() {
  if (cached) return cached;
  const parsed = serverSchema.safeParse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });
  if (!parsed.success) {
    throw new Error("SUPABASE_SECRET_KEY ausente. Veja .env.example.");
  }
  cached = parsed.data;
  return cached;
}
