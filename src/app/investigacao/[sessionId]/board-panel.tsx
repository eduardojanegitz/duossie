"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EyeOff, LayoutGrid, List, Plus, Star, Trash2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { BoardItemView, BoardLinkView, BoardStatus, BoardView } from "@/server/game/collab";
import { useCollab } from "./use-collab";

const STATUS_LABEL: Record<BoardStatus, string> = {
  hypothesis: "Hipótese",
  confirmed: "Confirmado",
  contradiction: "Contradição",
};
const STATUS_STYLE: Record<BoardStatus, string> = {
  hypothesis: "border-dashed border-paper-500 text-paper-300",
  confirmed: "border-signal-500 text-signal-400",
  contradiction: "border-stamp-500 text-stamp-500",
};
const LINE: Record<BoardStatus, { stroke: string; dash?: string }> = {
  hypothesis: { stroke: "var(--paper-500)", dash: "6 5" },
  confirmed: { stroke: "var(--signal-400)" },
  contradiction: { stroke: "var(--stamp-500)", dash: "2 4" },
};

export function itemTitle(item: BoardItemView, partnerName: string) {
  if (item.kind === "note") return item.mine ? "Sua anotação" : `Anotação de ${partnerName}`;
  if (item.evidence) return item.evidence.title;
  return `Evidência de ${partnerName}`;
}

export function BoardPanel({ sessionId, board, partnerName }: { sessionId: string; board: BoardView; partnerName: string }) {
  const { board: run, pending } = useCollab(sessionId);
  const [mode, setMode] = useState<"list" | "desk">("list");
  const [error, setError] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);

  const exec = async (command: Record<string, unknown>) => {
    setError(null);
    const e = await run(command);
    if (e) setError(e);
    return e;
  };

  return (
    <section aria-labelledby="board-title" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="board-title" className="font-mono text-xs uppercase tracking-[0.25em] text-paper-500">
          Quadro de evidências
        </h2>
        <div className="hidden gap-1 lg:flex" role="group" aria-label="Modo de exibição">
          <Button size="icon-sm" variant={mode === "list" ? "secondary" : "ghost"} aria-pressed={mode === "list"} aria-label="Lista" onClick={() => setMode("list")}>
            <List aria-hidden />
          </Button>
          <Button size="icon-sm" variant={mode === "desk" ? "secondary" : "ghost"} aria-pressed={mode === "desk"} aria-label="Mesa" onClick={() => setMode("desk")}>
            <LayoutGrid aria-hidden />
          </Button>
        </div>
      </div>

      <p className="text-sm text-paper-500">
        Fixe evidências pelo arquivo, anote hipóteses e conecte o que se relaciona. Itens privados só você vê; uma evidência que{" "}
        {partnerName} não tem aparece tarjada para ele.
      </p>

      {noteOpen ? (
        <NoteForm
          pending={pending}
          onCancel={() => setNoteOpen(false)}
          onSubmit={async (body, visibility, group) => {
            const e = await exec({ type: "note", body, visibility, ...(group ? { group } : {}) });
            if (!e) setNoteOpen(false);
          }}
        />
      ) : (
        <Button variant="outline" onClick={() => setNoteOpen(true)} className="self-start">
          <Plus aria-hidden /> Nova anotação
        </Button>
      )}

      {error ? (
        <p role="alert" className="text-sm text-stamp-500">
          {error}
        </p>
      ) : null}

      {board.items.length === 0 ? (
        <p className="rounded-sm border border-dashed border-ink-600 p-6 text-center text-sm text-paper-500">
          O quadro está vazio. Abra uma evidência e toque em “Fixar no quadro”.
        </p>
      ) : mode === "desk" ? (
        <Desk board={board} partnerName={partnerName} exec={exec} />
      ) : (
        <BoardList board={board} partnerName={partnerName} exec={exec} pending={pending} />
      )}
    </section>
  );
}

function NoteForm({
  pending,
  onSubmit,
  onCancel,
}: {
  pending: boolean;
  onSubmit: (body: string, visibility: "private" | "shared", group: string) => void;
  onCancel: () => void;
}) {
  const [body, setBody] = useState("");
  const [group, setGroup] = useState("");
  const [priv, setPriv] = useState(false);
  return (
    <form
      className="flex flex-col gap-3 rounded-sm border border-ink-600 bg-ink-900 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (body.trim()) onSubmit(body, priv ? "private" : "shared", group.trim());
      }}
    >
      <label className="flex flex-col gap-1 text-sm text-paper-300">
        Anotação
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={500}
          rows={3}
          className="rounded-sm border border-ink-600 bg-ink-950 p-3 text-base text-paper-50 focus:border-amber-500 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-paper-300">
        Grupo (opcional)
        <input
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          maxLength={40}
          placeholder="Ex.: Horários"
          className="min-h-12 rounded-sm border border-ink-600 bg-ink-950 px-3 text-base text-paper-50 focus:border-amber-500 focus:outline-none"
        />
      </label>
      <label className="flex min-h-12 items-center gap-3 text-sm text-paper-300">
        <input type="checkbox" checked={priv} onChange={(e) => setPriv(e.target.checked)} className="size-4 accent-[var(--amber-500)]" />
        Só para mim (privada)
      </label>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || !body.trim()}>
          Adicionar
        </Button>
        <Button type="button" variant="quiet" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

type Exec = (command: Record<string, unknown>) => Promise<string | null>;

function BoardList({ board, partnerName, exec, pending }: { board: BoardView; partnerName: string; exec: Exec; pending: boolean }) {
  const groups = useMemo(() => {
    const map = new Map<string, BoardItemView[]>();
    for (const item of board.items) {
      const key = item.group ?? "";
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
  }, [board.items]);

  return (
    <div className="flex flex-col gap-6" data-testid="board-list">
      {groups.map(([group, items]) => (
        <section key={group || "_"} aria-label={group || "Sem grupo"} className="flex flex-col gap-3">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.25em] text-amber-400">{group || "Sem grupo"}</h3>
          {items.map((item) => (
            <BoardCard key={item.id} item={item} board={board} partnerName={partnerName} exec={exec} pending={pending} />
          ))}
        </section>
      ))}
    </div>
  );
}

function BoardCard({ item, board, partnerName, exec, pending }: { item: BoardItemView; board: BoardView; partnerName: string; exec: Exec; pending: boolean }) {
  const [linkTarget, setLinkTarget] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [group, setGroup] = useState(item.group ?? "");
  const title = itemTitle(item, partnerName);
  const links = board.links.filter((l) => l.from === item.id || l.to === item.id);
  const others = board.items.filter((o) => o.id !== item.id && !links.some((l) => l.from === o.id || l.to === o.id));

  return (
    <article
      data-testid="board-item"
      aria-label={title}
      className={cn("flex flex-col gap-3 rounded-sm border bg-ink-850 p-4", item.highlight ? "border-amber-500" : "border-ink-600")}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper-500">
            {item.kind === "note" ? "Anotação" : "Evidência"} · {item.mine ? "sua" : partnerName}
            {item.visibility === "private" ? " · privada" : ""}
          </p>
          <h4 className={cn("text-paper-50", item.redacted && "italic text-paper-500")}>
            {item.redacted ? <EyeOff aria-hidden className="mr-1 inline size-4" /> : null}
            {title}
          </h4>
        </div>
        <button
          type="button"
          aria-pressed={item.highlight}
          aria-label={item.highlight ? "Remover destaque" : "Destacar"}
          disabled={pending}
          onClick={() => exec({ type: "update", itemId: item.id, highlight: !item.highlight })}
          className="grid size-11 shrink-0 place-items-center rounded-sm text-paper-500 hover:text-amber-400"
        >
          <Star aria-hidden className={cn("size-5", item.highlight && "fill-amber-500 text-amber-500")} />
        </button>
      </header>

      {item.evidence ? <p className="text-sm text-paper-500">{item.evidence.summary}</p> : null}
      {item.redacted ? <p className="text-sm text-paper-500">Só {partnerName} vê esta evidência. Pergunte o que ela diz.</p> : null}
      {item.body ? <p className="whitespace-pre-wrap text-paper-100">{item.body}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`status-${item.id}`}>
          Status
        </label>
        <select
          id={`status-${item.id}`}
          value={item.status}
          disabled={pending}
          onChange={(e) => exec({ type: "update", itemId: item.id, status: e.target.value })}
          className={cn("min-h-11 rounded-sm border bg-ink-900 px-2 font-mono text-xs uppercase tracking-[0.15em]", STATUS_STYLE[item.status])}
        >
          {(Object.keys(STATUS_LABEL) as BoardStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            exec({ type: "update", itemId: item.id, group: group.trim() || null });
          }}
        >
          <label className="sr-only" htmlFor={`group-${item.id}`}>
            Grupo
          </label>
          <input
            id={`group-${item.id}`}
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            onBlur={() => group.trim() !== (item.group ?? "") && exec({ type: "update", itemId: item.id, group: group.trim() || null })}
            placeholder="Grupo"
            maxLength={40}
            className="min-h-11 w-32 rounded-sm border border-ink-600 bg-ink-900 px-2 text-sm text-paper-100 focus:border-amber-500 focus:outline-none"
          />
        </form>
        {item.mine ? (
          <Button
            size="icon-sm"
            variant="ghost"
            className="ml-auto size-11"
            aria-label={`Remover "${title}" do quadro`}
            disabled={pending}
            onClick={() => exec({ type: "remove", itemId: item.id })}
          >
            <Trash2 aria-hidden />
          </Button>
        ) : null}
      </div>

      {links.length > 0 ? (
        <ul className="flex flex-col gap-1 border-t border-ink-700 pt-3" aria-label="Conexões">
          {links.map((l) => {
            const otherId = l.from === item.id ? l.to : l.from;
            const other = board.items.find((o) => o.id === otherId)!;
            return (
              <li key={l.id} className="flex items-center gap-2 text-sm">
                <span className={cn("rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase", STATUS_STYLE[l.status])}>{STATUS_LABEL[l.status]}</span>
                <span className="flex-1 text-paper-100">
                  ↔ {itemTitle(other, "parceiro")}
                  {l.label ? <span className="text-paper-500"> — {l.label}</span> : null}
                </span>
                <select
                  aria-label="Status da conexão"
                  value={l.status}
                  disabled={pending}
                  onChange={(e) => exec({ type: "update_link", linkId: l.id, status: e.target.value })}
                  className="min-h-11 rounded-sm border border-ink-600 bg-ink-900 px-1 text-xs text-paper-300"
                >
                  {(Object.keys(STATUS_LABEL) as BoardStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                <Button size="icon-sm" variant="ghost" className="size-11" aria-label="Desfazer conexão" disabled={pending} onClick={() => exec({ type: "unlink", linkId: l.id })}>
                  <Unlink aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {others.length > 0 ? (
        <form
          className="flex flex-col gap-2 border-t border-ink-700 pt-3 sm:flex-row"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!linkTarget) return;
            const err = await exec({ type: "link", from: item.id, to: linkTarget, ...(linkLabel.trim() ? { label: linkLabel.trim() } : {}) });
            if (!err) {
              setLinkTarget("");
              setLinkLabel("");
            }
          }}
        >
          <label className="sr-only" htmlFor={`link-${item.id}`}>
            Conectar com
          </label>
          <select
            id={`link-${item.id}`}
            value={linkTarget}
            onChange={(e) => setLinkTarget(e.target.value)}
            className="min-h-11 flex-1 rounded-sm border border-ink-600 bg-ink-900 px-2 text-sm text-paper-100"
          >
            <option value="">Conectar com…</option>
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {itemTitle(o, partnerName)}
              </option>
            ))}
          </select>
          <input
            aria-label="Rótulo da conexão"
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
            maxLength={80}
            placeholder="Por quê? (opcional)"
            className="min-h-11 flex-1 rounded-sm border border-ink-600 bg-ink-900 px-2 text-sm text-paper-100 focus:border-amber-500 focus:outline-none"
          />
          <Button type="submit" size="sm" className="min-h-11" variant="outline" disabled={pending || !linkTarget}>
            Conectar
          </Button>
        </form>
      ) : null}
    </article>
  );
}

const CARD_W = 220;
const CARD_H = 96;

/** Mesa (desktop): cartões arrastáveis com conexões desenhadas. */
function Desk({ board, partnerName, exec }: { board: BoardView; partnerName: string; exec: Exec }) {
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const surface = useRef<HTMLDivElement>(null);

  // Quando o servidor devolve novas posições, a posição local temporária deixa de valer.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setPositions({}));
    return () => cancelAnimationFrame(frame);
  }, [board]);

  const pos = (item: BoardItemView) => positions[item.id] ?? { x: item.x, y: item.y };
  const byId = new Map(board.items.map((i) => [i.id, i]));
  const width = Math.max(900, ...board.items.map((i) => pos(i).x + CARD_W + 40));
  const height = Math.max(560, ...board.items.map((i) => pos(i).y + CARD_H + 40));

  const center = (id: string) => {
    const item = byId.get(id)!;
    const p = pos(item);
    return { x: p.x + CARD_W / 2, y: p.y + CARD_H / 2 };
  };

  return (
    <div className="overflow-auto rounded-sm border border-ink-600 bg-ink-900" data-testid="board-desk">
      <div ref={surface} className="relative" style={{ width, height, backgroundImage: "radial-gradient(var(--ink-700) 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
        <svg className="pointer-events-none absolute inset-0" width={width} height={height} aria-hidden>
          {board.links.map((l: BoardLinkView) => {
            const a = center(l.from);
            const b = center(l.to);
            return (
              <g key={l.id}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={LINE[l.status].stroke} strokeWidth={1.5} strokeDasharray={LINE[l.status].dash} />
                {l.label ? (
                  <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 6} fill="var(--paper-300)" fontSize={11} textAnchor="middle">
                    {l.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
        {board.items.map((item) => {
          const p = pos(item);
          return (
            <div
              key={item.id}
              role="group"
              aria-label={itemTitle(item, partnerName)}
              onPointerDown={(e) => {
                const rect = surface.current!.getBoundingClientRect();
                drag.current = { id: item.id, dx: e.clientX - rect.left - p.x, dy: e.clientY - rect.top - p.y };
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (drag.current?.id !== item.id) return;
                const rect = surface.current!.getBoundingClientRect();
                setPositions((prev) => ({
                  ...prev,
                  [item.id]: { x: Math.max(0, e.clientX - rect.left - drag.current!.dx), y: Math.max(0, e.clientY - rect.top - drag.current!.dy) },
                }));
              }}
              onPointerUp={() => {
                if (drag.current?.id !== item.id) return;
                drag.current = null;
                const final = positions[item.id];
                if (final) void exec({ type: "update", itemId: item.id, x: Math.round(final.x), y: Math.round(final.y) });
              }}
              className={cn(
                "absolute flex cursor-grab touch-none select-none flex-col gap-1 rounded-sm border bg-ink-850 p-3 shadow-[2px_3px_0_rgba(0,0,0,0.4)] active:cursor-grabbing",
                item.highlight ? "border-amber-500" : "border-ink-600",
              )}
              style={{ left: p.x, top: p.y, width: CARD_W, minHeight: CARD_H }}
            >
              <span className={cn("self-start rounded-sm border px-1.5 font-mono text-[9px] uppercase tracking-[0.15em]", STATUS_STYLE[item.status])}>
                {STATUS_LABEL[item.status]}
              </span>
              <span className={cn("text-sm text-paper-50", item.redacted && "italic text-paper-500")}>{itemTitle(item, partnerName)}</span>
              {item.body ? <span className="line-clamp-2 text-xs text-paper-300">{item.body}</span> : null}
            </div>
          );
        })}
      </div>
      <p className="border-t border-ink-700 p-2 text-xs text-paper-500">Arraste os cartões para organizar. Status, grupos e conexões ficam na lista.</p>
    </div>
  );
}
