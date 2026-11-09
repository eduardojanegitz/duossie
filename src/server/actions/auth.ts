"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { getViewer, onboardingStage, pathForStage } from "@/server/auth/viewer";
import type { ActionResult } from "@/server/errors";

const emailSchema = z.email().max(254).transform((v) => v.trim().toLowerCase());
const codeSchema = z.string().trim().regex(/^\d{6}$/);

export async function requestAccessCode(input: { email: string }): Promise<ActionResult> {
  const email = emailSchema.safeParse(input.email);
  if (!email.success) return { ok: false, error: "Informe um e-mail válido." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { shouldCreateUser: true },
  });

  if (error) {
    // Rejeição da allowlist (hook) ou limite de envio. Mensagem neutra de propósito.
    if (error.status === 429) {
      return { ok: false, error: "Muitos pedidos de código. Aguarde um minuto e tente de novo." };
    }
    if (error.status === 403 || error.status === 422 || error.status === 400) {
      return { ok: false, error: "Este endereço não tem acesso ao Duossie." };
    }
    console.error("[requestAccessCode]", { status: error.status, code: error.code });
    return { ok: false, error: "Não foi possível enviar o código agora. Tente novamente." };
  }
  return { ok: true };
}

export async function verifyAccessCode(input: {
  email: string;
  code: string;
}): Promise<ActionResult<{ next: string }>> {
  const email = emailSchema.safeParse(input.email);
  const code = codeSchema.safeParse(input.code);
  if (!email.success || !code.success) {
    return { ok: false, error: "O código tem 6 dígitos." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    email: email.data,
    token: code.data,
    type: "email",
  });
  if (error) {
    return { ok: false, error: "Código incorreto ou expirado." };
  }

  const viewer = await getViewer();
  return { ok: true, data: { next: pathForStage(onboardingStage(viewer)) } };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}
