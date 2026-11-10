"use client";

import { useState } from "react";
import { Pin, Send } from "lucide-react";
import type { EvidenceView, PlayerView } from "@/engine";
import { EvidenceDocument } from "@/components/case/evidence-document";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { play } from "@/lib/audio/sfx";
import { useCollab } from "./use-collab";
import { useGameAction } from "./use-game-action";

const KIND_LABEL: Record<string, string> = {
  document: "Documento",
  record: "Registro",
  photo: "Fotografia",
  object: "Objeto",
  testimony: "Depoimento",
  message: "Mensagens",
  person: "Ficha",
};

const ORIGIN_LABEL: Record<EvidenceView["origin"], string> = {
  own: "Só você vê",
  common: "Vocês dois veem",
  shared: "Enviada pelo parceiro",
};

export function EvidencePanel({
  view,
  partnerName,
  pinned,
}: {
  view: PlayerView & { sessionId: string };
  partnerName: string;
  pinned: Set<string>;
}) {
  const { dispatch, pending } = useGameAction(view.sessionId);
  const collab = useCollab(view.sessionId);
  const [pinPrivate, setPinPrivate] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = view.evidence.find((e) => e.id === openId) ?? null;

  const ordered = [...view.evidence].sort((a, b) => Number(a.seen) - Number(b.seen));

  async function openEvidence(ev: EvidenceView) {
    play("open");
    setOpenId(ev.id);
    setError(null);
    if (!ev.seen) await dispatch({ type: "view_evidence", evidenceId: ev.id });
  }

  async function share(ev: EvidenceView) {
    setError(null);
    const result = await dispatch({ type: "share_evidence", evidenceId: ev.id });
    if (!result.ok) setError(result.error);
  }

  return (
    <section aria-labelledby="evidence-title" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 id="evidence-title" className="font-mono text-xs uppercase tracking-[0.25em] text-paper-500">
          Arquivos da investigação
        </h2>
        <p className="text-xs text-paper-500">{view.evidence.length} itens</p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2" data-testid="evidence-list">
        {ordered.map((ev) => (
          <li key={ev.id}>
            <button
              type="button"
              onClick={() => openEvidence(ev)}
              className={cn(
                "paper-texture flex min-h-24 w-full flex-col gap-2 rounded-sm border bg-ink-850 p-4 text-left transition-colors hover:border-paper-500",
                ev.seen ? "border-ink-600" : "border-amber-500 shadow-[0_0_18px_rgba(232,176,74,0.12)]",
              )}
            >
              <span className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-500">
                <span>{KIND_LABEL[ev.kind] ?? ev.kind}</span>
                {!ev.seen ? <span className="text-amber-400">Novo</span> : <span>{ORIGIN_LABEL[ev.origin]}</span>}
              </span>
              <span className="text-paper-50">{ev.title}</span>
              <span className="text-sm text-paper-500">{ev.summary}</span>
            </button>
          </li>
        ))}
      </ul>

      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent
          side="bottom"
          className="max-h-[92dvh] overflow-y-auto rounded-t-md border-ink-600 bg-ink-900 pb-[max(1.5rem,var(--safe-bottom))] sm:mx-auto sm:max-w-2xl"
        >
          {open ? (
            <>
              <SheetHeader className="gap-1 text-left">
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-500">
                  {KIND_LABEL[open.kind] ?? open.kind} · {ORIGIN_LABEL[open.origin]}
                </p>
                <SheetTitle className="text-xl font-medium text-paper-50">{open.title}</SheetTitle>
                <SheetDescription className="text-paper-500">{open.summary}</SheetDescription>
              </SheetHeader>
              <div className="px-4">
                <EvidenceDocument blocks={open.body} />
              </div>
              <div className="flex flex-col gap-2 px-4 pt-6">
                {pinned.has(open.id) ? (
                  <p className="text-sm text-amber-400">Está no seu quadro.</p>
                ) : (
                  <div className="flex flex-col gap-2 rounded-sm border border-ink-700 p-3">
                    <Button
                      variant="outline"
                      block
                      disabled={collab.pending}
                      onClick={async () => {
                        setError(null);
                        const e = await collab.board({ type: "pin", evidenceId: open.id, visibility: pinPrivate ? "private" : "shared" });
                        if (e) setError(e);
                      }}
                    >
                      <Pin aria-hidden /> Fixar no quadro
                    </Button>
                    <label className="flex min-h-11 items-center gap-3 text-sm text-paper-300">
                      <input
                        type="checkbox"
                        checked={pinPrivate}
                        onChange={(e) => setPinPrivate(e.target.checked)}
                        className="size-4 accent-[var(--amber-500)]"
                      />
                      Só no meu quadro (privado)
                    </label>
                    {open.origin === "own" && !pinPrivate ? (
                      <p className="text-xs text-paper-500">No quadro compartilhado, {partnerName} verá o cartão tarjado — sem o conteúdo.</p>
                    ) : null}
                  </div>
                )}
                {open.canShare ? (
                  <Button variant="outline" block disabled={pending} onClick={() => share(open)}>
                    <Send aria-hidden />
                    Enviar cópia para {partnerName}
                  </Button>
                ) : open.sharedByMe ? (
                  <p className="text-sm text-signal-400">Você enviou uma cópia para {partnerName}.</p>
                ) : open.origin === "own" ? (
                  <p className="text-sm text-paper-500">Este item não pode ser enviado. Descreva o que importa para o seu parceiro.</p>
                ) : null}
                {error ? (
                  <p role="alert" className="text-sm text-stamp-500">
                    {error}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}
