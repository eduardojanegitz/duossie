"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionOutcome, GameAction } from "@/engine";
import { sendGameAction } from "@/server/actions/game";

export type DispatchResult = { ok: true; outcome: ActionOutcome } | { ok: false; error: string };

/**
 * Envia uma ação ao servidor com um id único (idempotência) e atualiza a visão.
 * A visão sempre vem do servidor: o cliente nunca calcula o estado do jogo.
 */
export function useGameAction(sessionId: string) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const dispatch = useCallback(
    (action: GameAction): Promise<DispatchResult> =>
      new Promise((resolve) => {
        startTransition(async () => {
          const result = await sendGameAction({ sessionId, actionId: crypto.randomUUID(), action });
          if (result.ok) {
            router.refresh();
            resolve({ ok: true, outcome: result.data.outcome });
          } else {
            resolve({ ok: false, error: result.error });
          }
        });
      }),
    [router, sessionId],
  );

  return { dispatch, pending };
}
