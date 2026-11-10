"use client";

import { useState, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import type { PlayerView, TheoryAnswers } from "@/engine";
import { FileLabel } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useGameAction } from "./use-game-action";

type View = PlayerView & { sessionId: string };
type Theory = Extract<PlayerView["theory"], { available: true }>;

export function TheoryPanel({ view, partnerName }: { view: View; partnerName: string }) {
  const theory = view.theory as Theory;
  const { dispatch, pending } = useGameAction(view.sessionId);
  const [error, setError] = useState<string | null>(null);

  async function run(action: Parameters<typeof dispatch>[0]) {
    setError(null);
    const result = await dispatch(action);
    if (!result.ok) setError(result.error);
  }

  const errorLine = error ? (
    <p role="alert" className="text-sm text-stamp-500">
      {error}
    </p>
  ) : null;

  if (theory.resolution) {
    return (
      <Resolution theory={theory} pending={pending} onReopen={() => run({ type: "reopen_theory" })} error={errorLine} />
    );
  }

  if (theory.draft) {
    const mine = theory.proposedBy === view.role;
    return (
      <section aria-labelledby="draft-title" className="flex flex-col gap-5">
        <FileLabel>Relatório final</FileLabel>
        <h2 id="draft-title" className="text-xl font-medium text-paper-50">
          {mine ? `Aguardando ${partnerName} revisar` : `${partnerName} propôs este relatório`}
        </h2>
        <AnswersList theory={theory} answers={theory.draft} />
        {errorLine}
        {mine ? (
          <Button variant="outline" disabled={pending} onClick={() => run({ type: "withdraw_theory" })}>
            Retirar para revisar
          </Button>
        ) : (
          <div className="flex flex-col gap-3">
            <Button disabled={pending} onClick={() => run({ type: "confirm_theory" })}>
              Confirmar e enviar
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => run({ type: "withdraw_theory" })}>
              Devolver para discutir
            </Button>
          </div>
        )}
      </section>
    );
  }

  return (
    <TheoryForm
      theory={theory}
      pending={pending}
      initial={theory.verdicts.at(-1)?.answers ?? {}}
      onSubmit={(answers) => run({ type: "propose_theory", answers })}
      error={errorLine}
    />
  );
}

function TheoryForm({
  theory,
  pending,
  initial,
  onSubmit,
  error,
}: {
  theory: Theory;
  pending: boolean;
  initial: TheoryAnswers;
  onSubmit: (answers: TheoryAnswers) => void;
  error: ReactNode;
}) {
  const [answers, setAnswers] = useState<TheoryAnswers>(initial);
  const complete = theory.questions.every((q) => (answers[q.id]?.length ?? 0) > 0);

  const toggle = (qid: string, oid: string, multiple: boolean) =>
    setAnswers((a) => {
      const current = a[qid] ?? [];
      if (!multiple) return { ...a, [qid]: [oid] };
      return { ...a, [qid]: current.includes(oid) ? current.filter((x) => x !== oid) : [...current, oid] };
    });

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (complete) onSubmit(answers);
      }}
    >
      <header className="flex flex-col gap-2">
        <FileLabel>Relatório final</FileLabel>
        <p className="text-paper-300">{theory.intro}</p>
      </header>
      {theory.questions.map((q, index) => (
        <fieldset key={q.id} className="flex flex-col gap-2">
          <legend className="mb-2 text-paper-50">
            <span className="font-mono text-xs text-paper-500">{index + 1}. </span>
            {q.prompt}
            {q.kind === "multiple" ? <span className="block text-xs text-paper-500">Marque todas que se aplicam. Opções erradas descontam.</span> : null}
          </legend>
          {q.options.map((o) => {
            const checked = answers[q.id]?.includes(o.id) ?? false;
            return (
              <label
                key={o.id}
                className={cn(
                  "flex min-h-12 cursor-pointer items-center gap-3 rounded-sm border px-3 py-2 text-sm",
                  checked ? "border-amber-500 bg-ink-800 text-paper-50" : "border-ink-600 bg-ink-900 text-paper-300",
                )}
              >
                <input
                  type={q.kind === "multiple" ? "checkbox" : "radio"}
                  name={q.id}
                  checked={checked}
                  onChange={() => toggle(q.id, o.id, q.kind === "multiple")}
                  className="size-4 accent-[var(--amber-500)]"
                />
                {o.label}
              </label>
            );
          })}
        </fieldset>
      ))}
      {error}
      <Button type="submit" disabled={pending || !complete}>
        Propor relatório ao parceiro
      </Button>
    </form>
  );
}

function AnswersList({ theory, answers }: { theory: Theory; answers: TheoryAnswers }) {
  return (
    <ol className="flex flex-col gap-3">
      {theory.questions.map((q, i) => (
        <li key={q.id} className="rounded-sm border border-ink-700 bg-ink-900 p-3">
          <p className="text-sm text-paper-500">
            {i + 1}. {q.prompt}
          </p>
          <p className="text-paper-50">
            {(answers[q.id] ?? []).map((id) => q.options.find((o) => o.id === id)?.label).join(" · ")}
          </p>
        </li>
      ))}
    </ol>
  );
}

function Resolution({
  theory,
  pending,
  onReopen,
  error,
}: {
  theory: Theory;
  pending: boolean;
  onReopen: () => void;
  error: ReactNode;
}) {
  const r = theory.resolution!;
  const latest = theory.verdicts.at(-1)!;
  return (
    <article aria-labelledby="verdict-title" className="flex flex-col gap-8" data-testid="resolution">
      <header className="flex flex-col items-center gap-3 border-b border-ink-700 pb-8 text-center">
        <FileLabel>Resolução</FileLabel>
        <p
          className={cn(
            "rounded-sm border-2 px-4 py-2 font-mono text-sm uppercase tracking-[0.3em]",
            r.verdict.id === "closed" ? "border-signal-500 text-signal-400" : r.verdict.id === "partial" ? "border-amber-500 text-amber-400" : "border-stamp-500 text-stamp-500",
          )}
        >
          {r.verdict.title}
        </p>
        <h2 id="verdict-title" className="text-2xl font-medium text-paper-50">
          {r.verdict.text}
        </h2>
        <p className="font-mono text-sm text-paper-500">Relatório: {r.verdict.score}/100</p>
      </header>

      <section aria-labelledby="summary-title" className="flex flex-col gap-3">
        <h3 id="summary-title" className="font-mono text-xs uppercase tracking-[0.25em] text-paper-500">
          O que aconteceu
        </h3>
        <p className="font-typewriter text-lg leading-relaxed text-paper-100">{r.summary}</p>
      </section>

      <section aria-labelledby="key-title" className="flex flex-col gap-3">
        <h3 id="key-title" className="font-mono text-xs uppercase tracking-[0.25em] text-paper-500">
          O relatório de vocês
        </h3>
        <ol className="flex flex-col gap-3">
          {theory.questions.map((q, i) => {
            const key = r.answerKey.find((k) => k.id === q.id)!;
            const score = latest.perQuestion[q.id] ?? 0;
            const picked = latest.answers[q.id] ?? [];
            return (
              <li key={q.id} className="flex flex-col gap-2 rounded-sm border border-ink-700 bg-ink-900 p-4">
                <p className="flex items-start gap-2 text-paper-50">
                  {score === 1 ? (
                    <Check aria-label="Correta" className="mt-0.5 size-4 shrink-0 text-signal-400" />
                  ) : (
                    <X aria-label={score > 0 ? "Parcialmente correta" : "Incorreta"} className="mt-0.5 size-4 shrink-0 text-stamp-500" />
                  )}
                  <span>
                    {i + 1}. {q.prompt}
                  </span>
                </p>
                <p className="text-sm text-paper-300">
                  Vocês: {picked.map((id) => q.options.find((o) => o.id === id)?.label).join(" · ")}
                </p>
                <p className="text-sm text-paper-100">
                  Resposta: {key.correct.map((id) => q.options.find((o) => o.id === id)?.label).join(" · ")}
                </p>
                <p className="text-sm text-paper-500">{key.explanation}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="overlooked-title" className="flex flex-col gap-3">
        <h3 id="overlooked-title" className="font-mono text-xs uppercase tracking-[0.25em] text-paper-500">
          Detalhes que passaram despercebidos
        </h3>
        <ul className="flex flex-col gap-2">
          {r.overlooked.map((o) => (
            <li key={o} className="flex gap-3 text-paper-100">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-500" />
              {o}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="epilogue-title" className="flex flex-col gap-3 border-t border-ink-700 pt-8">
        <h3 id="epilogue-title" className="font-mono text-xs uppercase tracking-[0.25em] text-amber-400">
          Epílogo
        </h3>
        <p className="font-typewriter text-lg leading-relaxed text-paper-100">{r.epilogue}</p>
      </section>

      {error}
      {r.canReopen ? (
        <Button variant="outline" disabled={pending} onClick={onReopen}>
          Reabrir a investigação e revisar o relatório
        </Button>
      ) : null}
    </article>
  );
}
