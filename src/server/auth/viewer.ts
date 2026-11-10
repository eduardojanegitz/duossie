import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { isAtLeast, onboardingStage, pathForStage, type OnboardingStage } from "@/lib/onboarding";

export { onboardingStage, pathForStage };

export type Investigator = { id: string; codename: string | null };

export type Viewer = {
  userId: string;
  email: string | null;
  profile: Investigator;
  duo: { id: string; name: string; members: Investigator[] } | null;
};

/**
 * Data Access Layer: lê a sessão e o contexto do jogador uma vez por requisição.
 * Retorna `null` se não houver sessão válida.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  // A validação do JWT usa o relógio: marca explicitamente como dado de requisição.
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return null;

  const userId = claims.sub;

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("id, codename").eq("id", userId).maybeSingle(),
    supabase.from("duo_members").select("duo_id").eq("user_id", userId).maybeSingle(),
  ]);

  // Token válido de um usuário que não existe mais (conta removida): trata como sem sessão.
  if (!profile) return null;

  let duo: Viewer["duo"] = null;
  if (membership) {
    const [{ data: duoRow }, { data: members }] = await Promise.all([
      supabase.from("duos").select("id, name").eq("id", membership.duo_id).single(),
      supabase
        .from("duo_members")
        .select("user_id, joined_at, profiles(id, codename)")
        .eq("duo_id", membership.duo_id)
        .order("joined_at"),
    ]);
    if (duoRow) {
      duo = {
        id: duoRow.id,
        name: duoRow.name,
        members: (members ?? []).map((m) => ({
          id: m.user_id,
          codename: m.profiles?.codename ?? null,
        })),
      };
    }
  }

  return {
    userId,
    email: typeof claims.email === "string" ? claims.email : null,
    profile: { id: userId, codename: profile.codename },
    duo,
  };
});

/**
 * Garante que o jogador está pelo menos na etapa exigida; caso contrário, redireciona.
 */
export async function requireViewer(required: OnboardingStage): Promise<Viewer> {
  const viewer = await getViewer();
  const stage = onboardingStage(viewer);
  if (!viewer || !isAtLeast(stage, required)) {
    redirect(pathForStage(stage));
  }
  return viewer;
}
