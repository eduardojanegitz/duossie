import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/server/env";
import type { Database } from "./database.types";

/**
 * Cliente com a chave secreta: IGNORA o RLS. Use somente em serviços do servidor
 * que já validaram quem é o usuário e o que ele pode ver (ex.: motor de casos).
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(publicEnv().NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
