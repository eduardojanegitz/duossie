# Decisões do projeto

Registro das decisões aprovadas. Cada entrada diz o que foi decidido e por quê.
Alterar uma decisão = editar esta página e citar o motivo.

| # | Tema | Decisão | Motivo |
|---|------|---------|--------|
| D01 | Nome | O produto se chama **Duossie** ("Caso a Dois" foi o nome provisório). | Pedido do dono do produto. |
| D02 | Spoilers | Verdade, cronologia e soluções de cada caso ficam em `content/cases/<caso>/SPOILERS/` e nos arquivos de enigma. O dono do produto **não lê** esses arquivos; aprova só o pitch sem spoilers. Coerência garantida por validador + simulador + playtest com outra dupla. | O dono do produto também é jogador. |
| D03 | Duplas de teste | Cadastro só para e-mails da tabela `private.auth_allowlist`, aplicada no hook `before_user_created` do Supabase Auth (no servidor, não dá para burlar pelo cliente). Duplas extras de playtest entram pela mesma allowlist (`npm run allowlist:add`). | App privado, mas precisa de playtest. |
| D04 | Contexto de jogo | Projetar para os dois cenários (mesmo ambiente e à distância). Chat secundário, sempre disponível. | Pergunta não respondida → padrão mais flexível. |
| D05 | Simultaneidade | Explorar sozinho é permitido. Enigmas cooperativos de sequência e decisões conjuntas exigem os dois. | Evita bloquear quem chega primeiro. |
| D06 | Papéis | Cada caso define dois papéis com justificativa narrativa (ex.: Central × Campo). A dupla escolhe quem fica com qual papel ao iniciar a investigação. | Assimetria diegética. |
| D07 | Compartilhamento | Fidelidade por evidência: `full` (cópia integral), `report` (relato escrito pelo jogador) ou `none`. Sempre ação explícita. | Mantém a cooperação sem forçar ditado. |
| D08 | Teoria final | Uma submissão oficial com avaliação qualitativa (Caso encerrado / Parcialmente esclarecido / Arquivado). Depois é possível reabrir para buscar o final completo. Sem pontuação por tempo. | Prêmio ao raciocínio. |
| D09 | Dicas | Ilimitadas, graduais, registradas só em estatísticas. | Não punir quem trava. |
| D10 | Imagens | Documentos renderizados em HTML/CSS + ilustrações estilizadas (SVG). Fotos geradas por IA podem substituir depois. | Eu não gero fotografias; isso desbloqueia o conteúdo. |
| D11 | Login | Código OTP de 6 dígitos por e-mail (Supabase Auth). | Funciona em PWA/celular, sem senha. |
| D12 | Idioma e tom | Só PT-BR, textos centralizados. Crime e morte permitidos, sem gore. | |
| D13 | Estado da sessão | Snapshot `jsonb` versionado + log de eventos append-only, commit atômico via função Postgres. | Motor puro em TS, idempotência, concorrência otimista. |
| D14 | Infra | Desenvolvimento com Supabase local (Docker). Projeto Supabase Cloud e Vercel ainda não existem → dependência sinalizada no README. PWA instalável sem jogo offline. | |
| D15 | Next.js | Next.js 16 com `cacheComponents` habilitado: toda leitura de sessão fica atrás de `<Suspense>`. Auth checa no servidor (DAL); o Proxy só renova cookies. | Padrão do template atual; mantém shell estático rápido. |
| D16 | Gerenciador de pacotes | npm (pnpm não está instalado na máquina). | |
| D17 | Formato do conteúdo | Casos em YAML + Markdown, validados por Zod, importados para `case_versions`. Nenhum código executável nos casos. | |
| D18 | Componentes | shadcn/ui (base Radix, preset Nova) com tokens semânticos mapeados para a paleta do Duossie; `Button` estendido com tamanho `touch` (48px) e variante `quiet`. Helper `cn` do pacote `cn` (padrão atual do shadcn). | Preferência inicial + consistência. |
| D19 | Catálogo | Metadados públicos (sem spoiler) de temporadas e casos em `content/seasons/*.yaml`, importados para `seasons`/`cases`. Casos sem definição publicada aparecem como "em preparação", sem botão de iniciar. | Nada de telas falsas. |
| D20 | Presença | Realtime Presence no canal privado `duo:<id>`, autorizado por RLS em `realtime.messages`. Efêmera: não é fonte de verdade do jogo. | Seção 12 do briefing. |
| D21 | Abertura | Uma vez por sessão do navegador, ~2,6s, pulável, omitida com `prefers-reduced-motion`. | Seção 18. |
