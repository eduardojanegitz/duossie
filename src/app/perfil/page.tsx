import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { FileLabel, LoadingFile, Screen } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { onboardingStage } from "@/lib/onboarding";
import { signOut } from "@/server/actions/auth";
import { requireViewer } from "@/server/auth/viewer";
import { CodenameForm } from "./codename-form";

export const metadata: Metadata = { title: "Perfil" };

export default function PerfilPage() {
  return (
    <Screen className="gap-8 py-2">
      <Suspense fallback={<LoadingFile />}>
        <ProfileSection />
      </Suspense>
    </Screen>
  );
}

async function ProfileSection() {
  const viewer = await requireViewer("profile");
  const onboarding = !viewer.profile.codename;
  const ready = onboardingStage(viewer) === "ready";

  return (
    <>
      {ready ? <AppHeader back={{ href: "/central", label: "Central" }} /> : <div className="h-12" />}
      <header className="flex flex-col gap-3">
        <FileLabel>Ficha do investigador</FileLabel>
        <h1 className="text-3xl font-medium text-paper-50">
          {onboarding ? "Como você quer ser identificado?" : viewer.profile.codename}
        </h1>
        <p className="text-paper-300">Seu codinome aparece para o seu parceiro durante as investigações.</p>
      </header>
      <CodenameForm initial={viewer.profile.codename ?? ""} />
      {!onboarding ? (
        <section className="flex flex-col gap-4 border-t border-ink-700 pt-6">
          <dl className="flex flex-col gap-3 text-sm">
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper-500">E-mail</dt>
              <dd className="text-paper-100">{viewer.email ?? "—"}</dd>
            </div>
            {viewer.duo ? (
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper-500">Dupla</dt>
                <dd className="text-paper-100">{viewer.duo.name}</dd>
              </div>
            ) : null}
          </dl>
          <form action={signOut}>
            <Button type="submit" variant="outline" block>
              Sair
            </Button>
          </form>
        </section>
      ) : null}
    </>
  );
}
