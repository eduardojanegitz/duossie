import { expect, test, type Page } from "@playwright/test";
import type { CaseDefinition } from "@/engine/schema";
import { loadCases } from "../../scripts/lib/load-content";
import { deleteTestUsers } from "../support/supabase";
import { pairDuo } from "./helpers";

const def: CaseDefinition = loadCases().cases.find((c) => c.definition.id === "case-001")!.definition;
const startA = def.evidence.find((e) => e.visibleTo === "A" && !e.availableWhen)!;

test.beforeAll(async () => {
  await deleteTestUsers();
});
test.afterAll(async () => {
  await deleteTestUsers();
});

const tab = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Seções da investigação" }).getByRole("button", { name: new RegExp(`^${name}`) }).click();

test("quadro e chat: colaboração em tempo real sem vazar evidências exclusivas", async ({ browser }) => {
  test.setTimeout(120_000);
  const { a, b, close } = await pairDuo(browser);

  await a.getByRole("link", { name: "Ir para a central" }).click();
  await a.getByRole("link", { name: /^Caso 001:/ }).click();
  await a.getByRole("radio", { name: new RegExp(def.roles.A.name) }).check();
  await a.getByRole("button", { name: "Abrir investigação" }).click();
  await expect(a.getByTestId("my-role")).toBeVisible();

  await b.getByRole("link", { name: "Ir para a central" }).click();
  await b.getByRole("link", { name: /^Caso 001:/ }).first().click();
  await b.getByRole("link", { name: /^Continuar investigação/ }).click();
  await expect(b.getByTestId("my-role")).toBeVisible();

  // Presença mostra a seção em que o parceiro está.
  await tab(b, "Quadro");
  await expect(a.getByTestId("partner-presence").filter({ visible: true })).toContainText("investigando · Quadro", { timeout: 15_000 });

  // A fixa uma evidência exclusiva no quadro compartilhado.
  await tab(a, "Arquivos");
  await a.getByTestId("evidence-list").getByRole("button", { name: new RegExp(startA.title) }).click();
  await a.getByRole("button", { name: "Fixar no quadro" }).click();
  await expect(a.getByText("Está no seu quadro.")).toBeVisible();
  await a.keyboard.press("Escape");

  // B vê o cartão tarjado, em tempo real, sem o título da evidência.
  const boardB = b.getByTestId("board-list");
  await expect(boardB.getByRole("article", { name: "Evidência de Corvo" })).toBeVisible({ timeout: 15_000 });
  await expect(boardB.getByText(startA.title)).toHaveCount(0);

  // B cria uma anotação e conecta ao cartão; A vê as duas coisas.
  await b.getByRole("button", { name: "Nova anotação" }).click();
  await b.getByLabel("Anotação").fill("Será que o horário bate?");
  await b.getByLabel("Grupo (opcional)").fill("Horários");
  await b.getByRole("button", { name: "Adicionar" }).click();
  const noteB = boardB.getByRole("article", { name: "Sua anotação" });
  await expect(noteB).toBeVisible();
  await noteB.getByLabel("Conectar com").selectOption({ label: "Evidência de Corvo" });
  await noteB.getByLabel("Rótulo da conexão").fill("mesmo horário");
  await noteB.getByRole("button", { name: "Conectar" }).click();
  await expect(noteB.getByRole("list", { name: "Conexões" })).toContainText("mesmo horário");

  await tab(a, "Quadro");
  const boardA = a.getByTestId("board-list");
  await expect(boardA.getByRole("region", { name: "Horários" })).toBeVisible({ timeout: 15_000 });
  const noteOnA = boardA.getByRole("article", { name: "Anotação de Lince" });
  await expect(noteOnA).toContainText("Será que o horário bate?");
  await expect(noteOnA.getByRole("list", { name: "Conexões" })).toContainText(startA.title);

  // A marca a anotação como contradição; B vê o status mudar.
  await noteOnA.getByLabel("Status", { exact: true }).selectOption("contradiction");
  await expect(noteB.getByLabel("Status", { exact: true })).toHaveValue("contradiction", { timeout: 15_000 });

  // Chat: A manda mensagem com a evidência anexada; B vê o contador e a anexo tarjado.
  await a.getByRole("button", { name: /^Abrir chat/ }).click();
  await a.getByLabel("Anexar evidência").selectOption({ label: `📎 ${startA.title}` });
  await a.getByLabel("Mensagem para Lince").fill("Olha a poltrona 24 aqui");
  await a.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(a.getByTestId("chat-messages")).toContainText("Olha a poltrona 24 aqui");

  await expect(b.getByTestId("chat-unread")).toHaveText("1", { timeout: 15_000 });
  await b.getByRole("button", { name: /^Abrir chat/ }).click();
  const messagesB = b.getByTestId("chat-messages");
  await expect(messagesB).toContainText("Olha a poltrona 24 aqui");
  await expect(messagesB).toContainText("Evidência que só Corvo tem");
  await expect(messagesB.getByText(startA.title)).toHaveCount(0);
  await b.keyboard.press("Escape");
  await expect(b.getByTestId("chat-unread")).toHaveCount(0);

  // Pedido de ajuda em um enigma chega ao parceiro.
  await tab(b, "Enigmas");
  await b.getByRole("button", { name: "Chamar Corvo" }).click();
  await expect(b.getByRole("button", { name: "Pedido enviado a Corvo" })).toBeVisible();
  await expect(a.getByTestId("chat-messages")).toContainText(`Lince pediu ajuda em: ${def.puzzles[0]!.title}`, { timeout: 15_000 });

  await close();
});
