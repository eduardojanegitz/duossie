import { expect, test, type Page } from "@playwright/test";
import { deleteTestUsers, TEST_EMAILS } from "../support/supabase";
import { waitForOtp } from "../support/mailpit";
import "../support/load-env";

async function login(page: Page, email: string) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/entrar$/);
  const since = new Date();
  await page.getByLabel("E-mail do investigador").fill(email);
  await page.getByRole("button", { name: "Receber código" }).click();
  const code = await waitForOtp(email, since);
  await page.getByLabel("Código de acesso").fill(code);
  await page.getByRole("button", { name: "Entrar" }).click();
}

async function setCodename(page: Page, codename: string) {
  await expect(page).toHaveURL(/\/perfil$/);
  await page.getByLabel("Codinome").fill(codename);
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page).toHaveURL(/\/dupla$/);
}

test.beforeAll(async () => {
  await deleteTestUsers();
});

test.afterAll(async () => {
  await deleteTestUsers();
});

test("e-mail fora da allowlist não recebe acesso", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("E-mail do investigador").fill("intruso@duossie.test");
  await page.getByRole("button", { name: "Receber código" }).click();
  await expect(page.getByText("Este endereço não tem acesso ao Duossie.")).toBeVisible();
});

test("rota protegida redireciona quem não está logado", async ({ page }) => {
  await page.goto("/central");
  await expect(page).toHaveURL(/\/entrar$/);
});

test("dois investigadores entram, formam a dupla e reconectam sem perder o vínculo", async ({ browser }) => {
  // Sessões totalmente independentes (cookies separados), como dois celulares.
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await login(a, TEST_EMAILS.a);
  await setCodename(a, "Corvo");
  await a.getByLabel("Nome da dupla").fill("Unidade Noturna");
  await a.getByRole("button", { name: "Criar dupla" }).click();
  await expect(a.getByRole("heading", { name: "Unidade Noturna" })).toBeVisible();
  await a.getByRole("button", { name: "Gerar código de convite" }).click();
  const codeEl = a.getByLabel(/^Código [A-Z2-9]{4}-[A-Z2-9]{4}$/);
  await expect(codeEl).toBeVisible();
  const invite = (await codeEl.textContent())!.trim();

  await login(b, TEST_EMAILS.b);
  await setCodename(b, "Lince");
  await b.getByRole("textbox", { name: "Código de convite" }).fill(invite);
  await b.getByRole("button", { name: "Entrar na dupla" }).click();
  await expect(b.getByRole("heading", { name: "Unidade Noturna" })).toBeVisible();
  await expect(b.getByText("Corvo")).toBeVisible();

  // A tela de A percebe o parceiro sozinha (atualização periódica).
  await expect(a.getByText("Lince")).toBeVisible({ timeout: 15_000 });

  for (const [page, pair] of [
    [a, "Corvo & Lince"],
    [b, "Lince & Corvo"],
  ] as const) {
    await page.getByRole("link", { name: "Ir para a central" }).click();
    await expect(page).toHaveURL(/\/central$/);
    await expect(page.getByTestId("central-ready")).toBeVisible();
    await expect(page.getByText(pair)).toBeVisible();
  }

  // Reconexão: recarregar e abrir a raiz mantém a sessão e a dupla.
  await b.reload();
  await b.goto("/");
  await expect(b).toHaveURL(/\/central$/);
  await expect(b.getByRole("heading", { name: "Unidade Noturna" })).toBeVisible();

  // Sair encerra a sessão.
  await a.getByRole("button", { name: "Sair" }).click();
  await expect(a).toHaveURL(/\/entrar$/);
  await a.goto("/central");
  await expect(a).toHaveURL(/\/entrar$/);

  await ctxA.close();
  await ctxB.close();
});
