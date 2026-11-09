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
