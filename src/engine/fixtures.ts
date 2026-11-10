import { caseDefinitionSchema, type CaseDefinition, type CaseDefinitionInput } from "./schema";

/** Caso sintético mínimo usado só em testes do motor. */
export const miniCaseInput: CaseDefinitionInput = {
  id: "case-900",
  version: 1,
  title: "Caso de teste",
  roles: {
    A: { name: "Arquivo", tagline: "documentos", briefing: "Você vê documentos." },
    B: { name: "Campo", tagline: "objetos", briefing: "Você vê objetos." },
  },
  intro: "Introdução.",
  chapters: [
    { id: "ch.um", title: "Um", intro: "Começo." },
    { id: "ch.dois", title: "Dois", intro: "Depois do cofre." },
  ],
  evidence: [
    { id: "ev.comum", title: "Bilhete", kind: "document", visibleTo: "both", summary: "Comum", body: [{ type: "text", text: "olá" }] },
    { id: "ev.ordem", title: "Ordem", kind: "document", visibleTo: "A", share: "full", summary: "Ordem dos símbolos", body: [{ type: "text", text: "△ ○" }] },
    { id: "ev.valores", title: "Valores", kind: "object", visibleTo: "B", summary: "Valores", body: [{ type: "text", text: "△=4 ○=2" }] },
    {
      id: "ev.segredo",
      title: "Segredo",
      kind: "document",
      visibleTo: "B",
      availableWhen: { chapterReached: "ch.dois" },
      summary: "Só no capítulo dois",
      body: [{ type: "text", text: "segredo" }],
    },
  ],
  puzzles: [
    {
      id: "pz.cofre",
      type: "code",
      title: "Cofre",
      inputLabel: "2 dígitos",
      prompt: { A: "Você tem a ordem.", B: "Você tem os valores." },
      requires: { A: ["ev.ordem"], B: ["ev.valores"] },
      hints: { A: [{ text: "Pergunte os valores." }, { text: "Combine na ordem." }], B: [{ text: "Pergunte a ordem." }] },
      answer: { accepted: ["42"] },
      onSolve: [{ startChapter: "ch.dois" }, { setFlag: "fl.cofre-aberto" }],
      solvedText: "O cofre abriu.",
    },
    {
      id: "pz.fila",
      type: "sequence",
      title: "Fila",
      availableWhen: { puzzleSolved: "pz.cofre" },
      prompt: { A: "Ordene.", B: "Ordene." },
      requires: { A: ["ev.ordem"], B: ["ev.segredo"] },
      hints: { A: [{ text: "Dica x" }], B: [{ text: "Dica y" }] },
      items: [
        { id: "a", label: "Primeiro" },
        { id: "b", label: "Segundo" },
        { id: "c", label: "Terceiro" },
      ],
      answer: { order: ["a", "b", "c"] },
      solvedText: "Ordem confirmada.",
    },
  ],
  events: [
    { id: "evt.aviso", when: { flag: "fl.cofre-aberto" }, effects: [{ notify: { to: "B", text: "Algo mudou no campo." } }] },
  ],
  theory: {
    availableWhen: { puzzleSolved: "pz.fila" },
    intro: "Relatório.",
    questions: [
      {
        id: "q.quem",
        prompt: "Quem?",
        kind: "single",
        options: [
          { id: "x", label: "X" },
          { id: "y", label: "Y" },
        ],
        correct: ["x"],
        explanation: "Foi X.",
      },
      {
        id: "q.provas",
        prompt: "Provas?",
        kind: "multiple",
        options: [
          { id: "p1", label: "P1" },
          { id: "p2", label: "P2" },
          { id: "p3", label: "P3" },
        ],
        correct: ["p1", "p2"],
        explanation: "P1 e P2.",
      },
    ],
    verdicts: [
      { id: "closed", minScore: 85, title: "Encerrado", text: "Tudo certo." },
      { id: "partial", minScore: 50, title: "Parcial", text: "Quase." },
      { id: "archived", minScore: 0, title: "Arquivado", text: "Não." },
    ],
  },
  resolution: { summary: "Resumo.", overlooked: ["Detalhe."], epilogue: "Fim." },
};

export function miniCase(): CaseDefinition {
  return caseDefinitionSchema.parse(structuredClone(miniCaseInput));
}

/** Caso sintético com contradições, mecanismo e decisões. */
export const coopCaseInput: CaseDefinitionInput = {
  ...structuredClone(miniCaseInput),
  id: "case-901",
  events: [],
  evidence: [
    ...structuredClone(miniCaseInput.evidence),
    { id: "ev.relato-a", title: "Relato A", kind: "testimony", visibleTo: "A", summary: "Relato de Ana", body: [{ type: "text", text: "Ana fala." }] },
    { id: "ev.relato-b", title: "Relato B", kind: "testimony", visibleTo: "B", summary: "Relato de Beto", body: [{ type: "text", text: "Beto fala." }] },
  ],
  puzzles: [
    {
      id: "pz.mentiras",
      type: "contradiction",
      title: "Mentiras",
      prompt: { A: "Marque as suas.", B: "Marque as suas." },
      requires: { A: ["ev.relato-a"], B: ["ev.relato-b"] },
      hints: { A: [{ text: "Compare." }], B: [{ text: "Compare." }] },
      statements: [
        { id: "a1", source: "Ana", label: "Estava em casa.", visibleTo: "A" },
        { id: "a2", source: "Ana", label: "Ouviu o alarme.", visibleTo: "A" },
        { id: "b1", source: "Beto", label: "Viu Ana na rua.", visibleTo: "B" },
        { id: "b2", source: "Beto", label: "Chovia.", visibleTo: "B" },
      ],
      answer: { inconsistent: ["a1", "b2"] },
      onSolve: [{ startChapter: "ch.dois" }],
      solvedText: "As mentiras caíram.",
    },
    {
      id: "pz.eclusa",
      type: "mechanism",
      title: "Eclusa",
      availableWhen: { puzzleSolved: "pz.mentiras" },
      prompt: { A: "Você tem as válvulas.", B: "Você tem as comportas." },
      requires: { A: ["ev.ordem"], B: ["ev.valores"] },
      hints: { A: [{ text: "Alternem." }], B: [{ text: "Alternem." }] },
      controls: { A: [{ id: "v1", label: "Válvula 1" }, { id: "v2", label: "Válvula 2" }], B: [{ id: "c1", label: "Comporta 1" }] },
      answer: {
        steps: [
          { role: "A", control: "v1" },
          { role: "B", control: "c1" },
          { role: "A", control: "v2" },
        ],
      },
      onSolve: [{ setFlag: "fl.eclusa" }],
      solvedText: "A água baixou.",
    },
  ],
  decisions: [
    {
      id: "dc.denunciar",
      kind: "joint",
      title: "Denunciar agora?",
      prompt: "Vocês chamam a polícia agora ou esperam?",
      availableWhen: { flag: "fl.eclusa" },
      options: [
        { id: "agora", label: "Agora", outcome: "A polícia chegou a tempo.", effects: [{ setFlag: "fl.policia" }] },
        { id: "esperar", label: "Esperar", outcome: "O suspeito fugiu.", effects: [] },
      ],
    },
    {
      id: "dc.segredo",
      kind: "individual",
      role: "B",
      title: "Guardar a carta?",
      prompt: "Só você viu a carta.",
      options: [
        { id: "guardar", label: "Guardar", outcome: "Você guardou a carta.", effects: [] },
        { id: "rasgar", label: "Rasgar", outcome: "A carta virou pó.", effects: [] },
      ],
    },
  ],
  theory: { ...structuredClone(miniCaseInput.theory), availableWhen: { decisionMade: { id: "dc.denunciar" } } },
};
