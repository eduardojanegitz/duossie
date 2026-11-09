"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { toUserMessage, type ActionResult } from "@/server/errors";

const duoNameSchema = z.string().trim().min(2, "Use pelo menos 2 caracteres.").max(40, "Use no máximo 40 caracteres.");
const inviteCodeSchema = z
  .string()
  .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ""))
  .pipe(z.string().length(8, "O código tem 8 caracteres (ex.: K7QX-M2PD)."));

export async function createDuo(input: { name: string }): Promise<ActionResult> {
  const parsed = duoNameSchema.safeParse(input.name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Nome inválido." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_duo", { p_name: parsed.data });
  if (error) return { ok: false, error: toUserMessage(error, "createDuo") };

  revalidatePath("/dupla");
  return { ok: true };
}

export async function createInvite(): Promise<ActionResult<{ code: string; expiresAt: string }>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_duo_invite");
  const row = data?.[0];
  if (error || !row) return { ok: false, error: toUserMessage(error, "createInvite") };
  return { ok: true, data: { code: row.code, expiresAt: row.expires_at } };
}

export async function joinDuo(input: { code: string }): Promise<ActionResult> {
  const parsed = inviteCodeSchema.safeParse(input.code);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Código inválido." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("join_duo", { p_code: parsed.data });
  if (error) return { ok: false, error: toUserMessage(error, "joinDuo") };
  if (!data) return { ok: false, error: "Código inválido, expirado ou já utilizado." };

  revalidatePath("/dupla");
  return { ok: true };
}
