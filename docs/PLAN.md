# Plano de implementação

Cada fase termina com critérios verificáveis. A **fatia vertical** (Caso 001 cru, jogável)
foi antecipada para a Fase 3 para validar a diversão cedo.

## Fase 1 — Fundação
- Next.js 16 + TS estrito + Tailwind 4 + Motion + Lucide; Vitest; Playwright.
- Supabase local (Docker), migrations versionadas, RLS em todas as tabelas.
- Auth por OTP de e-mail com allowlist; perfil (codinome).
- Dupla privada: criar, gerar convite (código com hash + expiração), entrar, máximo 2 membros.

**Verificação:** `npm run typecheck`, `npm run lint`, `npm test` (unit), testes de integração
contra o Supabase local (RLS: terceiro não lê dupla alheia; 3º membro é rejeitado; convite
expirado/usado falha), login + pareamento E2E com dois contextos de navegador.

## Fase 2 — Interface principal
- Identidade visual (tokens, tipografia, componentes de dossiê/documento).
- Abertura curta (uma vez por sessão do navegador), Central de Investigações, perfis.
- Lista de casos como dossiês (status, progresso, bloqueios), tela de apresentação do caso.
- Estados de carregamento e erro personalizados.

**Verificação:** telas renderizam com dados reais do banco; checagem manual em 375px e desktop;
`prefers-reduced-motion` respeitado.

## Fase 3 — Motor de investigação + fatia vertical
- Schema Zod do caso, condições (AST JSON), efeitos, reducer puro, projeção por papel.
- Validador: referências, ciclos, alcançabilidade, regra de cooperação, simulador do caminho de solução.
- Import de casos para `case_versions` (hash de conteúdo); sessão presa à versão.
- Commit atômico (`commit_transition`) com versão + `action_id` idempotente.
- Caso 001 em versão crua (texto) carregado no motor.

**Verificação:** testes unitários do motor; `npm run cases:validate` passa; integração: jogador A
nunca recebe evidência exclusiva de B na resposta da API.

## Fase 4 — Cooperação
- Realtime (sinais em canais privados + refetch), presença, reconexão.
- Enigmas: combinação, cronologia, identificação (depois códigos, contradições, sequência).
- Dicas graduais, quadro de evidências (canvas no desktop / lista no celular), compartilhamento explícito.
- Decisões individuais e conjuntas (votação com revisão), chat secundário.

**Verificação:** E2E com dois jogadores: sincronização, enigma cooperativo, reconexão sem perda.

## Fase 5 — Caso 001 completo
- Roteiro (em `SPOILERS/`), documentos, personagens, 10–15 pistas, ≥3 enigmas, reviravolta, teoria final, resolução, epílogo.

**Verificação:** simulador conclui o caso; playtest com uma dupla de teste; questionário.

## Fase 6 — Polimento e validação
- Animações, áudio procedural opcional, acessibilidade, PWA, revisão de segurança, deploy Vercel.

**Verificação:** checklist de critérios de aceite do MVP (README), E2E completo.

## Dependências externas pendentes
- Projeto Supabase Cloud e conta Vercel (necessários só para o deploy).
- SMTP para envio de OTP em produção (o Supabase local usa o Inbucket/Mailpit).
