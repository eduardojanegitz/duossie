import type { Metadata } from "next";
import { Suspense } from "react";
import { DossierCard } from "@/components/case/dossier-card";
import { PartnerPresence } from "@/components/duo/partner-presence";
import { AppHeader } from "@/components/layout/app-header";
import { FileLabel, LoadingFile, Screen } from "@/components/layout/screen";
import { requireViewer } from "@/server/auth/viewer";
import { getCatalog } from "@/server/catalog";
import { OpeningSequence } from "./opening-sequence";

export const metadata: Metadata = { title: "Central" };

export default function CentralPage() {
  return (
    <Screen className="max-w-5xl gap-8 py-2">
      <AppHeader />
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
  const catalog = await getCatalog();

  const all = catalog.flatMap((s) => s.cases);
  const ongoing = all.filter((c) => c.status === "in_progress");
  const completed = all.filter((c) => c.status === "completed").length;

  return (
    <>
      <OpeningSequence />
      <section aria-labelledby="duo-title" className="flex flex-col gap-4 border-b border-ink-700 pb-6">
        <FileLabel>Central de investigações</FileLabel>
        <h1 id="duo-title" data-testid="central-ready" className="text-3xl font-medium text-paper-50">
          {duo.name}
        </h1>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-8">
          <p className="flex items-center gap-2 text-sm">
            <span aria-hidden className="inline-block size-2 rounded-full bg-signal-400" />
            <span className="text-paper-100">{me?.codename}</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-paper-500">Você</span>
          </p>
          {partner ? (
            <PartnerPresence
              duoId={duo.id}
              userId={viewer.userId}
              partnerId={partner.id}
              partnerName={partner.codename ?? "Parceiro"}
              activity={{ kind: "central" }}
            />
          ) : null}
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper-500">
          {completed} de {all.length} casos concluídos
        </p>
      </section>

      {ongoing.length > 0 ? (
        <section aria-labelledby="ongoing-title" className="flex flex-col gap-4">
          <h2 id="ongoing-title" className="font-mono text-sm uppercase tracking-[0.25em] text-signal-400">
            Investigação em andamento
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ongoing.map((c) => (
              <DossierCard key={c.id} caseSummary={c} />
            ))}
          </div>
        </section>
      ) : null}

      {catalog.map((season) => (
        <section key={season.id} aria-labelledby={`season-${season.id}`} className="flex flex-col gap-5">
          <header className="flex flex-col gap-1">
            <FileLabel>Temporada {season.number}</FileLabel>
            <h2 id={`season-${season.id}`} className="text-xl font-medium text-paper-50">
              {season.title}
            </h2>
            {season.tagline ? <p className="text-sm text-paper-500">{season.tagline}</p> : null}
          </header>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {season.cases.map((c) => (
              <DossierCard key={c.id} caseSummary={c} />
            ))}
          </div>
        </section>
      ))}

      {catalog.length === 0 ? (
        <p className="rounded-sm border border-ink-700 bg-ink-900 p-5 text-paper-300">
          Nenhum arquivo de caso foi carregado ainda. Rode <code className="font-mono">npm run content:import</code>.
        </p>
      ) : null}
    </>
  );
}
