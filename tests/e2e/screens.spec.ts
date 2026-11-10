import { expect, test } from "@playwright/test";
import { deleteTestUsers } from "../support/supabase";
import { pairDuo } from "./helpers";

const OUT = process.env.SCREENS_DIR;

// Ferramenta de revisão visual: só roda com SCREENS_DIR definido (não faz parte da suíte).
test.skip(!OUT, "defina SCREENS_DIR para gerar capturas");

test("capturas das telas da investigação (mobile)", async ({ browser }) => {
  test.setTimeout(120_000);
  await deleteTestUsers();
  const { a, b, close } = await pairDuo(browser);
  await a.getByRole("link", { name: "Ir para a central" }).click();
  await a.getByRole("link", { name: /^Caso 001:/ }).first().click();
  await a.screenshot({ path: `${OUT}/01-caso.png`, fullPage: true });
  await a.getByRole("radio").first().check();
  await a.getByRole("button", { name: "Abrir investigação" }).click();
  await expect(a.getByTestId("my-role")).toBeVisible();
  await a.screenshot({ path: `${OUT}/02-diario.png` });
  const nav = a.getByRole("navigation", { name: "Seções da investigação" });
  await nav.getByRole("button", { name: /^Arquivos/ }).click();
  await a.screenshot({ path: `${OUT}/03-arquivos.png` });
  await a.getByTestId("evidence-list").getByRole("button").first().click();
  await a.waitForTimeout(600);
  await a.screenshot({ path: `${OUT}/04-documento.png` });
  await a.keyboard.press("Escape");
  await nav.getByRole("button", { name: /^Enigmas/ }).click();
  await a.screenshot({ path: `${OUT}/05-enigmas.png`, fullPage: true });

  // Quadro: fixa duas evidências e uma anotação, conecta, e captura lista (celular) e mesa (desktop).
  await nav.getByRole("button", { name: /^Arquivos/ }).click();
  for (const index of [0, 1]) {
    await a.getByTestId("evidence-list").getByRole("button").nth(index).click();
    await a.getByRole("button", { name: "Fixar no quadro" }).click();
    await expect(a.getByText("Está no seu quadro.")).toBeVisible();
    await a.keyboard.press("Escape");
  }
  await nav.getByRole("button", { name: /^Quadro/ }).click();
  await a.getByRole("button", { name: "Nova anotação" }).click();
  await a.getByLabel("Anotação").fill("Hipótese de teste para a captura de tela.");
  await a.getByRole("button", { name: "Adicionar" }).click();
  const first = a.getByTestId("board-item").first();
  await first.getByLabel("Conectar com").selectOption({ index: 1 });
  await first.getByRole("button", { name: "Conectar" }).click();
  await a.waitForTimeout(800);
  await a.screenshot({ path: `${OUT}/06-quadro-lista.png`, fullPage: true });
  await a.setViewportSize({ width: 1280, height: 800 });
  await a.getByRole("button", { name: "Mesa" }).click();
  await a.waitForTimeout(500);
  await a.screenshot({ path: `${OUT}/07-quadro-mesa.png` });
  await close();
  void b;
  await deleteTestUsers();
});
