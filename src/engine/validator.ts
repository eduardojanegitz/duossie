import { evidenceAccessible, evidenceUnlocked, puzzleAvailable, theoryAvailable } from "./availability";
import { conditionRefs } from "./conditions";
import { solutionOf } from "./puzzles";
import { reduce, type GameAction } from "./reducer";
import { caseDefinitionSchema, ROLES, type CaseDefinition, type Condition, type Effect, type Role } from "./schema";
import { initialState, type SessionState } from "./state";

export type ValidationReport = { errors: string[]; warnings: string[] };

/**
 * Validação completa de um caso:
 *  1. schema (Zod);
 *  2. identificadores únicos e referências válidas;
 *  3. regras de enigma (respostas coerentes, cooperação entre papéis, dicas);
 *  4. simulação do caminho de solução: o caso precisa terminar com veredito máximo,
 *     toda evidência precisa ficar acessível e cada enigma precisa ter suas
 *     evidências liberadas antes de ser resolvido (justiça).
 */
export function validateCase(input: unknown): ValidationReport & { definition?: CaseDefinition } {
  const parsed = caseDefinitionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      errors: parsed.error.issues.map((i) => `schema: ${i.path.join(".") || "(raiz)"} — ${i.message}`),
      warnings: [],
    };
  }
  const def = parsed.data;
  const report = staticChecks(def);
  if (report.errors.length === 0) {
    const sim = simulateSolution(def);
    report.errors.push(...sim.errors);
    report.warnings.push(...sim.warnings);
  }
  return { ...report, definition: def };
}

function staticChecks(def: CaseDefinition): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const ids = [
    ...def.chapters.map((c) => c.id),
    ...def.evidence.map((e) => e.id),
    ...def.puzzles.map((p) => p.id),
    ...def.events.map((e) => e.id),
    ...def.theory.questions.map((q) => q.id),
  ];
  const seenIds = new Set<string>();
  for (const id of ids) {
    if (seenIds.has(id)) errors.push(`id duplicado: ${id}`);
    seenIds.add(id);
  }

  const evidence = new Map(def.evidence.map((e) => [e.id, e]));
  const puzzles = new Set(def.puzzles.map((p) => p.id));
  const chapters = new Set(def.chapters.map((c) => c.id));
  const allEffects: Effect[] = [...def.puzzles.flatMap((p) => p.onSolve), ...def.events.flatMap((e) => e.effects)];
  const settableFlags = new Set(allEffects.flatMap((e) => ("setFlag" in e ? [e.setFlag] : [])));

  const checkCondition = (where: string, c: Condition | undefined) => {
    const refs = conditionRefs(c);
    for (const f of refs.flags) if (!settableFlags.has(f)) errors.push(`${where}: flag ${f} nunca é definida`);
    for (const p of refs.puzzles) if (!puzzles.has(p)) errors.push(`${where}: enigma inexistente ${p}`);
    for (const ch of refs.chapters) if (!chapters.has(ch)) errors.push(`${where}: capítulo inexistente ${ch}`);
    for (const e of refs.evidence) if (!evidence.has(e)) errors.push(`${where}: evidência inexistente ${e}`);
  };
  const checkEffects = (where: string, effects: readonly Effect[]) => {
    for (const e of effects) {
      if ("startChapter" in e && !chapters.has(e.startChapter)) errors.push(`${where}: capítulo inexistente ${e.startChapter}`);
    }
  };

  for (const ev of def.evidence) {
    checkCondition(ev.id, ev.availableWhen);
    if (ev.visibleTo === "both" && ev.share === "full") warnings.push(`${ev.id}: já é dos dois; share=full não tem efeito`);
  }
  for (const e of def.events) {
    checkCondition(e.id, e.when);
    checkEffects(e.id, e.effects);
  }
  checkCondition("theory", def.theory.availableWhen);

  for (const p of def.puzzles) {
    checkCondition(p.id, p.availableWhen);
    checkEffects(p.id, p.onSolve);
    if (conditionRefs(p.availableWhen).puzzles.includes(p.id)) errors.push(`${p.id}: depende de si mesmo`);

    for (const role of ROLES) {
      for (const evId of p.requires[role]) {
        const ev = evidence.get(evId);
        if (!ev) errors.push(`${p.id}: requires.${role} cita evidência inexistente ${evId}`);
        else if (ev.visibleTo !== role && ev.visibleTo !== "both") {
          errors.push(`${p.id}: requires.${role} cita ${evId}, que não é visível para ${role}`);
        }
      }
      if (p.hints[role].length === 0) warnings.push(`${p.id}: papel ${role} não tem dicas`);
    }
    // Regra de cooperação: cada lado precisa contribuir com algo exclusivo.
    const exclusive = (role: Role) => p.requires[role].some((id) => evidence.get(id)?.visibleTo === role);
    if (!exclusive("A") || !exclusive("B")) {
      errors.push(`${p.id}: enigma cooperativo precisa de evidência exclusiva dos dois papéis em requires`);
    }

    if (p.type === "sequence") {
      const itemIds = p.items.map((i) => i.id);
      const order = p.answer.order;
      if (order.length !== itemIds.length || !itemIds.every((i) => order.includes(i))) {
        errors.push(`${p.id}: answer.order precisa ser uma permutação dos itens`);
      }
    }
    if (p.type === "match") {
      const left = p.left.map((l) => l.id);
      const options = new Set(p.options.map((o) => o.id));
      const keys = Object.keys(p.answer.pairs);
      if (keys.length !== left.length || !left.every((l) => keys.includes(l))) {
        errors.push(`${p.id}: answer.pairs precisa ter uma chave para cada item de left`);
      }
      for (const v of Object.values(p.answer.pairs)) if (!options.has(v)) errors.push(`${p.id}: opção inexistente ${v}`);
    }
  }

  for (const q of def.theory.questions) {
    const options = new Set(q.options.map((o) => o.id));
    for (const c of q.correct) if (!options.has(c)) errors.push(`${q.id}: resposta correta inexistente ${c}`);
  }
  if (!def.theory.verdicts.some((v) => v.minScore === 0)) errors.push("theory: é preciso um veredito com minScore 0");
  if (!def.theory.verdicts.some((v) => v.id === "closed")) errors.push("theory: falta o veredito 'closed'");

  return { errors, warnings };
}

export type SimulationResult = ValidationReport & { finalState?: SessionState; steps: number };

/**
 * Joga o caso pelo caminho ideal: os dois papéis leem tudo o que está acessível,
 * resolvem os enigmas disponíveis e enviam o relatório correto.
 */
export function simulateSolution(def: CaseDefinition, now = "2026-01-01T00:00:00.000Z"): SimulationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let state = initialState(def);
  let steps = 0;

  const act = (role: Role, action: GameAction) => {
    const result = reduce(def, state, role, action, now);
    steps++;
    if (!result.ok) throw new Error(`${role} ${action.type}: ${result.error}`);
    state = result.state;
    return result;
  };

  const everAccessible = { A: new Set<string>(), B: new Set<string>() };

  try {
    for (let round = 0; round < def.puzzles.length + 5; round++) {
      // Lê tudo o que está acessível.
      for (const role of ROLES) {
        for (const ev of def.evidence) {
          if (evidenceAccessible(ev, state, role)) {
            everAccessible[role].add(ev.id);
            if (!state.seen[role].includes(ev.id)) act(role, { type: "view_evidence", evidenceId: ev.id });
          }
        }
      }
      const open = def.puzzles.filter((p) => puzzleAvailable(p, state) && !(p.id in state.solved));
      if (open.length === 0) break;
      // Justiça: confere as evidências de TODOS os enigmas abertos antes de resolver qualquer um.
      for (const p of open) {
        for (const role of ROLES) {
          for (const evId of p.requires[role]) {
            const ev = def.evidence.find((e) => e.id === evId)!;
            if (!evidenceAccessible(ev, state, role)) {
              errors.push(`${p.id}: disponível antes de ${role} ter acesso a ${evId} (enigma injusto)`);
            }
          }
        }
      }
      for (const p of open) {
        const result = act("A", { type: "attempt_puzzle", puzzleId: p.id, answer: solutionOf(p) });
        if (!(result.outcome.kind === "puzzle" && result.outcome.correct)) {
          errors.push(`${p.id}: a resposta definida não foi aceita pelo validador de respostas`);
        }
      }
    }

    const unsolved = def.puzzles.filter((p) => !(p.id in state.solved));
    for (const p of unsolved) errors.push(`${p.id}: nunca fica disponível no caminho de solução`);

    for (const ev of def.evidence) {
      const roles: Role[] = ev.visibleTo === "both" ? ["A", "B"] : [ev.visibleTo];
      for (const role of roles) {
        if (!everAccessible[role].has(ev.id) && !evidenceUnlocked(ev, state)) {
          errors.push(`${ev.id}: nunca fica acessível para ${role}`);
        }
      }
    }

    if (!theoryAvailable(def, state)) {
      errors.push("theory: o relatório final não fica disponível depois de todos os enigmas");
    } else {
      const answers = Object.fromEntries(def.theory.questions.map((q) => [q.id, [...q.correct]]));
      act("A", { type: "propose_theory", answers });
      const result = act("B", { type: "confirm_theory" });
      if (result.outcome.kind !== "theory_submitted" || result.outcome.verdictId !== "closed" || result.outcome.score !== 100) {
        errors.push("theory: o gabarito não produz o veredito 'closed' com 100 pontos");
      }
    }
  } catch (error) {
    errors.push(`simulação interrompida: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { errors, warnings, finalState: state, steps };
}
