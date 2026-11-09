# Duossie

> Duas perspectivas. Uma única verdade.

Plataforma privada de investigação cooperativa para dois jogadores. Cada investigador
recebe informações diferentes, e nenhum enigma cooperativo se resolve sozinho.

- Decisões aprovadas: [docs/DECISIONS.md](docs/DECISIONS.md)
- Plano por fases e critérios de verificação: [docs/PLAN.md](docs/PLAN.md)

> ⚠️ **Spoilers:** não abra `content/cases/*/SPOILERS/` nem os arquivos de enigma se você
> pretende jogar o caso (veja D02).

## Estado atual

| Fase | Situação |
|------|----------|
| 1 — Fundação (setup, banco, auth, dupla) | ✅ implementada e testada |
| 2 — Interface principal | pendente |
| 3 — Motor de investigação + fatia vertical | pendente |
| 4 — Cooperação | pendente |
| 5 — Caso 001 completo | pendente |
| 6 — Polimento e deploy | pendente |

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript estrito · Tailwind CSS 4 · Motion ·
Lucide · Supabase (Postgres, Auth, Realtime, Storage) · Zod · Vitest · Playwright.

## Estrutura

```
src/
  app/            rotas (entrar, perfil, dupla, central)
  components/     ui/ (primitivos), layout/, brand/
  lib/            código puro e compartilhado (onboarding, env público, cliente browser)
  server/         somente servidor: actions/, auth/ (DAL), supabase/ (clientes + tipos), errors
  proxy.ts        renovação de sessão + redirecionamento otimista
supabase/
  migrations/     SQL versionado (schema, RLS, funções)
  seed.sql        dados SOMENTE locais (allowlist de teste)
  templates/      e-mail do código OTP
scripts/          utilitários (allowlist)
tests/
  integration/    contra o Supabase local (RLS, convites, allowlist)
  e2e/            Playwright, dois navegadores independentes
  support/        helpers de teste
docs/             decisões e plano
```

## Modelo de dados (Fase 1)

| Tabela | Acesso pelo cliente | Observação |
|--------|--------------------|------------|
| `profiles` | lê o próprio e o do parceiro; altera só `codename` | criado por trigger no cadastro |
| `duos` | lê a própria dupla | escrita só via `create_duo` |
| `duo_members` | lê membros da própria dupla | máx. 2 (trigger com lock), 1 dupla por usuário |
| `duo_invites` | **nenhum** | código guardado como hash SHA-256, expira em 24h, uso único |
| `private.auth_allowlist` | **nenhum** (schema não exposto) | aplicada no hook `before_user_created` |
| `private.rate_limits` | **nenhum** | janela fixa; usado em convites |

Funções RPC: `create_duo(p_name)`, `create_duo_invite()`, `join_duo(p_code)`. Todas validam
`auth.uid()` e rodam como `SECURITY DEFINER` com `search_path` vazio.

## Fluxo de entrada

1. `/entrar` → e-mail → código de 6 dígitos (OTP) por e-mail. E-mails fora da allowlist são recusados pelo servidor de autenticação.
2. `/perfil` → codinome.
3. `/dupla` → criar a dupla e gerar um convite (`XXXX-XXXX`), ou entrar com um convite.
4. `/central` → disponível quando a dupla tem os dois membros.

A rota `/` redireciona para a etapa certa. A autorização acontece no servidor (DAL em
`src/server/auth/viewer.ts` + RLS); o Proxy só renova a sessão e redireciona quem não está logado.

## Configurar o ambiente

Requisitos: Node 22+ (testado em 24), Docker em execução.

```bash
npm install
npm run db:start          # sobe Supabase local (Docker) e aplica migrations + seed
npx supabase status -o env  # mostra URL e chaves locais
cp .env.example .env.local  # preencha com API_URL, PUBLISHABLE_KEY e SECRET_KEY do passo anterior
npm run dev               # http://localhost:3000
```

E-mails locais (códigos OTP) aparecem no Mailpit: http://127.0.0.1:54324.
Usuários locais permitidos: `investigador.a@duossie.test`, `investigador.b@duossie.test`,
`investigador.c@duossie.test`.

### Variáveis

| Variável | Onde | Descrição |
|----------|------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | cliente + servidor | URL da API do Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | cliente + servidor | chave publicável (`sb_publishable_…`) |
| `SUPABASE_SECRET_KEY` | **só servidor** | chave secreta (`sb_secret_…`); ignora RLS |

### Migrations

- Nova migration: `npx supabase migration new <nome>` e escreva o SQL em `supabase/migrations/`.
- Aplicar do zero no local: `npm run db:reset` (recria o banco, roda migrations e `seed.sql`).
- Regenerar tipos TypeScript: `npm run db:types`.
- Produção: `npx supabase link --project-ref <ref>` e `npx supabase db push`.

### Allowlist

```bash
npm run allowlist:add -- pessoa@exemplo.com                 # banco local (via Docker)
DB_URL="postgresql://…" npm run allowlist:add -- pessoa@exemplo.com   # produção (requer psql)
```

## Testes

```bash
npm run check             # typecheck + lint + testes unitários
npm run test:integration  # requer Supabase local rodando e .env.local
npm run test:e2e          # requer Supabase local; sobe o Next na porta 3100
```

Os testes de integração e E2E apagam e recriam os usuários `*@duossie.test`.

## Deploy (pendente: dependências externas)

Ainda não existem projeto Supabase Cloud nem projeto Vercel. Quando existirem:

1. Supabase: criar o projeto, `supabase link`, `supabase db push`; em Auth, configurar SMTP
   próprio, o template de e-mail com `{{ .Token }}` (veja `supabase/templates/otp.html`), o
   hook `before_user_created` → `public.hook_before_user_created` e a Site URL do domínio Vercel.
2. Adicionar os e-mails reais à allowlist (`DB_URL=… npm run allowlist:add`).
3. Vercel: importar o repositório e definir as três variáveis acima.
