import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/supabase/database.types";
import { anonClient, deleteTestUsers, signInAs, TEST_EMAILS } from "../support/supabase";

type Client = SupabaseClient<Database>;

describe("catálogo público", () => {
  let a: { client: Client; userId: string };

  beforeAll(async () => {
    await deleteTestUsers([TEST_EMAILS.a]);
    a = await signInAs(TEST_EMAILS.a);
  });
  afterAll(async () => {
    await deleteTestUsers([TEST_EMAILS.a]);
  });

  it("anônimo não lê o catálogo", async () => {
    const { data } = await anonClient().from("cases").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("investigador autenticado lê temporadas e casos (requer `npm run content:import`)", async () => {
    const { data: seasons } = await a.client.from("seasons").select("id");
    const { data: cases } = await a.client.from("cases").select("id, code").order("code");
    expect(seasons?.length).toBeGreaterThan(0);
    expect(cases).toEqual(expect.arrayContaining([{ id: "case-001", code: "001" }]));
  });

  it("cliente não consegue alterar o catálogo (ex.: liberar um caso)", async () => {
    const { data } = await a.client.from("cases").update({ is_playable: true, unlock_requires: [] }).eq("id", "case-002").select();
    expect(data ?? []).toHaveLength(0);
    const { error } = await a.client.from("cases").insert({
      id: "case-999",
      season_id: "s01",
      code: "999",
      title: "x",
      synopsis: "x",
      category: "x",
      difficulty: "easy",
      cover: "train",
    });
    expect(error).not.toBeNull();
  });
});

/** Assina um canal privado e devolve o status final (SUBSCRIBED ou erro). */
function subscribe(client: Client, topic: string): Promise<{ status: string; channel: RealtimeChannel }> {
  return new Promise((resolve) => {
    const channel = client.channel(topic, { config: { private: true } });
    const timer = setTimeout(() => resolve({ status: "TIMEOUT", channel }), 10_000);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        clearTimeout(timer);
        resolve({ status, channel });
      }
    });
  });
}

describe("canal Realtime privado da dupla", () => {
  let a: { client: Client; userId: string };
  let b: { client: Client; userId: string };
  let c: { client: Client; userId: string };
  let duoId: string;
  const channels: { client: Client; channel: RealtimeChannel }[] = [];

  beforeAll(async () => {
    await deleteTestUsers();
    [a, b, c] = await Promise.all([signInAs(TEST_EMAILS.a), signInAs(TEST_EMAILS.b), signInAs(TEST_EMAILS.c)]);
    const { data } = await a.client.rpc("create_duo", { p_name: "Unidade Noturna" });
    duoId = data!;
    const { data: invite } = await a.client.rpc("create_duo_invite");
    await b.client.rpc("join_duo", { p_code: invite![0]!.code });
    for (const p of [a, b, c]) await p.client.realtime.setAuth();
  });

  afterAll(async () => {
    for (const { client, channel } of channels) await client.removeChannel(channel);
    await deleteTestUsers();
  });

  it("membros da dupla conseguem assinar o canal", async () => {
    for (const p of [a, b]) {
      const result = await subscribe(p.client, `duo:${duoId}`);
      channels.push({ client: p.client, channel: result.channel });
      expect(result.status).toBe("SUBSCRIBED");
    }
  });

  it("terceiro é recusado no canal da dupla", async () => {
    const result = await subscribe(c.client, `duo:${duoId}`);
    channels.push({ client: c.client, channel: result.channel });
    expect(result.status).not.toBe("SUBSCRIBED");
  });

  it("broadcast de um membro chega ao parceiro", async () => {
    const received = new Promise<unknown>((resolve) => {
      const listener = b.client.channel(`duo:${duoId}`, { config: { private: true } });
      listener.on("broadcast", { event: "ping" }, (msg) => resolve(msg.payload)).subscribe();
      channels.push({ client: b.client, channel: listener });
    });
    const sender = channels.find((ch) => ch.client === a.client)!.channel;
    // Pequena espera para o listener terminar a assinatura.
    await new Promise((r) => setTimeout(r, 1000));
    await sender.send({ type: "broadcast", event: "ping", payload: { hello: "parceiro" } });
    await expect(received).resolves.toEqual({ hello: "parceiro" });
  });
});
