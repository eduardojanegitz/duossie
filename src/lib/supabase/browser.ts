"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/server/supabase/database.types";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Cliente do navegador: usado para Realtime e leituras protegidas por RLS. */
export function getSupabaseBrowserClient() {
  client ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
  return client;
}
