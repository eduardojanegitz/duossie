"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionOutcome } from "@/engine";
import { getViewer } from "@/server/auth/viewer";
import type { ActionResult } from "@/server/errors";
import { GameError, performAction, startInvestigation as start } from "@/server/game/service";

const GAME_MESSAGES: Record<GameError["code"], string> = {
  not_found: "Investigação não encontrada.",
  forbidden: "Você não participa desta investigação.",
  not_playable: "Este caso ainda não está disponível.",
  locked: "Este caso ainda está bloqueado para a dupla.",
  already_started: "A dupla já abriu esta investigação.",
  conflict: "Muitas ações ao mesmo tempo. Tente de novo.",
  rate_limited: "Muitas tentativas seguidas. Respire, converse com o parceiro e tente em alguns minutos.",
  case_completed: "O relatório já foi enviado. Reabra a investigação para mudar algo.",
  unknown_evidence: "Evidência desconhecida.",
  evidence_unavailable: "Esta evidência não está disponível para você.",
  not_shareable: "Esta evidência não pode ser enviada ao parceiro.",
  already_shared: "Você já compartilhou esta evidência.",
  unknown_puzzle: "Enigma desconhecido.",
  puzzle_unavailable: "Este enigma ainda não está disponível.",
  already_solved: "Este enigma já foi resolvido.",
  invalid_answer: "Preencha a resposta completa antes de enviar.",
  no_more_hints: "Não há mais dicas para você neste enigma.",
  theory_unavailable: "O relatório final ainda não está disponível.",
  invalid_theory: "Responda todas as perguntas do relatório.",
  no_proposal: "Não há relatório proposto.",
  own_proposal: "Seu parceiro precisa revisar e confirmar o relatório que você propôs.",
  already_confirmed: "Você já confirmou este relatório.",
  cannot_reopen: "Esta investigação não pode ser reaberta.",
  not_your_control: "Esse comando está do lado do seu parceiro.",
  unknown_decision: "Decisão desconhecida.",
  decision_unavailable: "Esta decisão ainda não está disponível.",
  decision_resolved: "Esta decisão já foi tomada.",
  invalid_option: "Opção inválida.",
};

function gameMessage(error: unknown, context: string): string {
  if (error instanceof GameError) return GAME_MESSAGES[error.code];
  if (error instanceof z.ZodError) return "Ação inválida.";
  console.error(`[${context}]`, error instanceof Error ? error.message : error);
  return "Algo deu errado. Seu progresso está salvo; tente de novo.";
}

const startSchema = z.object({ caseId: z.string().regex(/^case-\d{3}$/), role: z.enum(["A", "B"]) });

export async function startInvestigation(input: { caseId: string; role: "A" | "B" }): Promise<ActionResult> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Escolha um papel." };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sua sessão expirou. Entre novamente." };

  let sessionId: string;
  try {
    sessionId = await start(viewer, parsed.data.caseId, parsed.data.role);
  } catch (error) {
    return { ok: false, error: gameMessage(error, "startInvestigation") };
  }
  redirect(`/investigacao/${sessionId}`);
}

const actionInput = z.object({ sessionId: z.uuid(), actionId: z.uuid(), action: z.unknown() });

export async function sendGameAction(input: {
  sessionId: string;
  actionId: string;
  action: unknown;
}): Promise<ActionResult<{ outcome: ActionOutcome }>> {
  const parsed = actionInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ação inválida." };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sua sessão expirou. Entre novamente." };
  try {
    const { outcome } = await performAction(viewer, parsed.data.sessionId, parsed.data.actionId, parsed.data.action);
    return { ok: true, data: { outcome } };
  } catch (error) {
    return { ok: false, error: gameMessage(error, "sendGameAction") };
  }
}
