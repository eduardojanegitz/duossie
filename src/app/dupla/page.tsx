import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FileLabel, LoadingFile, Screen } from "@/components/layout/screen";
import { requireViewer } from "@/server/auth/viewer";
import { CreateDuoForm, InvitePanel, JoinDuoForm, WaitForPartner } from "./duo-forms";

export const metadata: Metadata = { title: "Dupla" };

export default function DuplaPage() {
  return (
    <Screen className="gap-10 py-10">
      <Suspense fallback={<LoadingFile />}>
        <DuoSection />
      </Suspense>
    </Screen>
  );
}

async function DuoSection() {
  const viewer = await requireViewer("duo");
  const duo = viewer.duo;

  if (!duo) {
    return (
      <>
        <header className="flex flex-col gap-3">
          <FileLabel>Formação da dupla</FileLabel>
          <h1 className="text-3xl font-medium text-paper-50">Nenhum caso se resolve sozinho.</h1>
          <p className="text-paper-300">Crie uma dupla e convide seu parceiro, ou entre com o código que você recebeu.</p>
        </header>
        <section aria-labelledby="create-title" className="flex flex-col gap-4 border-t border-ink-700 pt-6">
          <h2 id="create-title" className="font-mono text-sm uppercase tracking-[0.2em] text-paper-300">
            Abrir nova dupla
          </h2>
          <CreateDuoForm />
        </section>
        <section aria-labelledby="join-title" className="flex flex-col gap-4 border-t border-ink-700 pt-6">
          <h2 id="join-title" className="font-mono text-sm uppercase tracking-[0.2em] text-paper-300">
            Tenho um código de convite
          </h2>
          <JoinDuoForm />
        </section>
      </>
    );
  }

  const me = duo.members.find((m) => m.id === viewer.userId);
  const partner = duo.members.find((m) => m.id !== viewer.userId);

  return (
    <>
      <header className="flex flex-col gap-3">
        <FileLabel>Dupla</FileLabel>
        <h1 className="text-3xl font-medium text-paper-50">{duo.name}</h1>
      </header>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-ink-700 bg-ink-700">
        <div className="bg-ink-900 p-4">
          <dt className="font-mono text-xs uppercase tracking-[0.2em] text-paper-500">Você</dt>
          <dd className="mt-1 text-lg text-paper-50">{me?.codename ?? "—"}</dd>
        </div>
        <div className="bg-ink-900 p-4">
          <dt className="font-mono text-xs uppercase tracking-[0.2em] text-paper-500">Parceiro</dt>
          <dd className="mt-1 text-lg text-paper-50">
            {partner ? (partner.codename ?? "Sem codinome") : <span className="text-paper-500">Aguardando…</span>}
          </dd>
        </div>
      </dl>
      {partner ? (
        <Link
          href="/central"
          className="inline-flex min-h-12 items-center justify-center rounded-sm bg-amber-500 px-5 font-mono text-sm uppercase tracking-[0.18em] text-ink-950 hover:bg-amber-400"
        >
          Ir para a central
        </Link>
      ) : (
        <>
          <InvitePanel />
          <WaitForPartner />
        </>
      )}
    </>
  );
}
