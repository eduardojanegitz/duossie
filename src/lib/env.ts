import { z } from "zod";

/**
 * Variáveis públicas (expostas ao navegador). Precisam ser referenciadas
 * literalmente como `process.env.NEXT_PUBLIC_*` para o Next.js embuti-las.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export type PublicEnv = z.infer<typeof publicSchema>;

let cached: PublicEnv | undefined;

export function publicEnv(): PublicEnv {
  if (cached) return cached;
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!parsed.success) {
    throw new Error(
      "Variáveis públicas do Supabase ausentes ou inválidas. Veja .env.example.",
    );
  }
  cached = parsed.data;
  return cached;
}
