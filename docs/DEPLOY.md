# Deploy (Supabase Cloud + Vercel)

> Ainda não executado: depende de você criar as contas/projetos. Tudo abaixo está pronto para seguir.

## 1. Supabase

1. Crie um projeto em supabase.com (região próxima, ex.: São Paulo).
2. Vincule e aplique as migrations:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-do-projeto>
   npx supabase db push
   ```
3. **Auth → Hooks**: ative *Before User Created* → função Postgres `public.hook_before_user_created`.
   (O `config.toml` só vale para o ambiente local.)
4. **Auth → Providers → Email**: habilite e-mail, **desabilite confirmação** (o código OTP já confirma),
   código de 6 dígitos, expiração de 600 s.
5. **Auth → Email Templates**: em *Magic Link* e *Confirm signup*, use o conteúdo de
   `supabase/templates/otp.html` (precisa conter `{{ .Token }}`).
6. **Auth → SMTP**: configure um SMTP próprio (Resend, Postmark, SES…). O SMTP padrão do Supabase
   tem limite muito baixo e não serve para uso real.
7. **Auth → URL Configuration**: *Site URL* = domínio da Vercel (ex.: `https://duossie.vercel.app`).
8. **Project Settings → API**: copie a URL, a chave publicável (`sb_publishable_…`) e a secreta (`sb_secret_…`).

## 2. Conteúdo e allowlist

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SECRET_KEY=sb_secret_... npm run content:import
DB_URL="postgresql://postgres:<senha>@db.<ref>.supabase.co:5432/postgres" npm run allowlist:add -- voce@exemplo.com parceiro@exemplo.com
```

## 3. Vercel

1. Importe o repositório (framework Next.js detectado automaticamente).
2. Variáveis de ambiente (Production e Preview):
   | Nome | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |
   | `SUPABASE_SECRET_KEY` | `sb_secret_…` (**não** marque como exposta ao cliente) |
3. Deploy. A CSP é montada a partir de `NEXT_PUBLIC_SUPABASE_URL` no build — se trocar a URL, refaça o deploy.

## 4. Depois do deploy

- [ ] Entrar com os dois e-mails reais (código chega pelo SMTP).
- [ ] E-mail fora da allowlist é recusado.
- [ ] Formar a dupla, abrir o Caso 001 em dois celulares, conferir presença e sincronização.
- [ ] No celular: "Adicionar à tela inicial" abre em tela cheia (PWA).

## Atualizações

- Código: push → Vercel publica.
- Banco: nova migration → `npx supabase db push`.
- Conteúdo: incremente `version` do caso → `npm run content:import` (investigações em andamento seguem na versão antiga).

---

# Checklist do MVP (seção 25 do briefing)

| # | Critério | Situação | Evidência |
|---|---|---|---|
| 1 | Dois usuários autenticam separadamente | ✅ | E2E `pairing.spec.ts` (OTP real via Mailpit, dois contextos) |
| 2 | Ambos integram a mesma dupla privada | ✅ | E2E `pairing.spec.ts`; integração `duo.test.ts` |
| 3 | A dupla inicia um caso | ✅ | E2E `case-001.spec.ts` |
| 4 | Cada jogador vê suas próprias evidências | ✅ | E2E `case-001.spec.ts`; integração `investigation.test.ts` |
| 5 | Informações exclusivas protegidas | ✅ | integração (`investigation`, `collab`): nada exclusivo nas respostas; RLS sem acesso ao estado |
| 6 | Os dois exploram o caso | ✅ | E2E `case-001.spec.ts` |
| 7 | ≥ 3 enigmas cooperativos funcionando | ✅ | Caso 001 (3 tipos) + contradição e mecanismo (`mechanics.spec.ts`) |
| 8 | Descobertas persistidas | ✅ | log + snapshot; reconexão nos E2E |
| 9 | Progresso sincronizado | ✅ | E2E: capítulo chega ao parceiro sem recarregar |
| 10 | Sair e voltar sem perder progresso | ✅ | E2E `pairing` (reload/logout) e `case-001` (reload no meio) |
| 11 | Formular e enviar conclusão | ✅ | E2E `case-001.spec.ts` (proposta + confirmação) |
| 12 | Resolução e epílogo | ✅ | E2E `case-001.spec.ts` |
| 13 | Validado em celulares | ⚠️ parcial | E2E em viewport de celular (Pixel 7) + capturas; **falta teste em aparelhos reais** |
| 14 | Fluxos principais com testes automatizados | ✅ | 69 unitários, 45 integração, 6 E2E |
| 15 | Executável e implantável com a documentação | ⚠️ parcial | Local: README. Deploy: este guia, **ainda não executado** |
