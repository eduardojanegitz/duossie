"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { getViewer, onboardingStage, pathForStage } from "@/server/auth/viewer";
import { toUserMessage, type ActionResult } from "@/server/errors";

const codenameSchema = z
  .string()
  .trim()
  .min(2, "Use pelo menos 2 caracteres.")
  .max(24, "Use no máximo 24 caracteres.")
  .regex(/^[\p{L}\p{N} .'-]+$/u, "Use letras, números, espaço, ponto, apóstrofo ou hífen.");

export async function saveCodename(input: {
  codename: string;
}): Promise<ActionResult<{ next: string }>> {
  const parsed = codenameSchema.safeParse(input.codename);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Codinome inválido." };
  }

  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sua sessão expirou. Entre novamente." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ codename: parsed.data })
    .eq("id", viewer.userId);
  if (error) return { ok: false, error: toUserMessage(error, "saveCodename") };

  const hasDuo = viewer.duo !== null;
  const next = hasDuo
    ? pathForStage(onboardingStage({ ...viewer, profile: { ...viewer.profile, codename: parsed.data } }))
    : "/dupla";
  return { ok: true, data: { next } };
}
