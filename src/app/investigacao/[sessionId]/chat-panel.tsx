"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, LifeBuoy, Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { markChatRead } from "@/server/actions/collab";
import type { MessageView } from "@/server/game/collab";
import { useCollab } from "./use-collab";

import { formatTime } from "@/lib/format";

export function ChatPanel({
  sessionId,
  messages,
  partnerName,
  evidenceOptions,
  open,
  unread,
}: {
  sessionId: string;
  messages: MessageView[];
  partnerName: string;
  evidenceOptions: { id: string; title: string }[];
  open: boolean;
  unread: number;
}) {
  const router = useRouter();
  const { chat, pending } = useCollab(sessionId);
  const [body, setBody] = useState("");
  const [evidenceId, setEvidenceId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // Marca como lidas ao abrir e quando chegam mensagens com o painel aberto.
  useEffect(() => {
    if (!open) return;
    bottom.current?.scrollIntoView({ block: "end" });
    if (unread === 0) return;
    void markChatRead({ sessionId }).then((r) => r.ok && router.refresh());
  }, [open, messages.length, sessionId, unread, router]);

  return (
    <div className="flex h-full flex-col">
      <ol className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3" aria-label="Mensagens" data-testid="chat-messages">
        {messages.length === 0 ? (
          <li className="text-sm text-paper-500">Nenhuma mensagem. Use o chat para combinar o que cada um vai olhar.</li>
        ) : null}
        {messages.map((m) => (
          <li key={m.id} className={cn("flex max-w-[85%] flex-col gap-1", m.mine ? "self-end items-end" : "self-start")}>
            <div
              className={cn(
                "rounded-sm px-3 py-2 text-sm",
                m.kind === "help" ? "border border-amber-500 bg-ink-900 text-amber-400" : m.mine ? "bg-ink-700 text-paper-50" : "bg-ink-850 text-paper-100",
              )}
            >
              {m.kind === "help" ? (
                <p className="flex items-center gap-2">
                  <LifeBuoy aria-hidden className="size-4 shrink-0" />
                  {m.mine ? "Você pediu ajuda" : `${partnerName} pediu ajuda`} em: {m.puzzle?.title ?? "um enigma"}
                </p>
              ) : null}
              {m.body ? <p className="whitespace-pre-wrap">{m.body}</p> : null}
              {m.evidence ? (
                "redacted" in m.evidence ? (
                  <p className="mt-1 flex items-center gap-1 text-xs italic text-paper-500">
                    <EyeOff aria-hidden className="size-3" /> Evidência que só {partnerName} tem
                  </p>
                ) : (
                  <p className="mt-1 flex items-center gap-1 text-xs text-paper-300">
                    <Paperclip aria-hidden className="size-3" /> {m.evidence.title}
                  </p>
                )
              ) : null}
            </div>
            <time dateTime={m.at} className="font-mono text-[10px] text-paper-500">
              {m.mine ? "Você" : partnerName} · {formatTime(m.at)}
            </time>
          </li>
        ))}
        <div ref={bottom} />
      </ol>

      <form
        className="flex flex-col gap-2 border-t border-ink-700 p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!body.trim()) return;
          setError(null);
          const err = await chat({ kind: "text", body, ...(evidenceId ? { evidenceId } : {}) });
          if (err) setError(err);
          else {
            setBody("");
            setEvidenceId("");
          }
        }}
      >
        {error ? (
          <p role="alert" className="text-xs text-stamp-500">
            {error}
          </p>
        ) : null}
        <label className="sr-only" htmlFor="chat-evidence">
          Anexar evidência
        </label>
        <select
          id="chat-evidence"
          value={evidenceId}
          onChange={(e) => setEvidenceId(e.target.value)}
          className="min-h-11 rounded-sm border border-ink-600 bg-ink-900 px-2 text-sm text-paper-300"
        >
          <option value="">Sem evidência anexada</option>
          {evidenceOptions.map((ev) => (
            <option key={ev.id} value={ev.id}>
              📎 {ev.title}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="chat-body">
            Mensagem para {partnerName}
          </label>
          <input
            id="chat-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            autoComplete="off"
            placeholder={`Mensagem para ${partnerName}`}
            className="min-h-12 flex-1 rounded-sm border border-ink-600 bg-ink-900 px-3 text-base text-paper-50 focus:border-amber-500 focus:outline-none"
          />
          <Button type="submit" size="icon-lg" className="size-12" aria-label="Enviar mensagem" disabled={pending || !body.trim()}>
            <Send aria-hidden />
          </Button>
        </div>
      </form>
    </div>
  );
}
