/** Joga o Caso 000 (treinamento) do início ao fim pela interface, com dois navegadores. */
import { expect, test, type Page } from "@playwright/test";
import type { CaseDefinition, Puzzle } from "@/engine/schema";
import { loadCases } from "../../scripts/lib/load-content";
import { deleteTestUsers } from "../support/supabase";
import { pairDuo } from "./helpers";

const def: CaseDefinition = loadCases().cases.find((c) => c.definition.id === "case-000")!.definition;
const puzzle = (id: string) => def.puzzles.find((p) => p.id === id)!;

test.beforeAll(async () => {
  await deleteTestUsers();
});
test.afterAll(async () => {
  await deleteTestUsers();
});

const tab = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Seções da investigação" }).getByRole("button", { name: new RegExp(`^${name}`) }).click();

async function dismissChapter(page: Page) {
  const button = page.getByRole("dialog").getByRole("button", { name: "Continuar" });
  await button.click({ timeout: 5000 }).catch(() => undefined);
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function solveSingle(page: Page, p: Puzzle) {
  const card = page.getByTestId(`puzzle-${p.id}`);
  if (p.type === "code") {
    await card.getByLabel(p.inputLabel).fill(p.answer.accepted[0]!);
    await card.getByRole("button", { name: "Testar" }).click();
  } else if (p.type === "match") {
    for (const l of p.left) await card.getByLabel(l.label).selectOption({ label: p.options.find((o) => o.id === p.answer.pairs[l.id])!.label });
    await card.getByRole("button", { name: "Testar identificação" }).click();
  } else if (p.type === "sequence") {
    for (const [target, id] of p.answer.order.entries()) {
      const label = p.items.find((i) => i.id === id)!.label;
      let index = (await card.getByRole("listitem").allTextContents()).findIndex((t) => t.includes(label));
      while (index-- > target) await card.getByRole("button", { name: `Mover "${label}" para cima` }).click();
    }
    await card.getByRole("button", { name: "Testar ordem" }).click();
  }
  await expect(card.getByText("Resolvido", { exact: true })).toBeVisible({ timeout: 15_000 });
}

test("treinamento: todas as mecânicas, do início ao relatório", async ({ browser }) => {
  test.setTimeout(150_000);
  const { a, b, close } = await pairDuo(browser);

  await a.goto("/casos/case-000");
  await a.getByRole("radio", { name: new RegExp(`^${def.roles.A.name}`) }).check();
  await a.getByRole("button", { name: "Abrir investigação" }).click();
  await expect(a.getByTestId("my-role")).toHaveText(`Você · ${def.roles.A.name}`);
  await b.goto("/casos/case-000");
  await b.getByRole("link", { name: /^Continuar investigação/ }).click();
  await expect(b.getByTestId("my-role")).toHaveText(`Você · ${def.roles.B.name}`);

  // Capítulo 1: guia comum + cadeado.
  await tab(a, "Arquivos");
  await expect(a.getByTestId("evidence-list").getByText("Como funciona")).toBeVisible();
  await tab(a, "Enigmas");
  await solveSingle(a, puzzle("pz.cadeado"));

  // Capítulo 2: dois enigmas em paralelo, um em cada aparelho.
  await dismissChapter(a);
  await dismissChapter(b);
  await tab(b, "Enigmas");
  await solveSingle(a, puzzle("pz.crachas"));
  await solveSingle(b, puzzle("pz.ordem"));

  // Capítulo 3: contradições (cada um envia as suas) e painel alternado.
  await dismissChapter(a);
  await dismissChapter(b);
  const versoes = puzzle("pz.versoes");
  if (versoes.type !== "contradiction") throw new Error("tipo");
  for (const [page, role] of [[a, "A"], [b, "B"]] as const) {
    const card = page.getByTestId("puzzle-pz.versoes");
    for (const st of versoes.statements.filter((s) => s.visibleTo === role && versoes.answer.inconsistent.includes(s.id))) {
      await card.getByLabel(new RegExp(st.label.slice(0, 20))).check();
    }
    await card.getByRole("button", { name: "Enviar minhas marcações" }).click();
  }
  await expect(a.getByTestId("puzzle-pz.versoes").getByText("Resolvido", { exact: true })).toBeVisible({ timeout: 15_000 });

  const painel = puzzle("pz.painel");
  if (painel.type !== "mechanism") throw new Error("tipo");
  for (const step of painel.answer.steps) {
    const page = step.role === "A" ? a : b;
    const label = painel.controls[step.role].find((c) => c.id === step.control)!.label;
    const card = page.getByTestId("puzzle-pz.painel");
    await expect(card.getByRole("button", { name: label })).toBeEnabled({ timeout: 15_000 });
    await card.getByRole("button", { name: label }).click();
    await page.waitForTimeout(400);
  }
  await expect(b.getByTestId("puzzle-pz.painel").getByText("Resolvido", { exact: true })).toBeVisible({ timeout: 15_000 });

  // Decisão conjunta.
  const decision = def.decisions[0]!;
  const option = decision.options[0]!;
  for (const page of [a, b]) {
    await page.getByTestId(`decision-${decision.id}`).getByRole("button", { name: new RegExp(`^${option.label}`) }).click();
    await page.waitForTimeout(400);
  }
  await expect(a.getByTestId(`decision-${decision.id}`).getByText(option.outcome)).toBeVisible({ timeout: 15_000 });

  // Relatório: A propõe, B confirma.
  await dismissChapter(a);
  await dismissChapter(b);
  await tab(a, "Relatório");
  for (const q of def.theory.questions) {
    const group = a.getByRole("group", { name: new RegExp(q.prompt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
    for (const id of q.correct) await group.getByLabel(q.options.find((o) => o.id === id)!.label, { exact: true }).check();
  }
  await a.getByRole("button", { name: "Propor relatório ao parceiro" }).click();
  await tab(b, "Relatório");
  await b.getByRole("button", { name: "Confirmar e enviar" }).click({ timeout: 15_000 });
  for (const page of [a, b]) {
    await tab(page, "Relatório");
    await expect(page.getByTestId("resolution").getByText("Caso encerrado")).toBeVisible({ timeout: 15_000 });
  }
  await close();
});
