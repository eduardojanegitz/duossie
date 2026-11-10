/**
 * Cria a dupla local de desenvolvimento (Corvo & Lince) com os usuários de teste.
 *   npm run dev:seed-duo
 * Apaga e recria investigador.a/b/c@duossie.test. SOMENTE para o banco local.
 */
import { deleteTestUsers, signInAs, TEST_EMAILS } from "../tests/support/supabase";

process.loadEnvFile(".env.local");

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("127.0.0.1")) {
    throw new Error("Este script só roda contra o Supabase local.");
  }
  await deleteTestUsers();
  const a = await signInAs(TEST_EMAILS.a);
  const b = await signInAs(TEST_EMAILS.b);
  await a.client.from("profiles").update({ codename: "Corvo" }).eq("id", a.userId);
  await b.client.from("profiles").update({ codename: "Lince" }).eq("id", b.userId);
  await a.client.rpc("create_duo", { p_name: "Unidade Noturna" });
  const { data } = await a.client.rpc("create_duo_invite");
  await b.client.rpc("join_duo", { p_code: data![0]!.code });
  console.log("✓ Dupla local criada: Corvo (investigador.a) & Lince (investigador.b).");
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
