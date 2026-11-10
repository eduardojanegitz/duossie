"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { BookOpen, FileText, KeyRound, MessageSquare, Network, ScrollText } from "lucide-react";
import type { PlayerView } from "@/engine";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { useDuoPresence, type PartnerStatus } from "@/lib/realtime/use-duo-presence";
import type { BoardView, MessageView } from "@/server/game/collab";
import { BoardPanel } from "./board-panel";
import { ChatPanel } from "./chat-panel";
import { EvidencePanel } from "./evidence-panel";
import { JournalPanel } from "./journal-panel";
import { PuzzlesPanel } from "./puzzles-panel";
import { TheoryPanel } from "./theory-panel";

type Tab = "journal" | "evidence" | "board" | "puzzles" | "theory";
type Person = { id: string; name: string };

const PARTNER_LABEL: Record<PartnerStatus, string> = {
  connecting: "conectando…",
  offline: "offline",
  online: "na central",
  away: "ausente",
  investigating: "investigando",
};

const SECTION_LABEL: Record<string, string> = {
  journal: "Diário",
  evidence: "Arquivos",
  board: "Quadro",
  puzzles: "Enigmas",
  theory: "Relatório",
};

export function InvestigationClient({
  view,
  board,
  chat,
  duoId,
  me,
  partner,
}: {
  view: PlayerView & { sessionId: string; stateVersion: number };
  board: BoardView;
  chat: { messages: MessageView[]; unread: number };
  duoId: string;
  me: Person;
  partner: Person;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(() => (view.evidence.some((e) => e.seen) ? "evidence" : "journal"));
  const [chatOpen, setChatOpen] = useState(false);

  // Sincronização: o servidor avisa que a sessão mudou → buscamos a visão de novo.
  const refresh = useCallback(() => router.refresh(), [router]);
  const partnerPresence = useDuoPresence({
    duoId,
    userId: me.id,
    partnerId: partner.id,
    activity: { kind: "case", caseId: view.caseId, section: tab },
    onSessionUpdated: (payload) => {
      if (payload.sessionId === view.sessionId && payload.version > view.stateVersion) refresh();
    },
    onCollabUpdated: (_event, payload) => {
      if (payload.sessionId === view.sessionId) refresh();
    },
    onReconnect: refresh,
  });

  // Ao voltar para a aba ou recuperar a rede, confere se algo mudou.
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && refresh();
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const unseen = view.evidence.filter((e) => !e.seen).length;
  const openPuzzles = view.puzzles.filter((p) => !p.solved).length;
  const theoryAttention =
    view.theory.available && (view.theory.resolution !== null || (view.theory.draft !== null && !view.theory.confirmedByMe));

  const tabs = useMemo(
    () =>
      [
        { id: "journal" as const, label: "Diário", icon: BookOpen, badge: 0 },
        { id: "evidence" as const, label: "Arquivos", icon: FileText, badge: unseen },
        { id: "board" as const, label: "Quadro", icon: Network, badge: 0 },
        { id: "puzzles" as const, label: "Enigmas", icon: KeyRound, badge: openPuzzles },
        ...(view.theory.available
          ? [{ id: "theory" as const, label: "Relatório", icon: ScrollText, badge: theoryAttention ? 1 : 0 }]
          : []),
      ],
    [unseen, openPuzzles, view.theory.available, theoryAttention],
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="safe-px sticky top-0 z-30 border-b border-ink-700 bg-ink-950/95 pt-[max(0.5rem,var(--safe-top))] backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-col gap-1 pb-3">
          <div className="flex min-h-12 items-center justify-between gap-3">
            <Link href="/central" className="-ml-2 px-2 py-3 font-mono text-xs uppercase tracking-[0.2em] text-paper-500 hover:text-paper-100">
              ← Casos
            </Link>
            <div className="flex items-center gap-1">
              <p className="truncate font-mono text-[11px] uppercase tracking-[0.2em] text-paper-500" data-testid="my-role">
                Você · {view.roleInfo.name}
              </p>
              <button
                type="button"
                onClick={() => setChatOpen(true)}
                aria-label={`Abrir chat${chat.unread > 0 ? ` (${chat.unread} não lidas)` : ""}`}
                className="relative -mr-2 grid size-12 place-items-center text-paper-500 hover:text-paper-100"
              >
                <MessageSquare aria-hidden className="size-5" />
                {chat.unread > 0 ? (
                  <span data-testid="chat-unread" className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-amber-500 px-1 text-[10px] leading-4 text-ink-950">
                    {chat.unread}
                  </span>
                ) : null}
              </button>
            </div>
          </div>
          <h1 className="text-lg font-medium leading-tight text-paper-50">{view.caseTitle}</h1>
          <div className="flex items-center justify-between gap-3 text-xs">
            <p className="font-mono uppercase tracking-[0.18em] text-amber-400" data-testid="chapter">
              Cap. {view.chapter.index}/{view.chapter.total} · {view.chapter.title}
            </p>
            <p className="flex items-center gap-2 text-paper-500" data-testid="partner-presence" data-status={partnerPresence.status}>
              <span
                aria-hidden
                className={cn(
                  "inline-block size-2 rounded-full",
                  partnerPresence.status === "investigating" ? "bg-amber-500" : partnerPresence.status === "online" ? "bg-signal-400" : "bg-ink-500",
                )}
              />
              {partner.name} ({view.partnerRoleName}) · {PARTNER_LABEL[partnerPresence.status]}
              {partnerPresence.status === "investigating" &&
              partnerPresence.activity?.kind === "case" &&
              partnerPresence.activity.caseId === view.caseId &&
              partnerPresence.activity.section
                ? ` · ${SECTION_LABEL[partnerPresence.activity.section] ?? ""}`
                : ""}
            </p>
          </div>
          <div
            className="mt-1 h-1 overflow-hidden rounded-full bg-ink-700"
            role="progressbar"
            aria-label="Progresso da investigação"
            aria-valuenow={view.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full bg-amber-500 transition-[width] duration-700" style={{ width: `${view.progress}%` }} />
          </div>
        </div>
      </header>

      <main className="safe-px mx-auto w-full max-w-3xl flex-1 pb-28 pt-5">
        {tab === "journal" ? <JournalPanel view={view} /> : null}
        {tab === "evidence" ? <EvidencePanel view={view} partnerName={partner.name} pinned={pinnedByMe(board)} /> : null}
        {tab === "board" ? <BoardPanel sessionId={view.sessionId} board={board} partnerName={partner.name} /> : null}
        {tab === "puzzles" ? <PuzzlesPanel view={view} partnerName={partner.name} /> : null}
        {tab === "theory" && view.theory.available ? <TheoryPanel view={view} partnerName={partner.name} /> : null}
      </main>

      <nav
        aria-label="Seções da investigação"
        className="safe-px fixed inset-x-0 bottom-0 z-30 border-t border-ink-700 bg-ink-950/95 pb-[max(0.5rem,var(--safe-bottom))] backdrop-blur"
      >
        <ul className="mx-auto flex max-w-3xl">
          {tabs.map((t) => (
            <li key={t.id} className="flex-1">
              <button
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={cn(
                  "relative flex min-h-14 w-full flex-col items-center justify-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em]",
                  tab === t.id ? "text-amber-400" : "text-paper-500 hover:text-paper-100",
                )}
              >
                <t.icon aria-hidden className="size-5" />
                {t.label}
                {t.badge > 0 ? (
                  <span className="absolute right-[calc(50%-1.6rem)] top-1.5 min-w-4 rounded-full bg-amber-500 px-1 text-[10px] leading-4 tracking-normal text-ink-950">
                    {t.badge}
                    <span className="sr-only"> pendente(s)</span>
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 border-ink-600 bg-ink-950 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-ink-700 pt-[max(1rem,var(--safe-top))]">
            <SheetTitle className="text-paper-50">Conversa com {partner.name}</SheetTitle>
            <SheetDescription className="text-paper-500">Só vocês dois leem. Anexar uma evidência não a revela ao parceiro.</SheetDescription>
          </SheetHeader>
          <ChatPanel
            sessionId={view.sessionId}
            messages={chat.messages}
            partnerName={partner.name}
            evidenceOptions={view.evidence.map((e) => ({ id: e.id, title: e.title }))}
            open={chatOpen}
            unread={chat.unread}
          />
        </SheetContent>
      </Sheet>

      <ChapterTransition chapter={view.chapter} />
      <DiscoveryToast count={view.evidence.length} solved={view.puzzles.filter((p) => p.solved).length} />
    </div>
  );
}

function pinnedByMe(board: BoardView) {
  return new Set(board.items.filter((i) => i.mine && i.evidence).map((i) => i.evidence!.id));
}

/** Transição cinematográfica quando um novo capítulo começa (não na primeira carga). */
function ChapterTransition({ chapter }: { chapter: PlayerView["chapter"] }) {
  const previous = useRef(chapter.id);
  const [shown, setShown] = useState<PlayerView["chapter"] | null>(null);

  useEffect(() => {
    if (previous.current === chapter.id) return;
    previous.current = chapter.id;
    const frame = requestAnimationFrame(() => setShown(chapter));
    return () => cancelAnimationFrame(frame);
  }, [chapter]);

  return (
    <AnimatePresence>
      {shown ? (
        <motion.div
          key={shown.id}
          role="dialog"
          aria-modal="true"
          aria-labelledby="chapter-title"
          className="fixed inset-0 z-50 grid place-items-center bg-ink-950/95 p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShown(null)}
        >
          <motion.div
            className="flex max-w-md flex-col items-center gap-4 text-center"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <p className="font-mono text-xs uppercase tracking-[0.4em] text-amber-400">
              Capítulo {shown.index} de {shown.total}
            </p>
            <h2 id="chapter-title" className="text-3xl font-medium text-paper-50">
              {shown.title}
            </h2>
            <p className="text-paper-300">{shown.intro}</p>
            <button
              type="button"
              autoFocus
              onClick={() => setShown(null)}
              className="mt-4 min-h-12 px-6 font-mono text-xs uppercase tracking-[0.25em] text-paper-500 hover:text-paper-100"
            >
              Continuar
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Aviso discreto quando chegam evidências novas ou um enigma é resolvido. */
function DiscoveryToast({ count, solved }: { count: number; solved: number }) {
  const prev = useRef({ count, solved });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const before = prev.current;
    prev.current = { count, solved };
    let text: string | null = null;
    if (solved > before.solved) text = "Enigma resolvido";
    else if (count > before.count) text = count - before.count === 1 ? "Nova evidência no arquivo" : `${count - before.count} novas evidências no arquivo`;
    if (!text) return;
    const show = requestAnimationFrame(() => setMessage(text));
    const hide = window.setTimeout(() => setMessage(null), 3200);
    return () => {
      cancelAnimationFrame(show);
      window.clearTimeout(hide);
    };
  }, [count, solved]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
      <AnimatePresence>
        {message ? (
          <motion.p
            key={message}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            className="rounded-sm border border-amber-500 bg-ink-900 px-4 py-3 font-mono text-xs uppercase tracking-[0.2em] text-amber-400 shadow-[0_0_24px_rgba(232,176,74,0.25)]"
          >
            {message}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
