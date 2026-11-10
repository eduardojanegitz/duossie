/**
 * ⚠️ SPOILERS: este teste joga o Caso 001 inteiro. As respostas vêm do conteúdo
 * (content/cases/case-001), não estão escritas aqui.
 */
import { expect, test, type Page } from "@playwright/test";
import type { CaseDefinition, Puzzle } from "@/engine/schema";
import { loadCases } from "../../scripts/lib/load-content";
import { deleteTestUsers } from "../support/supabase";
import { pairDuo } from "./helpers";

const def: CaseDefinition = loadCases().cases.find((c) => c.definition.id === "case-001")!.definition;
const titlesOf = (role: "A" | "B") => def.evidence.filter((e) => e.visibleTo === role).map((e) => e.title);

test.beforeAll(async () => {
  await deleteTestUsers();
});
test.afterAll(async () => {
  await deleteTestUsers();
});

async function openTab(page: Page, name: string) {
  await page.getByRole("navigation", { name: "Seções da investigação" }).getByRole("button", { name: new RegExp(`^${name}`) }).click();
}

async function dismissChapter(page: Page) {
  const button = page.getByRole("dialog").getByRole("button", { name: "Continuar" });
  if (await button.isVisible().catch(() => false)) await button.click({ timeout: 3000 }).catch(() => undefined);
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function solve(page: Page, puzzle: Puzzle) {
  await dismissChapter(page);
  await openTab(page, "Enigmas");
  const card = page.getByTestId(`puzzle-${puzzle.id}`);
  await expect(card).toBeVisible();
  if (puzzle.type === "match") {
    for (const left of puzzle.left) {
      const option = puzzle.options.find((o) => o.id === puzzle.answer.pairs[left.id])!;
      await card.getByLabel(left.label).selectOption({ label: option.label });
    }
    await card.getByRole("button", { name: "Testar identificação" }).click();
  } else if (puzzle.type === "sequence") {
    // Ordena pela interface (setas), como um jogador faria.
    for (const [target, id] of puzzle.answer.order.entries()) {
      const label = puzzle.items.find((i) => i.id === id)!.label;
      const rows = card.getByRole("listitem");
      let index = (await rows.allTextContents()).findIndex((t) => t.includes(label));
      while (index > target) {
        await card.getByRole("button", { name: `Mover "${label}" para cima` }).click();
        index--;
      }
    }
    await card.getByRole("button", { name: "Testar ordem" }).click();
  } else if (puzzle.type === "code") {
    await card.getByLabel(puzzle.inputLabel).fill(puzzle.answer.accepted[0]!);
    await card.getByRole("button", { name: "Testar" }).click();
  } else {
    throw new Error(`tipo de enigma sem automação no E2E: ${puzzle.type}`);
  }
  await expect(card.getByText("Resolvido", { exact: true })).toBeVisible();
}

test("dupla joga o Caso 001 do início ao epílogo, cada um com sua perspectiva", async ({ browser }) => {
  test.setTimeout(180_000);
  const { a, b, close } = await pairDuo(browser);

  // A abre a investigação como Central (papel A).
  await a.getByRole("link", { name: "Ir para a central" }).click();
  await a.getByRole("link", { name: /^Caso 001:/ }).click();
  await a.getByRole("radio", { name: new RegExp(def.roles.A.name) }).check();
  await a.getByRole("button", { name: "Abrir investigação" }).click();
  await expect(a).toHaveURL(/\/investigacao\/[0-9a-f-]{36}$/);
  await expect(a.getByTestId("my-role")).toHaveText(`Você · ${def.roles.A.name}`);

  // B vê o caso em andamento na central e entra como Campo (papel B).
  await b.getByRole("link", { name: "Ir para a central" }).click();
  await b.getByRole("link", { name: /^Caso 001:/ }).first().click();
  await b.getByRole("link", { name: /^Continuar investigação/ }).click();
  await expect(b.getByTestId("my-role")).toHaveText(`Você · ${def.roles.B.name}`);

  // Cada um vê só as próprias evidências iniciais.
  await openTab(a, "Arquivos");
  await openTab(b, "Arquivos");
  const listA = a.getByTestId("evidence-list");
  const listB = b.getByTestId("evidence-list");
  await expect(listA.getByText(def.evidence.find((e) => e.id === "ev.manifesto")!.title)).toBeVisible();
  for (const title of titlesOf("B")) await expect(listA.getByText(title, { exact: true })).toHaveCount(0);
  for (const title of titlesOf("A")) await expect(listB.getByText(title, { exact: true })).toHaveCount(0);

  // Abrir um documento: leitura em painel e marca como visto.
  const manifesto = def.evidence.find((e) => e.id === "ev.manifesto")!;
  await listA.getByRole("button", { name: new RegExp(manifesto.title) }).click();
  await expect(a.getByRole("dialog").getByRole("heading", { name: manifesto.title })).toBeVisible();
  await a.keyboard.press("Escape");

  // Uma resposta errada dá retorno sem avançar.
  await openTab(b, "Enigmas");
  const first = def.puzzles[0]!;
  const card = b.getByTestId(`puzzle-${first.id}`);
  if (first.type === "match") {
    for (const left of first.left) await card.getByLabel(left.label).selectOption({ index: 1 });
    await card.getByRole("button", { name: "Testar identificação" }).click();
    await expect(card.getByRole("status")).toContainText("Ainda não.");
  }

  // Dica gradual, só para quem pediu.
  await card.getByRole("button", { name: /Pedir uma dica/ }).click();
  await expect(card.getByRole("list", { name: "Dicas recebidas" }).getByRole("listitem")).toHaveCount(1);

  // B resolve o primeiro enigma; A recebe o novo capítulo em tempo real, sem recarregar.
  await solve(b, first);
  await expect(a.getByTestId("chapter")).toContainText(`Cap. 2/${def.chapters.length}`, { timeout: 15_000 });
  await expect(a.getByRole("dialog").getByRole("heading", { name: def.chapters[1]!.title })).toBeVisible();
  await dismissChapter(a);

  // Os demais enigmas, alternando quem resolve.
  for (const [i, p] of def.puzzles.slice(1).entries()) {
    await solve(i % 2 === 0 ? a : b, p);
  }

  // Reconexão: B recarrega e nada se perde.
  await b.reload();
  await expect(b.getByTestId("chapter")).toContainText(`Cap. ${def.chapters.length}/${def.chapters.length}`);

  // Relatório final: A propõe, B confirma.
  await dismissChapter(a);
  await openTab(a, "Relatório");
  for (const q of def.theory.questions) {
    const group = a.getByRole("group", { name: new RegExp(q.prompt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
    for (const id of q.correct) await group.getByLabel(q.options.find((o) => o.id === id)!.label).check();
  }
  await a.getByRole("button", { name: "Propor relatório ao parceiro" }).click();
  await expect(a.getByRole("heading", { name: "Aguardando Lince revisar" })).toBeVisible();

  await dismissChapter(b);
  await openTab(b, "Relatório");
  await expect(b.getByRole("heading", { name: "Corvo propôs este relatório" })).toBeVisible({ timeout: 15_000 });
  await b.getByRole("button", { name: "Confirmar e enviar" }).click();

  // Os dois veem a resolução e o epílogo.
  for (const page of [a, b]) {
    await openTab(page, "Relatório");
    await expect(page.getByTestId("resolution")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Caso encerrado")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Epílogo" })).toBeVisible();
  }

  // A central registra o caso como concluído.
  await a.goto("/central");
  await expect(a.getByRole("link", { name: /^Caso 001:/ }).first()).toContainText("Concluído");
  await close();
});
