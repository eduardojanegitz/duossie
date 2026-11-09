import type { Metadata } from "next";
import { Suspense } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { FileLabel, LoadingFile, Screen } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { signOut } from "@/server/actions/auth";
import { requireViewer } from "@/server/auth/viewer";

export const metadata: Metadata = { title: "Central" };

export default function CentralPage() {
  return (
    <Screen className="gap-10 py-6">
      <header className="flex items-center justify-between">
        <Wordmark size="sm" className="text-paper-100" />
        <form action={signOut}>
          <Button type="submit" variant="quiet">
            Sair
          </Button>
        </form>
      </header>
      <Suspense fallback={<LoadingFile label="Abrindo a central" />}>
        <CentralContent />
      </Suspense>
    </Screen>
  );
}

async function CentralContent() {
  const viewer = await requireViewer("ready");
  const duo = viewer.duo!;
  const me = duo.members.find((m) => m.id === viewer.userId);
  const partner = duo.members.find((m) => m.id !== viewer.userId);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <FileLabel>Central de investigações</FileLabel>
        <h1 className="text-3xl font-medium text-paper-50">{duo.name}</h1>
        <p className="text-paper-300">
          {me?.codename} <span className="text-ink-500">&amp;</span> {partner?.codename ?? "—"}
        </p>
      </div>
      <p data-testid="central-ready" className="rounded-sm border border-ink-700 bg-ink-900 p-5 text-paper-300">
        Dupla vinculada. Os arquivos de caso serão disponibilizados nesta central.
      </p>
    </section>
  );
}
