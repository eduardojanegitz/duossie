import type { Metadata } from "next";
import { Suspense } from "react";
import { FileLabel, LoadingFile, Screen } from "@/components/layout/screen";
import { requireViewer } from "@/server/auth/viewer";
import { CodenameForm } from "./codename-form";

export const metadata: Metadata = { title: "Perfil" };

export default function PerfilPage() {
  return (
    <Screen className="justify-center gap-10 py-12">
      <header className="flex flex-col gap-3">
        <FileLabel>Ficha do investigador</FileLabel>
        <h1 className="text-3xl font-medium text-paper-50">Como você quer ser identificado?</h1>
        <p className="text-paper-300">Seu codinome aparece para o seu parceiro durante as investigações.</p>
      </header>
      <Suspense fallback={<LoadingFile />}>
        <ProfileSection />
      </Suspense>
    </Screen>
  );
}

async function ProfileSection() {
  const viewer = await requireViewer("profile");
  return <CodenameForm initial={viewer.profile.codename ?? ""} />;
}
