# Duossie

> Duas perspectivas. Uma única verdade.

Plataforma privada de investigação cooperativa para dois jogadores. Cada investigador
recebe informações diferentes, e nenhum enigma cooperativo se resolve sozinho.

- Decisões aprovadas: [docs/DECISIONS.md](docs/DECISIONS.md)
- Plano por fases e critérios de verificação: [docs/PLAN.md](docs/PLAN.md)
- Como criar, validar e versionar casos: [docs/CONTENT.md](docs/CONTENT.md)
- Playtest: [docs/PLAYTEST.md](docs/PLAYTEST.md) · Deploy e checklist do MVP: [docs/DEPLOY.md](docs/DEPLOY.md)

> ⚠️ **Spoilers:** não abra `content/cases/` nem `tests/e2e/case-001.spec.ts` /
> `tests/integration/investigation.test.ts` (usam as respostas) se você pretende jogar (veja D02).

## Estado atual

| Fase | Situação |
|------|----------|
| 1 — Fundação (setup, banco, auth, dupla) | ✅ implementada e testada |
| 2 — Interface principal (central, catálogo, dossiês, presença) | ✅ implementada e testada |
| 3 — Motor de investigação + Caso 001 jogável | ✅ implementada e testada (texto; sem áudio/arte final) |
| 4 — Cooperação (quadro, chat, decisões, novos enigmas) | ✅ implementada e testada |
| 5 — Caso 001 completo | ✅ conteúdo e kit de playtest prontos · ⏳ falta playtest com dupla real ([docs/PLAYTEST.md](docs/PLAYTEST.md)) |
| 6 — Polimento e deploy | ✅ áudio, conquistas, histórico, PWA, segurança, acessibilidade · ⏳ deploy depende de contas ([docs/DEPLOY.md](docs/DEPLOY.md)) |

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript estrito · Tailwind CSS 4 ·
shadcn/ui (Radix, tokens mapeados para a paleta do Duossie) · Motion · Lucide ·
Supabase (Postgres, Auth, Realtime, Storage) · Zod · Vitest · Playwright.

## Estrutura

```
src/
  app/            rotas (entrar, perfil, dupla, central, casos/[caseId], investigacao/[sessionId]) + error/not-found
  engine/         motor puro: schema, condições, enigmas, reducer, projeção por papel, validador/simulador
  components/     ui/ (shadcn + primitivos), layout/, brand/, case/ (dossiê, capas), duo/ (presença)
  content/        schemas Zod do conteúdo (catálogo)
  lib/            código puro e compartilhado (onboarding, situação dos casos, realtime, env)
  server/         somente servidor: actions/, auth/ (DAL), catalog, game/ (serviço de investigação), supabase/, errors
  proxy.ts        renovação de sessão + redirecionamento otimista
supabase/
  migrations/     SQL versionado (schema, RLS, funções)
  seed.sql        dados SOMENTE locais (allowlist de teste)
  templates/      e-mail do código OTP
content/
  seasons/        catálogo público das temporadas (YAML, sem spoilers)
  cases/          casos jogáveis (⚠️ SPOILERS) — veja docs/CONTENT.md
scripts/          utilitários (allowlist, importação de conteúdo, dupla local)
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

| `seasons`, `cases` | leitura para autenticados; sem escrita | só metadados sem spoiler; gravados pelo importador |
| `realtime.messages` (tópico `duo:<id>`) | só membros da dupla | presença e sinais da dupla |
| `case_versions` | **nenhum** | definição completa (com soluções) de cada versão publicada |
| `case_sessions` | dupla lê metadados (status, progresso); **não** a coluna `state` | uma por caso por dupla; snapshot + `state_version` |
| `session_players` | dupla | papel A/B de cada jogador |
| `session_actions`, `session_events` | **nenhum** | idempotência (`action_id`) e log append-only |
| `board_items`, `board_links` | **nenhum** (via servidor) | quadro: evidências fixadas, anotações, grupos, status, conexões |
| `session_messages`, `session_reads` | **nenhum** (via servidor) | chat da investigação, pedidos de ajuda, não lidas |
| `duo_achievements` | dupla lê | conquistas concedidas pelo servidor ao concluir um caso |

Funções RPC: `create_duo(p_name)`, `create_duo_invite()`, `join_duo(p_code)`. Todas validam
`auth.uid()` e rodam como `SECURITY DEFINER` com `search_path` vazio. Só para o servidor
(`service_role`): `commit_session_transition(...)` e `consume_rate_limit(...)`.

## Como a investigação funciona

1. O cliente envia uma ação (`view_evidence`, `share_evidence`, `attempt_puzzle`, `request_hint`,
   `operate_mechanism`, `vote_decision`, `propose_theory`, `confirm_theory`, `withdraw_theory`,
   `reopen_theory`) com um `actionId` UUID.
2. A Server Action confere a sessão, a dupla e o papel do jogador, roda o motor (`reduce`) e chama
   `commit_session_transition`, que, numa transação: registra a ação (idempotência), grava o novo
   snapshot só se a versão não mudou (concorrência otimista; em conflito o servidor tenta de novo),
   anexa o evento ao log e manda um sinal **sem conteúdo** no canal `duo:<id>`.
3. Cada navegador, ao receber o sinal (ou ao reconectar/voltar à aba), pede ao servidor a **própria
   projeção** (`projectView`): só as evidências do seu papel, as compartilhadas com ele, os enunciados
   do seu lado e as dicas que pediu. Respostas e gabarito nunca saem do servidor antes do fim.
4. Quadro e chat ficam fora do motor (não são regras do jogo), mas seguem a mesma privacidade:
   o servidor monta a visão de cada um. Um cartão ou anexo de evidência que o leitor não tem aparece
   **tarjado** (sem id, título ou conteúdo); itens privados só existem para o autor. Cada mudança
   dispara um sinal sem conteúdo (`board_updated`, `message_created`) no canal da dupla.
5. O relatório final é conjunto: um propõe, o outro confirma ou devolve. O veredito
   (`closed`/`partial`/`archived`) não depende de tempo. Abaixo de 100 pontos, dá para reabrir.

## Fluxo de entrada

1. `/entrar` → e-mail → código de 6 dígitos (OTP) por e-mail. E-mails fora da allowlist são recusados pelo servidor de autenticação.
2. `/perfil` → codinome.
3. `/dupla` → criar a dupla e gerar um convite (`XXXX-XXXX`), ou entrar com um convite.
4. `/central` → disponível quando a dupla tem os dois membros: dupla, presença do parceiro
   (na central / investigando / ausente / offline, via Realtime Presence), casos por temporada.
5. `/casos/[caseId]` → dossiê do caso (resumo, metadados, requisitos de desbloqueio).

Situação de um caso para a dupla (`src/lib/case-status.ts`): concluído > em andamento >
bloqueado (requisitos não concluídos) > em preparação (sem definição publicada) > disponível.
Hoje todos os casos estão **em preparação**: a definição jogável do Caso 001 chega na Fase 3.

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

Depois de subir o banco, importe o catálogo: `npm run content:import` (o `npm run db:reset` já faz isso).
Para ter uma dupla pronta (Corvo & Lince) sem passar pelo onboarding: `npm run dev:seed-duo`.

E-mails locais (códigos OTP) aparecem no Mailpit: http://127.0.0.1:54324.
Usuários locais permitidos: `investigador.a@duossie.test`, `investigador.b@duossie.test`,
`investigador.c@duossie.test`.

### Jogar o treinamento sozinho (Caso 000)

O Caso 000 é didático e não revela nada dos outros casos. Para jogar os dois papéis:

1. `npm run dev:seed-duo` (cria a dupla Corvo & Lince) e `npm run dev`.
2. Navegador normal: entre com `investigador.a@duossie.test`. Janela anônima (ou outro navegador):
   `investigador.b@duossie.test`. Os códigos chegam no Mailpit (http://127.0.0.1:54324).
3. Num deles, abra o Caso 000 e escolha um papel; no outro, "Continuar investigação".
4. Siga os enunciados — cada enigma diz qual mecânica está treinando.

### Variáveis

| Variável | Onde | Descrição |
|----------|------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | cliente + servidor | URL da API do Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | cliente + servidor | chave publicável (`sb_publishable_…`) |
| `SUPABASE_SECRET_KEY` | **só servidor** | chave secreta (`sb_secret_…`); ignora RLS |

### Migrations

- Nova migration: `npx supabase migration new <nome>` e escreva o SQL em `supabase/migrations/`.
- Aplicar do zero no local: `npm run db:reset` (recria o banco, roda migrations, `seed.sql` e importa o conteúdo).
- Aplicar só as novas: `npx supabase migration up`.
- Regenerar tipos TypeScript: `npm run db:types`.
- Produção: `npx supabase link --project-ref <ref>` e `npx supabase db push`.

### Allowlist

```bash
npm run allowlist:add -- pessoa@exemplo.com                 # banco local (via Docker)
DB_URL="postgresql://…" npm run allowlist:add -- pessoa@exemplo.com   # produção (requer psql)
```

## Testes

```bash
npm run check             # typecheck + lint + testes unitários + validação do conteúdo
npm run test:integration  # requer Supabase local rodando e .env.local
npm run test:e2e          # requer Supabase local; sobe o Next na porta 3100
```

O E2E inclui uma partida completa do Caso 001 com dois navegadores. Para gerar capturas de tela
das telas da investigação (revisão visual em celular):

```bash
SCREENS_DIR=./capturas npx playwright test tests/e2e/screens.spec.ts
```

Os testes de integração e E2E apagam e recriam os usuários `*@duossie.test`.

## Segurança

- RLS em todas as tabelas; o cliente só executa `create_duo`, `create_duo_invite`, `join_duo` e só
  altera `profiles.codename` (auditado com consultas ao catálogo do Postgres).
- Definições, estado, quadro e chat só pelo servidor; projeção por papel; itens tarjados.
- Rate limit: convites, tentativas de enigma/dicas (30/5 min), chat (60/min); OTP limitado pelo Supabase Auth.
- Cabeçalhos: CSP (scripts inline exigidos pelo streaming do Next), `X-Frame-Options: DENY`,
  `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS; `poweredByHeader` desligado.
- Server Actions validam entrada com Zod e conferem dupla/papel; erros técnicos só no log do servidor.
- Bundle do cliente verificado sem a chave secreta nem respostas de enigmas.

## Deploy (pendente: dependências externas)

Passo a passo completo em [docs/DEPLOY.md](docs/DEPLOY.md). Resumo:

Ainda não existem projeto Supabase Cloud nem projeto Vercel. Quando existirem:

1. Supabase: criar o projeto, `supabase link`, `supabase db push`; em Auth, configurar SMTP
   próprio, o template de e-mail com `{{ .Token }}` (veja `supabase/templates/otp.html`), o
   hook `before_user_created` → `public.hook_before_user_created` e a Site URL do domínio Vercel.
2. Importar o conteúdo com as variáveis do projeto: `npm run content:import`.
3. Adicionar os e-mails reais à allowlist (`DB_URL=… npm run allowlist:add`).
4. Vercel: importar o repositório e definir as três variáveis acima.
