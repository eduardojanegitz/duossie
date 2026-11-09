/** Regras puras do onboarding (sem dependências de servidor, testáveis em unidade). */

export type OnboardingSubject = {
  profile: { codename: string | null };
  duo: { members: readonly unknown[] } | null;
};

/** Etapa do onboarding em que o jogador está. */
export type OnboardingStage = "anonymous" | "profile" | "duo" | "partner" | "ready";

export function onboardingStage(viewer: OnboardingSubject | null): OnboardingStage {
  if (!viewer) return "anonymous";
  if (!viewer.profile.codename) return "profile";
  if (!viewer.duo) return "duo";
  if (viewer.duo.members.length < 2) return "partner";
  return "ready";
}

const STAGE_PATH: Record<OnboardingStage, string> = {
  anonymous: "/entrar",
  profile: "/perfil",
  duo: "/dupla",
  partner: "/dupla",
  ready: "/central",
};

export function pathForStage(stage: OnboardingStage) {
  return STAGE_PATH[stage];
}

const ORDER: readonly OnboardingStage[] = ["anonymous", "profile", "duo", "partner", "ready"];

/** `true` se `stage` já alcançou (ou passou) a etapa `required`. */
export function isAtLeast(stage: OnboardingStage, required: OnboardingStage) {
  return ORDER.indexOf(stage) >= ORDER.indexOf(required);
}
