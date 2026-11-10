import { describe, expect, it } from "vitest";
import { coopCaseInput as coopInput } from "./fixtures";
import { projectView } from "./projection";
import { reduce, type GameAction } from "./reducer";
import { caseDefinitionSchema, type Role } from "./schema";
import { initialState, type SessionState } from "./state";
import { simulateSolution, validateCase } from "./validator";

const NOW = "2026-01-01T00:00:00.000Z";

const def = caseDefinitionSchema.parse(coopInput);

function run(state: SessionState, role: Role, action: GameAction) {
  const r = reduce(def, state, role, action, NOW);
  if (!r.ok) throw new Error(r.error);
  return r;
}

function solveMentiras(s = initialState(def)) {
  s = run(s, "A", { type: "attempt_puzzle", puzzleId: "pz.mentiras", answer: { flags: ["a1"] } }).state;
  return run(s, "B", { type: "attempt_puzzle", puzzleId: "pz.mentiras", answer: { flags: ["b2"] } }).state;
}

function solveEclusa(s = solveMentiras()) {
  s = run(s, "A", { type: "operate_mechanism", puzzleId: "pz.eclusa", control: "v1" }).state;
  s = run(s, "B", { type: "operate_mechanism", puzzleId: "pz.eclusa", control: "c1" }).state;
  return run(s, "A", { type: "operate_mechanism", puzzleId: "pz.eclusa", control: "v2" }).state;
}

describe("enigma de contradições", () => {
  it("cada papel vê só as próprias afirmações", () => {
    const view = projectView(def, initialState(def), "A");
    const p = view.puzzles.find((x) => x.id === "pz.mentiras");
    expect(p?.type === "contradiction" && p.statements.map((s) => s.id)).toEqual(["a1", "a2"]);
    expect(JSON.stringify(view)).not.toContain("Chovia.");
  });

  it("não aceita marcar afirmação do parceiro", () => {
    expect(reduce(def, initialState(def), "A", { type: "attempt_puzzle", puzzleId: "pz.mentiras", answer: { flags: ["b2"] } }, NOW)).toEqual({
      ok: false,
      error: "invalid_answer",
    });
  });

  it("espera as duas partes e avalia juntas", () => {
    const first = run(initialState(def), "A", { type: "attempt_puzzle", puzzleId: "pz.mentiras", answer: { flags: ["a1"] } });
    expect(first.outcome).toEqual({ kind: "part_submitted" });
    const viewB = projectView(def, first.state, "B").puzzles.find((x) => x.id === "pz.mentiras");
    expect(viewB?.type === "contradiction" && viewB.partnerSubmitted).toBe(true);
    // O parceiro não vê QUAIS afirmações foram marcadas.
    expect(JSON.stringify(viewB)).not.toContain("a1");
    const second = run(first.state, "B", { type: "attempt_puzzle", puzzleId: "pz.mentiras", answer: { flags: ["b2"] } });
    expect(second.outcome).toMatchObject({ kind: "puzzle", correct: true });
  });

  it("erro conjunto informa quantas foram classificadas certo e libera nova tentativa", () => {
    let s = run(initialState(def), "A", { type: "attempt_puzzle", puzzleId: "pz.mentiras", answer: { flags: ["a1", "a2"] } }).state;
    const r = run(s, "B", { type: "attempt_puzzle", puzzleId: "pz.mentiras", answer: { flags: [] } });
    expect(r.outcome).toEqual({ kind: "puzzle", correct: false, partial: 2, total: 4 });
    s = r.state;
    expect(s.parts["pz.mentiras"]).toBeUndefined();
    expect(solveMentiras(s).solved["pz.mentiras"]).toBeDefined();
  });
});

describe("enigma de mecanismo", () => {
  it("cada papel só aciona os próprios comandos", () => {
    expect(reduce(def, solveMentiras(), "B", { type: "operate_mechanism", puzzleId: "pz.eclusa", control: "v1" }, NOW)).toEqual({
      ok: false,
      error: "not_your_control",
    });
  });

  it("comando fora de ordem trava e volta ao início, avisando os dois", () => {
    let s = run(solveMentiras(), "A", { type: "operate_mechanism", puzzleId: "pz.eclusa", control: "v1" }).state;
    const r = run(s, "A", { type: "operate_mechanism", puzzleId: "pz.eclusa", control: "v2" });
    expect(r.outcome).toEqual({ kind: "mechanism", ok: false, progress: 0, total: 3, solved: false });
    s = r.state;
    expect(projectView(def, s, "B").feed.at(-1)?.label).toBe("Seu parceiro travou o mecanismo — ele voltou ao início em: Eclusa");
  });

  it("ordem certa, alternando os papéis, resolve", () => {
    const s = solveEclusa();
    expect(s.solved["pz.eclusa"]).toBeDefined();
    expect(s.flags).toContain("fl.eclusa");
  });
});

describe("decisões", () => {
  it("decisão conjunta exige a mesma escolha dos dois; discordância não decide sozinha", () => {
    let s = solveEclusa();
    s = run(s, "A", { type: "vote_decision", decisionId: "dc.denunciar", optionId: "agora" }).state;
    s = run(s, "B", { type: "vote_decision", decisionId: "dc.denunciar", optionId: "esperar" }).state;
    expect(s.decisions["dc.denunciar"]?.resolved).toBeUndefined();
    const viewA = projectView(def, s, "A").decisions.find((d) => d.id === "dc.denunciar");
    expect(viewA).toMatchObject({ myVote: "agora", partnerVote: "esperar", resolved: null });
    // Revisão: A muda de ideia e os dois concordam.
    const r = run(s, "A", { type: "vote_decision", decisionId: "dc.denunciar", optionId: "esperar" });
    expect(r.outcome).toEqual({ kind: "decision", resolved: true });
    expect(projectView(def, r.state, "B").decisions.find((d) => d.id === "dc.denunciar")?.resolved).toEqual({
      optionId: "esperar",
      outcome: "O suspeito fugiu.",
    });
    expect(reduce(def, r.state, "B", { type: "vote_decision", decisionId: "dc.denunciar", optionId: "agora" }, NOW)).toEqual({
      ok: false,
      error: "decision_resolved",
    });
  });

  it("a consequência aplica efeitos e libera o que depende da decisão", () => {
    let s = solveEclusa();
    s = run(s, "A", { type: "vote_decision", decisionId: "dc.denunciar", optionId: "agora" }).state;
    s = run(s, "B", { type: "vote_decision", decisionId: "dc.denunciar", optionId: "agora" }).state;
    expect(s.flags).toContain("fl.policia");
    expect(projectView(def, s, "A").theory.available).toBe(true);
  });

  it("decisão individual é só de um papel e invisível para o outro", () => {
    const s = initialState(def);
    expect(projectView(def, s, "A").decisions.map((d) => d.id)).not.toContain("dc.segredo");
    expect(reduce(def, s, "A", { type: "vote_decision", decisionId: "dc.segredo", optionId: "guardar" }, NOW)).toEqual({
      ok: false,
      error: "unknown_decision",
    });
    const r = run(s, "B", { type: "vote_decision", decisionId: "dc.segredo", optionId: "rasgar" });
    expect(r.state.decisions["dc.segredo"]?.resolved).toBe("rasgar");
    expect(projectView(def, r.state, "A").feed.some((f) => f.label.includes("carta"))).toBe(false);
  });

  it("decisão indisponível é recusada", () => {
    expect(reduce(def, initialState(def), "A", { type: "vote_decision", decisionId: "dc.denunciar", optionId: "agora" }, NOW)).toEqual({
      ok: false,
      error: "decision_unavailable",
    });
  });
});

describe("validador com as novas regras", () => {
  it("o caso cooperativo é válido e simulável até o fim", () => {
    expect(validateCase(coopInput).errors).toEqual([]);
    expect(simulateSolution(def).finalState?.status).toBe("completed");
  });

  it("recusa mecanismo de um papel só e passos com comando alheio", () => {
    const bad = structuredClone(coopInput);
    const eclusa = bad.puzzles[1]!;
    if (eclusa.type !== "mechanism") throw new Error("fixture");
    eclusa.answer.steps = [
      { role: "A", control: "v1" },
      { role: "A", control: "v2" },
      { role: "A", control: "c1" },
    ];
    const { errors } = validateCase(bad);
    expect(errors).toContain("pz.eclusa: passo usa comando c1, que não é do papel A");
    expect(errors).toContain("pz.eclusa: o mecanismo precisa de passos dos dois papéis");
  });

  it("recusa condição com decisão ou opção inexistente", () => {
    const bad = structuredClone(coopInput);
    bad.theory.availableWhen = { decisionMade: { id: "dc.denunciar", option: "talvez" } };
    expect(validateCase(bad).errors).toContain("theory: opção inexistente dc.denunciar/talvez");
  });

  it("sessões antigas (sem os campos novos) continuam funcionando", () => {
    const old = initialState(def) as Partial<SessionState>;
    delete old.parts;
    delete old.mechanisms;
    delete old.decisions;
    const r = reduce(def, old as SessionState, "A", { type: "view_evidence", evidenceId: "ev.comum" }, NOW);
    expect(r.ok).toBe(true);
    expect(() => projectView(def, old as SessionState, "B")).not.toThrow();
  });
});
