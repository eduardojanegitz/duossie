import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/supabase/database.types";

/** E-mails da allowlist local (supabase/seed.sql). */
export const TEST_EMAILS = {
  a: "investigador.a@duossie.test",
  b: "investigador.b@duossie.test",
  c: "investigador.c@duossie.test",
} as const;

function env(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} ausente. Rode \`npm run db:start\` e gere o .env.local (veja README).`);
  }
  return value;
}

export function adminClient() {
  return createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function anonClient() {
  return createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Remove os usuários de teste (o cascade limpa perfis, duplas e convites). */
export async function deleteTestUsers(emails: readonly string[] = Object.values(TEST_EMAILS)) {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const targets = data.users.filter((u) => u.email && emails.includes(u.email));
  for (const user of targets) {
    // Apaga as duplas das quais o usuário participa (membros e convites vão em cascata).
    const { data: memberships } = await admin.from("duo_members").select("duo_id").eq("user_id", user.id);
    const duoIds = (memberships ?? []).map((m) => m.duo_id);
    if (duoIds.length > 0) await admin.from("duos").delete().in("id", duoIds);
    const { error: delError } = await admin.auth.admin.deleteUser(user.id);
    if (delError) throw delError;
  }
}

/**
 * Autentica pelo mesmo fluxo de OTP usado no app, obtendo o código pela API admin
 * (sem depender do servidor de e-mail).
 */
export async function signInAs(email: string): Promise<{ client: SupabaseClient<Database>; userId: string }> {
  const admin = adminClient();
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError) throw linkError;

  const client = anonClient();
  const { data, error } = await client.auth.verifyOtp({
    email,
    token: link.properties.email_otp,
    type: "email",
  });
  if (error || !data.user) throw error ?? new Error("verifyOtp sem usuário");
  return { client, userId: data.user.id };
}
