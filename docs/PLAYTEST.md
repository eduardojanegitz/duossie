# Roteiro de playtest

Objetivo: descobrir se o caso é **divertido, justo e cooperativo** antes de polir mais.
Sem spoilers aqui. Quem conduz não precisa conhecer a solução.

## Antes

1. Uma dupla que **não** é a dupla final (para não estragar o caso dela).
2. Adicione os e-mails à allowlist: `npm run allowlist:add -- a@exemplo.com b@exemplo.com`.
3. Cada pessoa no próprio celular. Defina o cenário: **mesma sala** ou **à distância** (anote qual).
4. Explique só isto: "Vocês são parceiros de investigação. Cada um vê coisas diferentes. Conversem."
5. Não ajude durante o jogo. Anote em vez de responder.

## Durante (observação)

Anote com horário:

- Primeiro momento de "aha" (quando, de quem, por quê).
- Momentos de frustração ou de "não sei o que fazer".
- Quando alguém ficou esperando o outro.
- Quando um leu para o outro em voz alta em vez de interpretar (sinal de pista fácil de ditar).
- Se alguém mostrou a tela do celular ao outro (normal no mesmo ambiente; anote em que pista).
- Palpites errados plausíveis (bom sinal) e chutes (mau sinal).

## Depois (5 perguntas, cada pessoa separadamente)

1. Qual foi o melhor momento? Teve um "aha"?
2. Em que momento você travou ou se frustrou?
3. Você ficou esperando o parceiro em algum momento? Quanto tempo?
4. Algo foi resolvido no chute? O quê?
5. Você jogaria o próximo caso? (0 a 10)

## Métricas automáticas

```bash
npm run playtest:report                  # todas as investigações
npm run playtest:report -- <sessionId>   # uma investigação
```

Mostra duração, tempo entre enigmas, ações até resolver, dicas por papel, maior pausa de cada
papel (⚠️ acima de 3 minutos), mensagens no chat e itens no quadro.

## Critérios de aprovação (do plano)

| Critério | Meta |
|---|---|
| Duração total | 20–30 min (aceitável até 40) |
| Cada enigma gerou conversa | sim, nos três |
| Ociosidade | nenhum papel parado > 3 min |
| Relatório | deduzível sem chute (verificar respostas 4 e a nota final) |
| Nota "jogaria o próximo" | média ≥ 8 |

Registre o resultado em `content/cases/<caso>/SPOILERS/playtests.md` (data, dupla, cenário,
métricas, observações, ajustes decididos). Ajustes de conteúdo exigem nova `version` do caso.
