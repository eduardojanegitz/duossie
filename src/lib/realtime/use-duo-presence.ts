"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

/** O que o jogador está fazendo, compartilhado só com o parceiro. */
export type Activity = { kind: "central" } | { kind: "case"; caseId: string };

export type PartnerStatus = "connecting" | "offline" | "online" | "away" | "investigating";

type PresencePayload = { activity: Activity; visible: boolean; at: number };

/**
 * Presença no canal privado `duo:<id>` (autorizado por RLS em realtime.messages).
 * Publica a atividade do jogador e devolve o status do parceiro.
 * É efêmera de propósito: nada aqui é fonte de verdade do jogo.
 */
export function useDuoPresence(params: {
  duoId: string;
  userId: string;
  partnerId: string | null;
  activity: Activity;
  /** Sinal do servidor de que uma sessão mudou (não traz conteúdo do jogo). */
  onSessionUpdated?: (payload: { sessionId: string; version: number }) => void;
  /** Chamado ao (re)conectar: momento de buscar o estado atual no servidor. */
  onReconnect?: () => void;
}) {
  const { duoId, userId, partnerId } = params;
  const onSessionUpdated = useRef(params.onSessionUpdated);
  const onReconnect = useRef(params.onReconnect);
  useEffect(() => {
    onSessionUpdated.current = params.onSessionUpdated;
    onReconnect.current = params.onReconnect;
  });
  const activityKey = JSON.stringify(params.activity);
  const [partner, setPartner] = useState<{ status: PartnerStatus; activity: Activity | null }>({
    status: "connecting",
    activity: null,
  });

  useEffect(() => {
    const activity = JSON.parse(activityKey) as Activity;
    const supabase = getSupabaseBrowserClient();
    let cancelled = false;

    const channel = supabase.channel(`duo:${duoId}`, {
      config: { private: true, presence: { key: userId } },
    });

    const readPartner = () => {
      if (!partnerId) return setPartner({ status: "offline", activity: null });
      const state = channel.presenceState<PresencePayload>();
      const metas = state[partnerId];
      const latest = metas?.toSorted((a, b) => b.at - a.at)[0];
      if (!latest) return setPartner({ status: "offline", activity: null });
      const status: PartnerStatus = !latest.visible
        ? "away"
        : latest.activity.kind === "case"
          ? "investigating"
          : "online";
      setPartner({ status, activity: latest.activity });
    };

    const track = () =>
      channel.track({ activity, visible: document.visibilityState === "visible", at: Date.now() } satisfies PresencePayload);

    const onVisibility = () => {
      void track();
    };

    void (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      let subscribedOnce = false;
      channel
        .on("presence", { event: "sync" }, readPartner)
        .on("broadcast", { event: "session_updated" }, (message) => {
          onSessionUpdated.current?.(message.payload as { sessionId: string; version: number });
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            void track();
            // Reconexão: eventos podem ter sido perdidos enquanto o socket estava fora.
            if (subscribedOnce) onReconnect.current?.();
            subscribedOnce = true;
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setPartner((p) => ({ ...p, status: p.status === "connecting" ? "offline" : p.status }));
          }
        });
      document.addEventListener("visibilitychange", onVisibility);
    })();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void supabase.removeChannel(channel);
    };
  }, [duoId, userId, partnerId, activityKey]);

  return partner;
}
