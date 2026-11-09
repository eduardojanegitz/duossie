import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/supabase/database.types";
import { anonClient, deleteTestUsers, signInAs, TEST_EMAILS } from "../support/supabase";

type Client = SupabaseClient<Database>;

describe("autenticação e allowlist", () => {
  it("rejeita e-mail fora da allowlist", async () => {
    const { error } = await anonClient().auth.signInWithOtp({
      email: "intruso@duossie.test",
      options: { shouldCreateUser: true },
    });
    expect(error).not.toBeNull();
  });

  it("anônimo não lê nenhuma tabela", async () => {
    const client = anonClient();
    for (const table of ["profiles", "duos", "duo_members", "duo_invites"] as const) {
      const { data } = await client.from(table).select("*");
      expect(data ?? []).toHaveLength(0);
    }
  });
});

describe("dupla privada", () => {
  let a: { client: Client; userId: string };
  let b: { client: Client; userId: string };
  let c: { client: Client; userId: string };
  let duoId: string;
  let inviteCode: string;

  beforeAll(async () => {
    await deleteTestUsers();
    [a, b, c] = await Promise.all([signInAs(TEST_EMAILS.a), signInAs(TEST_EMAILS.b), signInAs(TEST_EMAILS.c)]);
    await a.client.from("profiles").update({ codename: "Corvo" }).eq("id", a.userId);
    await b.client.from("profiles").update({ codename: "Lince" }).eq("id", b.userId);
    await c.client.from("profiles").update({ codename: "Intruso" }).eq("id", c.userId);
  });

  afterAll(async () => {
    await deleteTestUsers();
  });

  it("cria perfil automaticamente no cadastro", async () => {
    const { data } = await a.client.from("profiles").select("id, codename").eq("id", a.userId).single();
    expect(data).toEqual({ id: a.userId, codename: "Corvo" });
  });

  it("não deixa alterar o perfil de outro jogador", async () => {
    const { data } = await c.client.from("profiles").update({ codename: "Hacker" }).eq("id", a.userId).select();
    expect(data ?? []).toHaveLength(0);
    const { data: still } = await a.client.from("profiles").select("codename").eq("id", a.userId).single();
    expect(still?.codename).toBe("Corvo");
  });

  it("A cria a dupla", async () => {
    const { data, error } = await a.client.rpc("create_duo", { p_name: "Unidade Noturna" });
    expect(error).toBeNull();
    duoId = data!;
    const { data: duo } = await a.client.from("duos").select("id, name").single();
    expect(duo).toEqual({ id: duoId, name: "Unidade Noturna" });
  });

  it("não deixa inserir membros diretamente pela API", async () => {
    const { error } = await c.client.from("duo_members").insert({ duo_id: duoId, user_id: c.userId });
    expect(error).not.toBeNull();
  });

  it("terceiro não enxerga a dupla, os membros nem o perfil de A", async () => {
    const [duos, members, profiles] = await Promise.all([
      c.client.from("duos").select("*"),
      c.client.from("duo_members").select("*"),
      c.client.from("profiles").select("*").eq("id", a.userId),
    ]);
    expect(duos.data ?? []).toHaveLength(0);
    expect(members.data ?? []).toHaveLength(0);
    expect(profiles.data ?? []).toHaveLength(0);
  });

  it("convites não são legíveis pela API, nem pelo criador", async () => {
    await a.client.rpc("create_duo_invite");
    const { data } = await a.client.from("duo_invites").select("*");
    expect(data ?? []).toHaveLength(0);
  });

  it("gerar um novo convite invalida o anterior", async () => {
    const first = await a.client.rpc("create_duo_invite");
    const second = await a.client.rpc("create_duo_invite");
    expect(second.data?.[0]?.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    inviteCode = second.data![0]!.code;

    const stale = await b.client.rpc("join_duo", { p_code: first.data![0]!.code });
    expect(stale.error).toBeNull();
    expect(stale.data).toBeNull();
  });

  it("código inexistente é rejeitado", async () => {
    const { data, error } = await b.client.rpc("join_duo", { p_code: "ZZZZ-ZZZZ" });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("B entra na dupla com o código (aceita minúsculas e sem hífen)", async () => {
    const { data, error } = await b.client.rpc("join_duo", { p_code: inviteCode.toLowerCase().replace("-", "") });
    expect(error).toBeNull();
    expect(data).toBe(duoId);
  });

  it("os dois membros se enxergam", async () => {
    for (const player of [a, b]) {
      const { data } = await player.client.from("duo_members").select("user_id").eq("duo_id", duoId);
      expect(data?.map((m) => m.user_id).sort()).toEqual([a.userId, b.userId].sort());
      const { data: profiles } = await player.client.from("profiles").select("codename").order("codename");
      expect(profiles?.map((p) => p.codename)).toEqual(["Corvo", "Lince"]);
    }
  });

  it("o código é de uso único", async () => {
    const { data, error } = await c.client.rpc("join_duo", { p_code: inviteCode });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("dupla completa não gera novos convites", async () => {
    const { error } = await a.client.rpc("create_duo_invite");
    expect(error?.message).toBe("duo_full");
  });

  it("quem já tem dupla não cria outra", async () => {
    const { error } = await b.client.rpc("create_duo", { p_name: "Outra" });
    expect(error?.message).toBe("already_in_duo");
  });

  it("terceiro continua isolado depois do vínculo", async () => {
    const { data } = await c.client.from("profiles").select("id");
    expect(data?.map((p) => p.id)).toEqual([c.userId]);
  });

  it("limita tentativas de código de convite (força bruta)", async () => {
    const results: (string | undefined)[] = [];
    for (let i = 0; i < 11; i++) {
      const { data, error } = await c.client.rpc("join_duo", { p_code: `AAAA-AAA${(i % 9) + 1}` });
      results.push(error?.message ?? (data === null ? "invalid_invite" : "joined"));
    }
    // C já gastou 2 tentativas nos testes anteriores; o limite é 10 por janela.
    expect(results.slice(0, 8).every((m) => m === "invalid_invite")).toBe(true);
    expect(results.at(-1)).toBe("rate_limited");
  });
});
