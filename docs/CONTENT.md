# Como criar e versionar casos

Guia para autores de conteúdo. **Sem spoilers aqui**: os exemplos são genéricos.

## Estrutura de um caso

```
content/
  seasons/season-01.yaml        catálogo público (título, sinopse, capa, requisitos)
  cases/case-NNN/
    case.yaml                   papéis, introdução, capítulos, eventos, relatório, resolução
    evidence.yaml               evidências
    puzzles.yaml                enigmas
    SPOILERS/roteiro.md         documento de produção (verdade, cronologia, pistas, soluções)
```

O caso precisa existir no catálogo da temporada com o mesmo `id` (`case-NNN`).

## Conceitos

| Conceito | O que é |
|---|---|
| Papéis `A` e `B` | Duas perspectivas, cada uma com nome, resumo e briefing. Quem abre a investigação escolhe; o parceiro fica com a outra. |
| Capítulo (`ch.*`) | Etapa narrativa. O primeiro é o inicial; os outros começam via efeito `startChapter`. |
| Evidência (`ev.*`) | Conteúdo em blocos. `visibleTo: A | B | both`; `availableWhen` (condição); `share: full | none`. |
| Enigma (`pz.*`) | `code`, `sequence` ou `match`. Tem enunciado por papel, dicas por papel, `requires` por papel, resposta e efeitos `onSolve`. |
| Evento (`evt.*`) | Disparado automaticamente (uma vez) quando `when` fica verdadeiro. |
| Flag (`fl.*`) | Marcador definido por efeitos e usado em condições. |
| Decisão (`dc.*`) | `individual` (com `role`) ou `joint`. Opções com `outcome` (texto da consequência) e `effects`. |
| Relatório | Perguntas `single`/`multiple` com gabarito, peso e explicação; vereditos `closed`/`partial`/`archived` por pontuação. |

### Condições (dados, nunca código)

```yaml
availableWhen: { always: true }
availableWhen: { chapterReached: ch.segundo }
availableWhen: { puzzleSolved: pz.cofre }
availableWhen: { flag: fl.porta-aberta }
availableWhen: { evidenceSeen: { id: ev.carta, by: both } }   # A | B | any | both
availableWhen: { all: [ { puzzleSolved: pz.a }, { not: { flag: fl.b } } ] }
availableWhen: { decisionMade: { id: dc.denunciar, option: agora } }   # option é opcional
availableWhen: { any: [ ... ] }
```

### Efeitos

```yaml
onSolve:
  - startChapter: ch.segundo
  - setFlag: fl.porta-aberta
  - notify: { to: both, text: "Algo mudou." }   # to: A | B | both
```

### Blocos de evidência

`text`, `heading`, `handwriting` (com `note` opcional), `quote` (com `speaker`), `fields`
(`items: [{label, value}]`), `table` (`columns`, `rows`, `caption`), `list`, `stamp`.

### Tipos de enigma

```yaml
- id: pz.cofre
  type: code
  inputLabel: Senha de 4 dígitos
  answer: { accepted: ["1234"] }        # normaliza maiúsculas, acentos, espaços e pontuação

- id: pz.ordem
  type: sequence
  items: [{ id: a, label: "..." }, ...]
  answer: { order: [a, b, c] }          # o jogador vê quantos itens estão na posição certa

- id: pz.quem
  type: match
  left: [{ id: x, label: "..." }, ...]
  options: [{ id: o1, label: "..." }, ...]
  answer: { pairs: { x: o1, ... } }

- id: pz.mentiras
  type: contradiction                   # cada papel marca as próprias; avaliação conjunta
  statements:
    - { id: a1, source: "Testemunha", label: "...", visibleTo: A }
    - { id: b1, source: "Outra", label: "...", visibleTo: B }
  answer: { inconsistent: [a1] }

- id: pz.eclusa
  type: mechanism                       # ordem alternada; erro volta ao início
  controls: { A: [{ id: v1, label: "Válvula 1" }], B: [{ id: c1, label: "Comporta 1" }] }
  answer: { steps: [{ role: A, control: v1 }, { role: B, control: c1 }, ...] }
```

### Decisões

```yaml
decisions:
  - id: dc.denunciar
    kind: joint                         # ou: kind: individual + role: A
    title: Chamar a polícia agora?
    prompt: "..."
    availableWhen: { puzzleSolved: pz.eclusa }
    options:
      - { id: agora, label: Agora, outcome: "O que acontece.", effects: [{ setFlag: fl.policia }] }
      - { id: esperar, label: Esperar, outcome: "O que acontece.", effects: [] }
```

Evite escolhas decorativas: toda opção precisa de uma consequência perceptível (`outcome`) e,
idealmente, de efeitos que mudem o que vem depois.

Todo enigma declara `requires: { A: [...], B: [...] }`. **Regra de cooperação**: cada lado
precisa citar pelo menos uma evidência exclusiva dele — senão o validador recusa o caso.

## Validação

```bash
npm run content:check     # schema + referências + simulação (não grava nada)
npm test                  # inclui testes de coerência de todos os casos
```

O validador recusa:
- campos desconhecidos (erros de digitação) e ids duplicados;
- referências a evidências, enigmas, capítulos ou flags inexistentes;
- enigma que depende de si mesmo, que nunca fica disponível ou que um jogador resolve sozinho;
- enigma disponível antes de as evidências exigidas estarem acessíveis (injusto);
- evidência que nunca fica acessível;
- resposta definida que o próprio motor não aceita;
- gabarito que não chega ao veredito `closed` com 100 pontos.

O simulador joga o caso pelo caminho ideal (os dois leem tudo, resolvem os enigmas e enviam
o gabarito). Se ele não terminar, o caso não é publicado.

## Publicação e versionamento

```bash
npm run content:import
```

- Cada `version` de um caso é **imutável** no banco (`case_versions`), identificada por hash do conteúdo.
- Mudou qualquer coisa? Incremente `version` em `case.yaml`. Se o hash mudar sem mudar a
  versão, o importador recusa.
- Investigações em andamento continuam na versão em que começaram; novas investigações usam a mais recente.
- No ambiente local, `npm run db:reset` recria o banco e reimporta tudo (útil enquanto um caso está em produção).

## Boas práticas de design

- Pistas que **não dá para ditar**: tabelas, descrições, horários a cruzar — o jogador precisa interpretar.
- Entradas de enigma com `share: none`; contexto (depoimentos, documentos) pode ser `share: full`.
- Equilibre a leitura entre os papéis (o teste de coerência alerta diferenças maiores que 2 evidências).
- Dicas em três degraus: onde olhar → o que cruzar → quase lá, sem entregar a resposta.
- Toda revelação precisa de evidência que a sustente; registre isso no roteiro em `SPOILERS/`.
