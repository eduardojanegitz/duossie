"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, Lightbulb } from "lucide-react";
import type { PlayerView, PuzzleAnswer, PuzzleView } from "@/engine";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useGameAction, type DispatchResult } from "./use-game-action";

type View = PlayerView & { sessionId: string };

export function PuzzlesPanel({ view, partnerName }: { view: View; partnerName: string }) {
  if (view.puzzles.length === 0) {
    return <p className="text-paper-500">Nenhum enigma disponível ainda. Examinem os arquivos.</p>;
  }
  const ordered = [...view.puzzles].sort((a, b) => Number(a.solved) - Number(b.solved));
  return (
    <section aria-labelledby="puzzles-title" className="flex flex-col gap-6">
      <h2 id="puzzles-title" className="font-mono text-xs uppercase tracking-[0.25em] text-paper-500">
        Enigmas
      </h2>
      {ordered.map((p) => (
        <PuzzleCard key={p.id} puzzle={p} sessionId={view.sessionId} role={view.role} partnerName={partnerName} />
      ))}
    </section>
  );
}

function PuzzleCard({ puzzle, sessionId, role, partnerName }: { puzzle: PuzzleView; sessionId: string; role: "A" | "B"; partnerName: string }) {
  const { dispatch, pending } = useGameAction(sessionId);
  const [feedback, setFeedback] = useState<{ tone: "error" | "info"; text: string } | null>(null);

  async function submit(answer: PuzzleAnswer) {
    setFeedback(null);
    const result: DispatchResult = await dispatch({ type: "attempt_puzzle", puzzleId: puzzle.id, answer });
    if (!result.ok) return setFeedback({ tone: "error", text: result.error });
    if (result.outcome.kind === "puzzle" && !result.outcome.correct) {
      const partial =
        result.outcome.partial !== undefined && result.outcome.total
          ? ` ${result.outcome.partial} de ${result.outcome.total} estão certos.`
          : "";
      setFeedback({ tone: "info", text: `Ainda não.${partial} Confiram com o parceiro e tentem de novo.` });
    }
  }

  async function hint() {
    setFeedback(null);
    const result = await dispatch({ type: "request_hint", puzzleId: puzzle.id });
    if (!result.ok) setFeedback({ tone: "error", text: result.error });
  }

  return (
    <article
      aria-labelledby={`${puzzle.id}-title`}
      data-testid={`puzzle-${puzzle.id}`}
      className={cn(
        "flex flex-col gap-4 rounded-sm border p-4 sm:p-5",
        puzzle.solved ? "border-signal-500/50 bg-ink-900" : "border-ink-600 bg-ink-850",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <h3 id={`${puzzle.id}-title`} className="text-lg font-medium text-paper-50">
          {puzzle.title}
        </h3>
        {puzzle.solved ? (
          <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-signal-400">
            <CheckCircle2 aria-hidden className="size-4" /> Resolvido
          </span>
        ) : puzzle.attempts > 0 ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper-500">{puzzle.attempts} tentativa(s)</span>
        ) : null}
      </header>

      <p className="text-paper-300">{puzzle.prompt}</p>

      {puzzle.solved ? (
        <SolvedSummary puzzle={puzzle} role={role} partnerName={partnerName} />
      ) : (
        <>
          {puzzle.type === "code" ? <CodeInput puzzle={puzzle} pending={pending} onSubmit={(code) => submit({ code })} /> : null}
          {puzzle.type === "sequence" ? <SequenceInput puzzle={puzzle} pending={pending} onSubmit={(order) => submit({ order })} /> : null}
          {puzzle.type === "match" ? <MatchInput puzzle={puzzle} pending={pending} onSubmit={(pairs) => submit({ pairs })} /> : null}

          {feedback ? (
            <p role={feedback.tone === "error" ? "alert" : "status"} className={feedback.tone === "error" ? "text-sm text-stamp-500" : "text-sm text-amber-400"}>
              {feedback.text}
            </p>
          ) : null}

          {puzzle.hints.length > 0 ? (
            <ol className="flex flex-col gap-2" aria-label="Dicas recebidas">
              {puzzle.hints.map((h, i) => (
                <li key={i} className="flex gap-2 rounded-sm bg-ink-900 p-3 text-sm text-paper-100">
                  <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-500" />
                  <span>
                    <span className="sr-only">Dica {i + 1}: </span>
                    {h}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
          {puzzle.hintsRemaining > 0 ? (
            <Button variant="quiet" className="self-start px-0" disabled={pending} onClick={hint}>
              <Lightbulb aria-hidden /> Pedir uma dica ({puzzle.hintsRemaining})
            </Button>
          ) : null}
        </>
      )}
    </article>
  );
}

function SolvedSummary({ puzzle, role, partnerName }: { puzzle: PuzzleView; role: "A" | "B"; partnerName: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-paper-50">{puzzle.solvedText}</p>
      <p className="text-xs text-paper-500">Resolvido por {puzzle.solvedBy === role ? "você" : partnerName}.</p>
      {puzzle.type === "sequence" && puzzle.solution ? (
        <ol className="list-inside list-decimal text-sm text-paper-300">
          {puzzle.solution.map((id) => (
            <li key={id}>{puzzle.items.find((i) => i.id === id)?.label}</li>
          ))}
        </ol>
      ) : null}
      {puzzle.type === "match" && puzzle.solution ? (
        <ul className="text-sm text-paper-300">
          {puzzle.left.map((l) => (
            <li key={l.id}>
              {l.label} → {puzzle.options.find((o) => o.id === puzzle.solution?.[l.id])?.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function CodeInput({ puzzle, pending, onSubmit }: { puzzle: Extract<PuzzleView, { type: "code" }>; pending: boolean; onSubmit: (code: string) => void }) {
  const [code, setCode] = useState("");
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim()) onSubmit(code);
      }}
    >
      <label className="sr-only" htmlFor={`${puzzle.id}-code`}>
        {puzzle.inputLabel}
      </label>
      <input
        id={`${puzzle.id}-code`}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder={puzzle.inputLabel}
        autoComplete="off"
        inputMode="text"
        className="min-h-12 flex-1 rounded-sm border border-ink-600 bg-ink-900 px-4 font-mono text-xl tracking-[0.3em] text-paper-50 placeholder:text-sm placeholder:tracking-normal placeholder:text-ink-500 focus:border-amber-500 focus:outline-none"
      />
      <Button type="submit" disabled={pending || !code.trim()}>
        Testar
      </Button>
    </form>
  );
}

function SequenceInput({
  puzzle,
  pending,
  onSubmit,
}: {
  puzzle: Extract<PuzzleView, { type: "sequence" }>;
  pending: boolean;
  onSubmit: (order: string[]) => void;
}) {
  const [order, setOrder] = useState(() => puzzle.items.map((i) => i.id));
  const label = (id: string) => puzzle.items.find((i) => i.id === id)?.label ?? id;
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setOrder(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-paper-500">Use as setas para mover cada fato. Do primeiro (topo) ao último.</p>
      <ol className="flex flex-col gap-2">
        {order.map((id, i) => (
          <li key={id} className="flex items-center gap-2 rounded-sm border border-ink-600 bg-ink-900 p-2 pl-3">
            <span className="w-5 shrink-0 font-mono text-xs text-paper-500">{i + 1}</span>
            <span className="flex-1 text-sm text-paper-100">{label(id)}</span>
            <span className="flex shrink-0">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`Mover "${label(id)}" para cima`}
                className="grid size-11 place-items-center rounded-sm text-paper-300 hover:bg-ink-700 disabled:opacity-30"
              >
                <ArrowUp aria-hidden className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === order.length - 1}
                aria-label={`Mover "${label(id)}" para baixo`}
                className="grid size-11 place-items-center rounded-sm text-paper-300 hover:bg-ink-700 disabled:opacity-30"
              >
                <ArrowDown aria-hidden className="size-4" />
              </button>
            </span>
          </li>
        ))}
      </ol>
      <Button disabled={pending} onClick={() => onSubmit(order)}>
        Testar ordem
      </Button>
    </div>
  );
}

function MatchInput({
  puzzle,
  pending,
  onSubmit,
}: {
  puzzle: Extract<PuzzleView, { type: "match" }>;
  pending: boolean;
  onSubmit: (pairs: Record<string, string>) => void;
}) {
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const complete = puzzle.left.every((l) => pairs[l.id]);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (complete) onSubmit(pairs);
      }}
    >
      {puzzle.left.map((l) => (
        <div key={l.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <label htmlFor={`${puzzle.id}-${l.id}`} className="text-sm text-paper-100">
            {l.label}
          </label>
          <select
            id={`${puzzle.id}-${l.id}`}
            value={pairs[l.id] ?? ""}
            onChange={(e) => setPairs((p) => ({ ...p, [l.id]: e.target.value }))}
            className="min-h-12 rounded-sm border border-ink-600 bg-ink-900 px-3 text-paper-50 focus:border-amber-500 focus:outline-none sm:w-48"
          >
            <option value="" disabled>
              Escolher…
            </option>
            {puzzle.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      <Button type="submit" disabled={pending || !complete}>
        Testar identificação
      </Button>
    </form>
  );
}
