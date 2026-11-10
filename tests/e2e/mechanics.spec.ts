/**
 * Exercita pela interface as mecânicas que o Caso 001 não usa (contradições, mecanismo e
 * decisão conjunta), publicando temporariamente um caso sintético no banco LOCAL.
 */
import { expect, test, type Page } from "@playwright/test";
import { coopCaseInput } from "@/engine/fixtures";
import { caseDefinitionSchema } from "@/engine/schema";
import { adminClient, deleteTestUsers } from "../support/supabase";
import { pairDuo } from "./helpers";
import "../support/load-env";

const def = caseDefinitionSchema.parse(structuredClone(coopCaseInput));

async function cleanup() {
  const db = adminClient();
  await db.from("case_sessions").delete().eq("case_id", def.id);
  await db.from("case_versions").delete().eq("case_id", def.id);
  await db.from("cases").delete().eq("id", def.id);
}

test.beforeAll(async () => {
  await deleteTestUsers();
  await cleanup();
  const db = adminClient();
  const { error } = await db.from("cases").insert({
    id: def.id,
    season_id: "s01",
    code: "901",
    title: "Caso de teste das mecânicas",
    synopsis: "Usado só nos testes automatizados.",
    category: "Teste",
    difficulty: "easy",
    cover: "folder",
    is_playable: true,
    puzzle_count: def.puzzles.length,
    sort_order: 99,
  });
  if (error) throw error;
  const { error: vError } = await db
    .from("case_versions")
    .insert({ case_id: def.id, version: 1, content_hash: "e2e", definition: JSON.parse(JSON.stringify(def)) });
  if (vError) throw vError;
});

test.afterAll(async () => {
  await deleteTestUsers();
  await cleanup();
});

const tab = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Seções da investigação" }).getByRole("button", { name: new RegExp(`^${name}`) }).click();

test("contradições, mecanismo e decisão conjunta funcionam entre os dois jogadores", async ({ browser }) => {
  test.setTimeout(120_000);
  const { a, b, close } = await pairDuo(browser);

  await a.goto(`/casos/${def.id}`);
  await a.getByRole("radio", { name: new RegExp(`^${def.roles.A.name}`) }).check();
  await a.getByRole("button", { name: "Abrir investigação" }).click();
  await expect(a.getByTestId("my-role")).toBeVisible();
  await b.goto(`/casos/${def.id}`);
  await b.getByRole("link", { name: /^Continuar investigação/ }).click();
  await expect(b.getByTestId("my-role")).toBeVisible();
  await tab(a, "Enigmas");
  await tab(b, "Enigmas");

  // Contradições: cada um vê só as próprias afirmações.
  const mentirasA = a.getByTestId("puzzle-pz.mentiras");
  const mentirasB = b.getByTestId("puzzle-pz.mentiras");
  await expect(mentirasA.getByText("“Estava em casa.”")).toBeVisible();
  await expect(mentirasA.getByText("“Chovia.”")).toHaveCount(0);

  // Primeira rodada errada: A marca as duas, B nenhuma.
  await mentirasA.getByLabel(/Estava em casa/).check();
  await mentirasA.getByLabel(/Ouviu o alarme/).check();
  await mentirasA.getByRole("button", { name: "Enviar minhas marcações" }).click();
  await expect(mentirasA.getByText(/Falta Lince enviar/)).toBeVisible();
  await expect(mentirasB.getByText("Corvo já enviou.")).toBeVisible({ timeout: 15_000 });
  await mentirasB.getByRole("button", { name: "Enviar minhas marcações" }).click();
  await expect(mentirasB.getByText(/2 de 4 estão certos/)).toBeVisible();

  // Segunda rodada certa.
  await mentirasA.getByLabel(/Ouviu o alarme/).uncheck();
  await mentirasA.getByRole("button", { name: "Enviar minhas marcações" }).click();
  await mentirasB.getByLabel(/Chovia/).check();
  await mentirasB.getByRole("button", { name: "Enviar minhas marcações" }).click();
  await expect(mentirasA.getByText("Resolvido", { exact: true })).toBeVisible({ timeout: 15_000 });

  // Capítulo novo chega aos dois.
  for (const page of [a, b]) {
    const cont = page.getByRole("dialog").getByRole("button", { name: "Continuar" });
    await cont.click({ timeout: 15_000 }).catch(() => undefined);
  }

  // Mecanismo: comando fora de ordem trava; ordem alternada resolve.
  const eclusaA = a.getByTestId("puzzle-pz.eclusa");
  const eclusaB = b.getByTestId("puzzle-pz.eclusa");
  await expect(eclusaB.getByRole("button", { name: "Válvula 1" })).toHaveCount(0);
  await eclusaA.getByRole("button", { name: "Válvula 2" }).click();
  await expect(eclusaA.getByText("O mecanismo travou")).toBeVisible();
  await eclusaA.getByRole("button", { name: "Válvula 1" }).click();
  await expect(eclusaB.getByText("1 de 3 etapas")).toBeVisible({ timeout: 15_000 });
  await eclusaB.getByRole("button", { name: "Comporta 1" }).click();
  await expect(eclusaA.getByText("2 de 3 etapas")).toBeVisible({ timeout: 15_000 });
  await eclusaA.getByRole("button", { name: "Válvula 2" }).click();
  await expect(eclusaB.getByText("Resolvido", { exact: true })).toBeVisible({ timeout: 15_000 });

  // Decisão conjunta: discordância não decide; acordo aplica a consequência para os dois.
  const decisaoA = a.getByTestId("decision-dc.denunciar");
  const decisaoB = b.getByTestId("decision-dc.denunciar");
  await decisaoA.getByRole("button", { name: /^Agora/ }).click();
  await expect(decisaoB.getByRole("button", { name: /voto de Corvo/ })).toBeVisible({ timeout: 15_000 });
  await decisaoB.getByRole("button", { name: /^Esperar/ }).click();
  await expect(decisaoA.getByText(/opções diferentes/)).toBeVisible({ timeout: 15_000 });
  await decisaoB.getByRole("button", { name: /^Agora/ }).click();
  for (const d of [decisaoA, decisaoB]) {
    await expect(d.getByText("A polícia chegou a tempo.")).toBeVisible({ timeout: 15_000 });
  }

  // A decisão libera o relatório.
  await expect(a.getByRole("navigation", { name: "Seções da investigação" }).getByRole("button", { name: /^Relatório/ })).toBeVisible();

  // Decisão individual existe só para B.
  await expect(a.getByTestId("decision-dc.segredo")).toHaveCount(0);
  await expect(b.getByTestId("decision-dc.segredo")).toBeVisible();

  await close();
});
