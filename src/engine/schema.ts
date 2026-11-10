/**
 * Schema da definição de um caso (conteúdo + regras). Validado por Zod na importação.
 * Nada aqui é executável: condições e efeitos são dados interpretados pelo motor.
 */
import { z } from "zod";

export const ROLES = ["A", "B"] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

const id = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}\\.[a-z0-9-]{2,40}$`), `use o formato ${prefix}.nome-em-kebab`);

export const evidenceId = id("ev");
export const puzzleId = id("pz");
export const chapterId = id("ch");
export const flagId = id("fl");
export const eventId = id("evt");
export const questionId = id("q");

// ---------------------------------------------------------------------------
// Condições (AST interpretada por `conditions.ts`)
// ---------------------------------------------------------------------------
export type Condition =
  | { always: true }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { flag: string }
  | { puzzleSolved: string }
  | { chapterReached: string }
  | { evidenceSeen: { id: string; by: "A" | "B" | "any" | "both" } };

export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ always: z.literal(true) }).strict(),
    z.object({ all: z.array(conditionSchema).min(1) }).strict(),
    z.object({ any: z.array(conditionSchema).min(1) }).strict(),
    z.object({ not: conditionSchema }).strict(),
    z.object({ flag: flagId }).strict(),
    z.object({ puzzleSolved: puzzleId }).strict(),
    z.object({ chapterReached: chapterId }).strict(),
    z
      .object({
        evidenceSeen: z.object({ id: evidenceId, by: z.enum(["A", "B", "any", "both"]) }).strict(),
      })
      .strict(),
  ]),
);

// ---------------------------------------------------------------------------
// Efeitos (lista fechada)
// ---------------------------------------------------------------------------
export const effectSchema = z.union([
  z.object({ setFlag: flagId }).strict(),
  z.object({ startChapter: chapterId }).strict(),
  z
    .object({
      notify: z.object({ to: z.enum(["A", "B", "both"]), text: z.string().min(2).max(400) }).strict(),
    })
    .strict(),
]);
export type Effect = z.infer<typeof effectSchema>;

// ---------------------------------------------------------------------------
// Conteúdo das evidências (blocos renderizados pelo cliente)
// ---------------------------------------------------------------------------
export const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().min(1) }).strict(),
  z.object({ type: z.literal("heading"), text: z.string().min(1) }).strict(),
  z.object({ type: z.literal("handwriting"), text: z.string().min(1), note: z.string().optional() }).strict(),
  z.object({ type: z.literal("quote"), speaker: z.string().optional(), text: z.string().min(1) }).strict(),
  z
    .object({
      type: z.literal("fields"),
      items: z.array(z.object({ label: z.string(), value: z.string() }).strict()).min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("table"),
      caption: z.string().optional(),
      columns: z.array(z.string()).min(1),
      rows: z.array(z.array(z.string())).min(1),
    })
    .strict()
    .refine((t) => t.rows.every((r) => r.length === t.columns.length), "toda linha precisa ter o número de colunas"),
  z.object({ type: z.literal("list"), items: z.array(z.string()).min(1) }).strict(),
  z.object({ type: z.literal("stamp"), text: z.string().min(1) }).strict(),
]);
export type Block = z.infer<typeof blockSchema>;

export const EVIDENCE_KINDS = ["document", "record", "photo", "object", "testimony", "message", "person"] as const;

export const evidenceSchema = z
  .object({
    id: evidenceId,
    title: z.string().min(2).max(80),
    kind: z.enum(EVIDENCE_KINDS),
    /** Quem pode ver: um papel ou os dois. */
    visibleTo: z.enum(["A", "B", "both"]),
    /** Quando fica disponível. Padrão: desde o início. */
    availableWhen: conditionSchema.optional(),
    /** `full`: pode ser enviada ao parceiro (cópia integral); `none`: exclusiva. */
    share: z.enum(["full", "none"]).default("none"),
    summary: z.string().min(2).max(200),
    body: z.array(blockSchema).min(1),
  })
  .strict();
export type Evidence = z.infer<typeof evidenceSchema>;

// ---------------------------------------------------------------------------
// Enigmas
// ---------------------------------------------------------------------------
const hintSchema = z.object({ text: z.string().min(2).max(400) }).strict();

const puzzleBase = {
  id: puzzleId,
  title: z.string().min(2).max(80),
  availableWhen: conditionSchema.optional(),
  /** Enunciado específico de cada papel (cada um vê uma parte). */
  prompt: z.object({ A: z.string().min(2), B: z.string().min(2) }).strict(),
  /** Evidências necessárias, por papel — usadas pelo validador (regra de cooperação). */
  requires: z.object({ A: z.array(evidenceId), B: z.array(evidenceId) }).strict(),
  /** Dicas graduais por papel; liberadas uma a uma, sob pedido. */
  hints: z.object({ A: z.array(hintSchema), B: z.array(hintSchema) }).strict(),
  onSolve: z.array(effectSchema).default([]),
  solvedText: z.string().min(2).max(600),
};

export const puzzleSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...puzzleBase,
      type: z.literal("code"),
      /** Formato exibido no campo (ex.: "4 dígitos"). */
      inputLabel: z.string().min(2).max(60),
      answer: z.object({ accepted: z.array(z.string().min(1)).min(1) }).strict(),
    })
    .strict(),
  z
    .object({
      ...puzzleBase,
      type: z.literal("sequence"),
      items: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{1,30}$/), label: z.string().min(2) }).strict()).min(3),
      answer: z.object({ order: z.array(z.string()).min(3) }).strict(),
    })
    .strict(),
  z
    .object({
      ...puzzleBase,
      type: z.literal("match"),
      left: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{1,30}$/), label: z.string().min(1) }).strict()).min(2),
      options: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{1,30}$/), label: z.string().min(1) }).strict()).min(2),
      answer: z.object({ pairs: z.record(z.string(), z.string()) }).strict(),
    })
    .strict(),
]);
export type Puzzle = z.infer<typeof puzzleSchema>;

// ---------------------------------------------------------------------------
// Teoria final
// ---------------------------------------------------------------------------
export const questionSchema = z
  .object({
    id: questionId,
    prompt: z.string().min(2),
    kind: z.enum(["single", "multiple"]),
    options: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{1,30}$/), label: z.string().min(1) }).strict()).min(2),
    correct: z.array(z.string()).min(1),
    weight: z.number().int().positive().default(1),
    /** Explicação mostrada na resolução. */
    explanation: z.string().min(2),
  })
  .strict()
  .refine((q) => q.kind === "multiple" || q.correct.length === 1, "pergunta 'single' tem uma única resposta");
export type Question = z.infer<typeof questionSchema>;

export const verdictSchema = z
  .object({
    id: z.enum(["closed", "partial", "archived"]),
    /** Pontuação mínima (0–100) para este veredito. */
    minScore: z.number().min(0).max(100),
    title: z.string().min(2),
    text: z.string().min(2),
  })
  .strict();

// ---------------------------------------------------------------------------
// Caso
// ---------------------------------------------------------------------------
export const chapterSchema = z
  .object({
    id: chapterId,
    title: z.string().min(2).max(80),
    intro: z.string().min(2),
  })
  .strict();

export const gameEventSchema = z
  .object({
    id: eventId,
    when: conditionSchema,
    effects: z.array(effectSchema).min(1),
  })
  .strict();

export const caseDefinitionSchema = z
  .object({
    id: z.string().regex(/^case-\d{3}$/),
    version: z.number().int().positive(),
    title: z.string().min(2),
    roles: z
      .object({
        A: z.object({ name: z.string().min(2), tagline: z.string().min(2), briefing: z.string().min(2) }).strict(),
        B: z.object({ name: z.string().min(2), tagline: z.string().min(2), briefing: z.string().min(2) }).strict(),
      })
      .strict(),
    intro: z.string().min(2),
    chapters: z.array(chapterSchema).min(1),
    evidence: z.array(evidenceSchema).min(1),
    puzzles: z.array(puzzleSchema),
    events: z.array(gameEventSchema).default([]),
    theory: z
      .object({
        availableWhen: conditionSchema,
        intro: z.string().min(2),
        questions: z.array(questionSchema).min(1),
        verdicts: z.array(verdictSchema).min(1),
      })
      .strict(),
    resolution: z
      .object({
        summary: z.string().min(2),
        overlooked: z.array(z.string().min(2)).min(1),
        epilogue: z.string().min(2),
      })
      .strict(),
  })
  .strict();

export type CaseDefinition = z.infer<typeof caseDefinitionSchema>;
export type CaseDefinitionInput = z.input<typeof caseDefinitionSchema>;
