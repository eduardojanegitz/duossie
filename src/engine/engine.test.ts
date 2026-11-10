import { describe, expect, it } from "vitest";
import { evaluate } from "./conditions";
import { miniCase, miniCaseInput } from "./fixtures";
import { normalizeCode } from "./puzzles";
import { projectView } from "./projection";
import { reduce, type GameAction } from "./reducer";
import type { Role } from "./schema";
import { initialState, type SessionState } from "./state";
import { scoreQuestion } from "./theory";
import { simulateSolution, validateCase } from "./validator";

const NOW = "2026-01-01T00:00:00.000Z";
const def = miniCase();

function run(state: SessionState, role: Role, action: GameAction) {
  const result = reduce(def, state, role, action, NOW);
  if (!result.ok) throw new Error(result.error);
  return result;
}

function solveCofre(state = initialState(def)) {
  return run(state, "A", { type: "attempt_puzzle", puzzleId: "pz.cofre", answer: { code: "4-2" } }).state;
}

describe("condições", () => {
  const s = initialState(def);
  it("combina all/any/not", () => {
    expect(evaluate({ all: [{ always: true }, { not: { flag: "fl.x" } }] }, s)).toBe(true);
    expect(evaluate({ any: [{ flag: "fl.x" }, { chapterReached: "ch.um" }] }, s)).toBe(true);
    expect(evaluate({ puzzleSolved: "pz.cofre" }, s)).toBe(false);
  });
  it("evidenceSeen respeita quem viu", () => {
    const seen = { ...s, seen: { A: ["ev.comum"], B: [] } };
    expect(evaluate({ evidenceSeen: { id: "ev.comum", by: "A" } }, seen)).toBe(true);
    expect(evaluate({ evidenceSeen: { id: "ev.comum", by: "both" } }, seen)).toBe(false);
    expect(evaluate({ evidenceSeen: { id: "ev.comum", by: "any" } }, seen)).toBe(true);
  });
});

describe("informação assimétrica", () => {
  it("cada papel vê só o que é seu (e o comum)", () => {
    const s = initialState(def);
    expect(projectView(def, s, "A").evidence.map((e) => e.id).sort()).toEqual(["ev.comum", "ev.ordem"]);
    expect(projectView(def, s, "B").evidence.map((e) => e.id).sort()).toEqual(["ev.comum", "ev.valores"]);
  });

  it("a projeção não carrega respostas, nem o enunciado do outro papel", () => {
    const json = JSON.stringify(projectView(def, initialState(def), "A"));
    expect(json).not.toContain("42");
    expect(json).not.toContain("Você tem os valores.");
    expect(json).not.toContain("△=4");
    expect(json).not.toContain("Foi X.");
  });

  it("não deixa ver evidência alheia nem bloqueada", () => {
    const s = initialState(def);
    expect(reduce(def, s, "A", { type: "view_evidence", evidenceId: "ev.valores" }, NOW)).toEqual({ ok: false, error: "evidence_unavailable" });
    expect(reduce(def, s, "B", { type: "view_evidence", evidenceId: "ev.segredo" }, NOW)).toEqual({ ok: false, error: "evidence_unavailable" });
  });

  it("compartilhar é explícito e só vale para evidências permitidas", () => {
    const s = initialState(def);
    expect(reduce(def, s, "B", { type: "share_evidence", evidenceId: "ev.valores" }, NOW)).toEqual({ ok: false, error: "not_shareable" });
    expect(reduce(def, s, "B", { type: "share_evidence", evidenceId: "ev.ordem" }, NOW)).toEqual({ ok: false, error: "not_shareable" });
    const shared = run(s, "A", { type: "share_evidence", evidenceId: "ev.ordem" }).state;
    const viewB = projectView(def, shared, "B");
    expect(viewB.evidence.find((e) => e.id === "ev.ordem")?.origin).toBe("shared");
    expect(viewB.feed.at(-1)?.label).toBe("Seu parceiro compartilhou: Ordem");
    expect(reduce(def, shared, "A", { type: "share_evidence", evidenceId: "ev.ordem" }, NOW)).toEqual({ ok: false, error: "already_shared" });
  });

  it("não muta o estado de entrada", () => {
    const s = initialState(def);
    const before = JSON.stringify(s);
    run(s, "A", { type: "view_evidence", evidenceId: "ev.comum" });
    expect(JSON.stringify(s)).toBe(before);
  });

  it("ver de novo a mesma evidência não altera nada (idempotente)", () => {
    const once = run(initialState(def), "A", { type: "view_evidence", evidenceId: "ev.comum" });
    const twice = run(once.state, "A", { type: "view_evidence", evidenceId: "ev.comum" });
    expect(twice.changed).toBe(false);
    expect(twice.state).toEqual(once.state);
  });
});

describe("enigmas e progressão", () => {
  it("normaliza códigos", () => {
    expect(normalizeCode(" 4-2 ")).toBe("42");
    expect(normalizeCode("ação")).toBe("ACAO");
  });

  it("resposta errada conta tentativa e não avança", () => {
    const r = run(initialState(def), "B", { type: "attempt_puzzle", puzzleId: "pz.cofre", answer: { code: "24" } });
    expect(r.outcome).toEqual({ kind: "puzzle", correct: false, partial: undefined, total: undefined });
    expect(r.state.attempts["pz.cofre"]).toBe(1);
    expect(r.state.chapter).toBe("ch.um");
  });

  it("formato incompatível é recusado sem contar tentativa", () => {
    expect(reduce(def, initialState(def), "A", { type: "attempt_puzzle", puzzleId: "pz.cofre", answer: { order: ["a"] } }, NOW)).toEqual({
      ok: false,
      error: "invalid_answer",
    });
  });

  it("acerto aplica efeitos, libera capítulo, evidência e dispara eventos", () => {
    const s = solveCofre();
    expect(s.chapter).toBe("ch.dois");
    expect(s.flags).toContain("fl.cofre-aberto");
    expect(projectView(def, s, "B").evidence.map((e) => e.id)).toContain("ev.segredo");
    expect(projectView(def, s, "B").feed.map((f) => f.label)).toContain("Algo mudou no campo.");
    expect(projectView(def, s, "A").feed.map((f) => f.label)).not.toContain("Algo mudou no campo.");
    expect(s.firedEvents).toEqual(["evt.aviso"]);
  });

  it("resolver de novo é recusado (proteção contra duplicidade)", () => {
    expect(reduce(def, solveCofre(), "B", { type: "attempt_puzzle", puzzleId: "pz.cofre", answer: { code: "42" } }, NOW)).toEqual({
      ok: false,
      error: "already_solved",
    });
  });

  it("enigma indisponível é recusado", () => {
    expect(reduce(def, initialState(def), "A", { type: "attempt_puzzle", puzzleId: "pz.fila", answer: { order: ["a", "b", "c"] } }, NOW)).toEqual({
      ok: false,
      error: "puzzle_unavailable",
    });
  });

  it("sequência informa quantos itens estão na posição certa", () => {
    const r = run(solveCofre(), "B", { type: "attempt_puzzle", puzzleId: "pz.fila", answer: { order: ["a", "c", "b"] } });
    expect(r.outcome).toEqual({ kind: "puzzle", correct: false, partial: 1, total: 3 });
  });

  it("dicas são graduais, por papel, e acabam", () => {
    let s = initialState(def);
    s = run(s, "A", { type: "request_hint", puzzleId: "pz.cofre" }).state;
    expect(projectView(def, s, "A").puzzles[0]?.hints).toEqual(["Pergunte os valores."]);
    expect(projectView(def, s, "B").puzzles[0]?.hints).toEqual([]);
    s = run(s, "A", { type: "request_hint", puzzleId: "pz.cofre" }).state;
    expect(reduce(def, s, "A", { type: "request_hint", puzzleId: "pz.cofre" }, NOW)).toEqual({ ok: false, error: "no_more_hints" });
  });
});

describe("relatório final", () => {
  function readyForTheory() {
    return run(solveCofre(), "A", { type: "attempt_puzzle", puzzleId: "pz.fila", answer: { order: ["a", "b", "c"] } }).state;
  }

  it("pontua múltipla escolha descontando erros", () => {
    const q = def.theory.questions[1]!;
    expect(scoreQuestion(q, ["p1", "p2"])).toBe(1);
    expect(scoreQuestion(q, ["p1"])).toBe(0.5);
    expect(scoreQuestion(q, ["p1", "p2", "p3"])).toBe(0.5);
    expect(scoreQuestion(q, ["p3"])).toBe(0);
  });

  it("exige proposta de um e confirmação do outro", () => {
    let s = readyForTheory();
    expect(reduce(def, s, "A", { type: "confirm_theory" }, NOW)).toEqual({ ok: false, error: "no_proposal" });
    s = run(s, "A", { type: "propose_theory", answers: { "q.quem": ["y"], "q.provas": ["p1"] } }).state;
    expect(reduce(def, s, "A", { type: "confirm_theory" }, NOW)).toEqual({ ok: false, error: "own_proposal" });
    const done = run(s, "B", { type: "confirm_theory" });
    expect(done.outcome).toEqual({ kind: "theory_submitted", score: 25, verdictId: "archived" });
    expect(done.state.status).toBe("completed");
    const view = projectView(def, done.state, "B");
    expect(view.theory.available && view.theory.resolution?.verdict.id).toBe("archived");
  });

  it("parceiro pode devolver para revisão sem decidir sozinho", () => {
    let s = readyForTheory();
    s = run(s, "A", { type: "propose_theory", answers: { "q.quem": ["x"], "q.provas": ["p1", "p2"] } }).state;
    s = run(s, "B", { type: "withdraw_theory" }).state;
    expect(s.theory.draft).toBeNull();
    expect(s.status).toBe("active");
  });

  it("respostas fora do formato são recusadas", () => {
    const s = readyForTheory();
    expect(reduce(def, s, "A", { type: "propose_theory", answers: { "q.quem": ["x", "y"], "q.provas": ["p1"] } }, NOW)).toEqual({
      ok: false,
      error: "invalid_theory",
    });
    expect(reduce(def, s, "A", { type: "propose_theory", answers: { "q.quem": ["x"] } }, NOW)).toEqual({ ok: false, error: "invalid_theory" });
  });

  it("caso concluído pode ser reaberto para buscar o final completo", () => {
    let s = readyForTheory();
    s = run(s, "A", { type: "propose_theory", answers: { "q.quem": ["x"], "q.provas": ["p1"] } }).state;
    s = run(s, "B", { type: "confirm_theory" }).state;
    expect(reduce(def, s, "A", { type: "attempt_puzzle", puzzleId: "pz.cofre", answer: { code: "1" } }, NOW)).toEqual({
      ok: false,
      error: "case_completed",
    });
    s = run(s, "A", { type: "reopen_theory" }).state;
    s = run(s, "A", { type: "propose_theory", answers: { "q.quem": ["x"], "q.provas": ["p1", "p2"] } }).state;
    const final = run(s, "B", { type: "confirm_theory" });
    expect(final.outcome).toMatchObject({ score: 100, verdictId: "closed" });
    expect(reduce(def, final.state, "A", { type: "reopen_theory" }, NOW)).toEqual({ ok: false, error: "cannot_reopen" });
  });
});

describe("validador", () => {
  it("o caso de teste é válido e o simulador chega ao veredito máximo", () => {
    expect(validateCase(miniCaseInput)).toMatchObject({ errors: [] });
    const sim = simulateSolution(def);
    expect(sim.errors).toEqual([]);
    expect(sim.finalState?.status).toBe("completed");
  });

  it("detecta referência inválida e flag nunca definida", () => {
    const bad = structuredClone(miniCaseInput);
    bad.evidence[3]!.availableWhen = { all: [{ puzzleSolved: "pz.fantasma" }, { flag: "fl.nunca" }] };
    const { errors } = validateCase(bad);
    expect(errors).toContain("ev.segredo: enigma inexistente pz.fantasma");
    expect(errors).toContain("ev.segredo: flag fl.nunca nunca é definida");
  });

  it("detecta enigma que um jogador resolveria sozinho", () => {
    const bad = structuredClone(miniCaseInput);
    bad.puzzles[0]!.requires = { A: ["ev.ordem"], B: ["ev.comum"] };
    expect(validateCase(bad).errors.some((e) => e.includes("pz.cofre: enigma cooperativo"))).toBe(true);
  });

  it("detecta dependência circular", () => {
    const bad = structuredClone(miniCaseInput);
    bad.puzzles[0]!.availableWhen = { puzzleSolved: "pz.fila" };
    const { errors } = validateCase(bad);
    expect(errors.some((e) => e.includes("nunca fica disponível"))).toBe(true);
  });

  it("detecta enigma liberado antes das evidências necessárias", () => {
    const bad = structuredClone(miniCaseInput);
    bad.puzzles[1]!.availableWhen = { always: true };
    bad.theory.availableWhen = { all: [{ puzzleSolved: "pz.fila" }, { puzzleSolved: "pz.cofre" }] };
    expect(validateCase(bad).errors.some((e) => e.includes("enigma injusto"))).toBe(true);
  });

  it("detecta gabarito que não fecha o caso", () => {
    const bad = structuredClone(miniCaseInput);
    bad.theory.verdicts = [{ id: "archived", minScore: 0, title: "Arquivado", text: "Sem conclusão." }];
    expect(validateCase(bad).errors).toContain("theory: falta o veredito 'closed'");
  });

  it("rejeita campos desconhecidos no schema", () => {
    const bad = { ...structuredClone(miniCaseInput), script: "alert(1)" };
    expect(validateCase(bad).errors[0]).toMatch(/^schema:/);
  });
});
