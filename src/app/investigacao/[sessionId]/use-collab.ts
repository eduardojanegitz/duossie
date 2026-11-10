"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { boardAction, chatAction } from "@/server/actions/collab";

/** Comandos do quadro e do chat. Como nas ações do jogo, a verdade volta do servidor. */
export function useCollab(sessionId: string) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = useCallback(
    (fn: () => Promise<{ ok: boolean; error?: string }>) =>
      new Promise<string | null>((resolve) =>
        startTransition(async () => {
          const result = await fn();
          if (result.ok) router.refresh();
          resolve(result.ok ? null : (result.error ?? "Erro"));
        }),
      ),
    [router],
  );

  return {
    pending,
    board: (command: Record<string, unknown>) => run(() => boardAction({ sessionId, command })),
    chat: (message: Record<string, unknown>) => run(() => chatAction({ sessionId, message })),
  };
}
