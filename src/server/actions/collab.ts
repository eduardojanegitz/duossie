"use server";

import { z } from "zod";
import { getViewer } from "@/server/auth/viewer";
import type { ActionResult } from "@/server/errors";
import { markRead, runBoardCommand, sendMessage } from "@/server/game/collab";
import { GameError } from "@/server/game/service";

const MESSAGES: Partial<Record<GameError["code"], string>> = {
  not_found: "Item não encontrado.",
  forbidden: "Só quem criou pode alterar isso.",
  evidence_unavailable: "Você não tem acesso a essa evidência.",
  already_shared: "Isso já está no quadro.",
  puzzle_unavailable: "Esse enigma não está aberto.",
  rate_limited: "Muitas mensagens seguidas. Aguarde um instante.",
};

function message(error: unknown, context: string) {
  if (error instanceof GameError) return MESSAGES[error.code] ?? "Ação não permitida.";
  if (error instanceof z.ZodError) return "Dados inválidos.";
  console.error(`[${context}]`, error instanceof Error ? error.message : error);
  return "Algo deu errado. Tente de novo.";
}

const sessionSchema = z.uuid();

export async function boardAction(input: { sessionId: string; command: unknown }): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sua sessão expirou. Entre novamente." };
  try {
    await runBoardCommand(viewer, sessionSchema.parse(input.sessionId), input.command);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error, "boardAction") };
  }
}

export async function chatAction(input: { sessionId: string; message: unknown }): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sua sessão expirou. Entre novamente." };
  try {
    await sendMessage(viewer, sessionSchema.parse(input.sessionId), input.message);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error, "chatAction") };
  }
}

export async function markChatRead(input: { sessionId: string }): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sua sessão expirou." };
  try {
    await markRead(viewer, sessionSchema.parse(input.sessionId));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error, "markChatRead") };
  }
}
