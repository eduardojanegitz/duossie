import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CaseCover } from "@/components/case/case-cover";
import { CaseStatusBadge } from "@/components/case/case-status-badge";
import { AppHeader } from "@/components/layout/app-header";
import { FileLabel, LoadingFile, Screen } from "@/components/layout/screen";
import { DIFFICULTY_LABEL, formatDuration } from "@/lib/case-status";
import { requireViewer } from "@/server/auth/viewer";
import { getCaseSummary } from "@/server/catalog";
import { getCaseRoles } from "@/server/game/service";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StartInvestigation } from "./start-investigation";
import { DossierReveal } from "./dossier-reveal";

export const metadata: Metadata = { title: "Arquivo do caso" };

export default function CasePage({ params }: PageProps<"/casos/[caseId]">) {
  return (
    <Screen className="max-w-3xl gap-6 py-2">
      <AppHeader back={{ href: "/central", label: "Central" }} />
      <Suspense fallback={<LoadingFile label="Retirando o dossiê do arquivo" />}>
        <CaseDossier params={params} />
      </Suspense>
    </Screen>
  );
}

async function CaseDossier({ params }: { params: PageProps<"/casos/[caseId]">["params"] }) {
  const viewer = await requireViewer("ready");
  const partner = viewer.duo!.members.find((m) => m.id !== viewer.userId);
  const { caseId } = await params;
  const found = await getCaseSummary(caseId);
  if (!found) notFound();
  const { season, caseSummary: c } = found;
  const duration = formatDuration(c.durationMin, c.durationMax);
  const locked = c.status === "locked";
  const roles = c.status === "available" ? await getCaseRoles(c.id) : null;

  return (
    <DossierReveal>
      <article className="paper-texture overflow-hidden rounded-sm border border-ink-600 bg-ink-850">
        <div className="relative aspect-[3/2] border-b border-ink-700 sm:aspect-[21/9]">
          <CaseCover cover={c.cover} dimmed={locked || c.status === "in_preparation"} />
          <span className="absolute left-4 top-4 rounded-sm border border-stamp-500/70 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.3em] text-stamp-500">
            Confidencial
          </span>
          <CaseStatusBadge status={c.status} className="absolute right-4 top-4" />
        </div>

        <div className="flex flex-col gap-6 p-5 sm:p-8">
          <header className="flex flex-col gap-2">
            <FileLabel>
              Temporada {season.number} · Caso {c.code}
            </FileLabel>
            <h1 className="text-3xl font-medium leading-tight text-paper-50">{c.title}</h1>
          </header>

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-ink-700 bg-ink-700 sm:grid-cols-4">
            {[
              ["Categoria", c.category],
              ["Dificuldade", DIFFICULTY_LABEL[c.difficulty]],
              ["Duração", duration ?? "—"],
              ["Enigmas", c.puzzleCount !== null ? String(c.puzzleCount) : "—"],
            ].map(([label, value]) => (
              <div key={label} className="bg-ink-900 p-3">
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper-500">{label}</dt>
                <dd className="mt-1 text-paper-100">{value}</dd>
              </div>
            ))}
          </dl>

          {locked ? (
            <section aria-labelledby="req-title" className="flex flex-col gap-2">
              <h2 id="req-title" className="font-mono text-xs uppercase tracking-[0.25em] text-paper-500">
                Acesso bloqueado
              </h2>
              <p className="text-paper-300">
                Este arquivo só pode ser aberto depois que a dupla concluir:
              </p>
              <ul className="list-inside list-disc text-paper-100">
                {c.unlockRequires.map((r) => (
                  <li key={r.id}>
                    Caso {r.code} — {r.title}
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <section aria-labelledby="brief-title" className="flex flex-col gap-3">
              <h2 id="brief-title" className="font-mono text-xs uppercase tracking-[0.25em] text-paper-500">
                Resumo do arquivo
              </h2>
              <p className="font-typewriter text-lg leading-relaxed text-paper-100">{c.synopsis}</p>
            </section>
          )}

          <footer className="border-t border-ink-700 pt-5">
            {c.status === "in_preparation" ? (
              <p className="text-sm text-paper-500" data-testid="case-unavailable">
                O arquivo deste caso ainda está em preparação. A investigação poderá ser aberta quando o conteúdo for publicado.
              </p>
            ) : locked ? (
              <p className="text-sm text-paper-500">Conclua os casos exigidos para liberar este arquivo.</p>
            ) : (c.status === "in_progress" || c.status === "completed") && c.sessionId ? (
              <Button asChild block>
                <Link href={`/investigacao/${c.sessionId}`}>
                  {c.status === "completed" ? "Ver a resolução" : `Continuar investigação (${c.progress ?? 0}%)`}
                </Link>
              </Button>
            ) : roles ? (
              <StartInvestigation caseId={c.id} roles={roles} partnerName={partner?.codename ?? "Seu parceiro"} />
            ) : null}
          </footer>
        </div>
      </article>
    </DossierReveal>
  );
}
