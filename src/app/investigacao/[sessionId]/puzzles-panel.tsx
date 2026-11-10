"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, LifeBuoy, Lightbulb, Lock } from "lucide-react";
import type { DecisionView, PlayerView, PuzzleAnswer, PuzzleView } from "@/engine";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useCollab } from "./use-collab";
import { useGameAction, type DispatchResult } from "./use-game-action";

type View = PlayerView & { sessionId: string };

export function PuzzlesPanel({ view, partnerName }: { view: View; partnerName: string }) {
  const ordered = [...view.puzzles].sort((a, b) => Number(a.solved) - Number(b.solved));
  const decisions = [...view.decisions].sort((a, b) => Number(a.resolved !== null) - Number(b.resolved !== null));
  return (
    <div className="flex flex-col gap-10">
      {decisions.length > 0 ? (
        <section aria-labelledby="decisions-title" className="flex flex-col gap-4">
          <h2 id="decisions-title" className="font-mono text-xs uppercase tracking-[0.25em] text-paper-500">
            Decisões
          </h2>
          {decisions.map((d) => (
            <DecisionCard key={d.id} decision={d} sessionId={view.sessionId} partnerName={partnerName} />
          ))}
        </section>
      ) : null}
      {view.puzzles.length === 0 ? <p className="text-paper-500">Nenhum enigma disponível ainda. Examinem os arquivos.</p> : null}
      {view.puzzles.length > 0 ? <PuzzleList view={view} ordered={ordered} partnerName={partnerName} /> : null}
    </div>
  );
}

function PuzzleList({ view, ordered, partnerName }: { view: View; ordered: PuzzleView[]; partnerName: string }) {
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
    if (result.outcome.kind === "part_submitted") {
      setFeedback({ tone: "info", text: `Suas marcações foram enviadas. Falta ${partnerName} enviar as dele.` });
    }
  }

  const collab = useCollab(sessionId);
  const [helpSent, setHelpSent] = useState(false);

  async function askHelp() {
    setFeedback(null);
    const e = await collab.chat({ kind: "help", puzzleId: puzzle.id });
    if (e) setFeedback({ tone: "error", text: e });
    else setHelpSent(true);
  }

  async function operate(control: string) {
    setFeedback(null);
    const result = await dispatch({ type: "operate_mechanism", puzzleId: puzzle.id, control });
    if (!result.ok) return setFeedback({ tone: "error", text: result.error });
    if (result.outcome.kind === "mechanism" && !result.outcome.ok) {
      setFeedback({ tone: "info", text: "O mecanismo travou e voltou ao início. Combinem a ordem antes de tentar de novo." });
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
          {puzzle.type === "contradiction" ? (
            <ContradictionInput puzzle={puzzle} pending={pending} partnerName={partnerName} onSubmit={(flags) => submit({ flags })} />
          ) : null}
          {puzzle.type === "mechanism" ? <MechanismInput puzzle={puzzle} pending={pending} onOperate={operate} /> : null}

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
          <div className="flex flex-wrap gap-x-6">
            {puzzle.hintsRemaining > 0 ? (
              <Button variant="quiet" className="px-0" disabled={pending} onClick={hint}>
                <Lightbulb aria-hidden /> Pedir uma dica ({puzzle.hintsRemaining})
              </Button>
            ) : null}
            <Button variant="quiet" className="px-0" disabled={collab.pending || helpSent} onClick={askHelp}>
              <LifeBuoy aria-hidden /> {helpSent ? `Pedido enviado a ${partnerName}` : `Chamar ${partnerName}`}
            </Button>
          </div>
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

function ContradictionInput({
  puzzle,
  pending,
  partnerName,
  onSubmit,
}: {
  puzzle: Extract<PuzzleView, { type: "contradiction" }>;
  pending: boolean;
  partnerName: string;
  onSubmit: (flags: string[]) => void;
}) {
  const [flags, setFlags] = useState<string[]>(() => puzzle.myPart ?? []);
  const toggle = (id: string) => setFlags((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(flags);
      }}
    >
      <p className="text-xs text-paper-500">
        Marque as afirmações que <strong className="text-paper-300">não se sustentam</strong>. {partnerName} tem outras afirmações; o
        enigma só é avaliado quando os dois enviarem.
      </p>
      {puzzle.statements.map((st) => (
        <label
          key={st.id}
          className={cn(
            "flex min-h-12 cursor-pointer items-start gap-3 rounded-sm border px-3 py-2 text-sm",
            flags.includes(st.id) ? "border-stamp-500 bg-ink-800" : "border-ink-600 bg-ink-900",
          )}
        >
          <input type="checkbox" checked={flags.includes(st.id)} onChange={() => toggle(st.id)} className="mt-1 size-4 accent-[var(--stamp-500)]" />
          <span>
            <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-paper-500">{st.source}</span>
            <span className="text-paper-100">“{st.label}”</span>
          </span>
        </label>
      ))}
      <p className="text-xs text-paper-500" role="status">
        {puzzle.myPart ? "Você já enviou; pode reenviar até o parceiro mandar as dele." : "Você ainda não enviou."}{" "}
        {puzzle.partnerSubmitted ? `${partnerName} já enviou.` : `${partnerName} ainda não enviou.`}
      </p>
      <Button type="submit" disabled={pending}>
        Enviar minhas marcações
      </Button>
    </form>
  );
}

function MechanismInput({
  puzzle,
  pending,
  onOperate,
}: {
  puzzle: Extract<PuzzleView, { type: "mechanism" }>;
  pending: boolean;
  onOperate: (control: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex gap-1"
        role="progressbar"
        aria-label="Etapas do mecanismo"
        aria-valuenow={puzzle.progress}
        aria-valuemin={0}
        aria-valuemax={puzzle.total}
      >
        {Array.from({ length: puzzle.total }, (_, i) => (
          <span key={i} className={cn("h-2 flex-1 rounded-full", i < puzzle.progress ? "bg-signal-400" : "bg-ink-700")} />
        ))}
      </div>
      <p className="text-xs text-paper-500">
        {puzzle.progress} de {puzzle.total} etapas. Seus comandos estão abaixo; os do parceiro, no aparelho dele.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {puzzle.controls.map((c) => (
          <Button key={c.id} variant="outline" disabled={pending} onClick={() => onOperate(c.id)}>
            {c.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function DecisionCard({ decision, sessionId, partnerName }: { decision: DecisionView; sessionId: string; partnerName: string }) {
  const { dispatch, pending } = useGameAction(sessionId);
  const [error, setError] = useState<string | null>(null);
  const label = (id: string | null) => decision.options.find((o) => o.id === id)?.label;
  const disagree = decision.kind === "joint" && decision.myVote && decision.partnerVote && decision.myVote !== decision.partnerVote;

  return (
    <article
      data-testid={`decision-${decision.id}`}
      aria-labelledby={`${decision.id}-title`}
      className={cn("flex flex-col gap-3 rounded-sm border p-4", decision.resolved ? "border-ink-600 bg-ink-900" : "border-amber-700 bg-ink-850")}
    >
      <header className="flex items-start justify-between gap-3">
        <h3 id={`${decision.id}-title`} className="text-lg font-medium text-paper-50">
          {decision.title}
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper-500">
          {decision.kind === "joint" ? "Decisão conjunta" : "Só você decide"}
        </span>
      </header>
      <p className="text-paper-300">{decision.prompt}</p>
      {decision.resolved ? (
        <div className="flex flex-col gap-1 border-l-2 border-amber-500 pl-3">
          <p className="flex items-center gap-2 text-sm text-paper-500">
            <Lock aria-hidden className="size-3" /> Escolha: {label(decision.resolved.optionId)}
          </p>
          <p className="text-paper-50">{decision.resolved.outcome}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2" role="group" aria-label="Opções">
            {decision.options.map((o) => (
              <Button
                key={o.id}
                variant={decision.myVote === o.id ? "default" : "outline"}
                aria-pressed={decision.myVote === o.id}
                disabled={pending}
                onClick={async () => {
                  setError(null);
                  const r = await dispatch({ type: "vote_decision", decisionId: decision.id, optionId: o.id });
                  if (!r.ok) setError(r.error);
                }}
              >
                {o.label}
                {decision.partnerVote === o.id ? <span className="normal-case tracking-normal"> · voto de {partnerName}</span> : null}
              </Button>
            ))}
          </div>
          {decision.kind === "joint" ? (
            <p className="text-sm text-paper-500" role="status">
              {disagree
                ? `Vocês escolheram opções diferentes. Conversem — a decisão só vale quando os dois concordarem.`
                : decision.myVote
                  ? `Aguardando ${partnerName}.`
                  : decision.partnerVote
                    ? `${partnerName} já votou. Sua vez.`
                    : "Os dois precisam escolher a mesma opção."}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-stamp-500">
              {error}
            </p>
          ) : null}
        </>
      )}
    </article>
  );
}
