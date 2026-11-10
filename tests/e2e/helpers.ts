import { expect, type Browser, type Page } from "@playwright/test";
import { waitForOtp } from "../support/mailpit";
import { TEST_EMAILS } from "../support/supabase";
import "../support/load-env";

export async function login(page: Page, email: string) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/entrar$/);
  const since = new Date();
  await page.getByLabel("E-mail do investigador").fill(email);
  await page.getByRole("button", { name: "Receber código" }).click();
  const code = await waitForOtp(email, since);
  await page.getByLabel("Código de acesso").fill(code);
  await page.getByRole("button", { name: "Entrar" }).click();
}

export async function setCodename(page: Page, codename: string) {
  await expect(page).toHaveURL(/\/perfil$/);
  await page.getByLabel("Codinome").fill(codename);
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page).toHaveURL(/\/dupla$/);
}

/** Cria a dupla Corvo (A) & Lince (B) pela interface, em dois contextos independentes. */
export async function pairDuo(browser: Browser) {
  const ctxA = await browser.newContext({ reducedMotion: "reduce" });
  const ctxB = await browser.newContext({ reducedMotion: "reduce" });
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await login(a, TEST_EMAILS.a);
  await setCodename(a, "Corvo");
  await a.getByLabel("Nome da dupla").fill("Unidade Noturna");
  await a.getByRole("button", { name: "Criar dupla" }).click();
  await a.getByRole("button", { name: "Gerar código de convite" }).click();
  const codeEl = a.getByLabel(/^Código [A-Z2-9]{4}-[A-Z2-9]{4}$/);
  const invite = (await codeEl.textContent())!.trim();
  await login(b, TEST_EMAILS.b);
  await setCodename(b, "Lince");
  await b.getByRole("textbox", { name: "Código de convite" }).fill(invite);
  await b.getByRole("button", { name: "Entrar na dupla" }).click();
  await expect(b.getByRole("link", { name: "Ir para a central" })).toBeVisible();
  return { a, b, close: async () => (await ctxA.close(), await ctxB.close()) };
}
