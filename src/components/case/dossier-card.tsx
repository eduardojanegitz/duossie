import Link from "next/link";
import { Lock } from "lucide-react";
import { CaseCover } from "@/components/case/case-cover";
import { CaseStatusBadge } from "@/components/case/case-status-badge";
import { cn } from "@/lib/cn";
import { DIFFICULTY_LABEL, formatDuration } from "@/lib/case-status";
import type { CaseSummary } from "@/server/catalog";

/** Cartão de caso no formato de dossiê: aba com código, capa, metadados e situação. */
export function DossierCard({ caseSummary: c }: { caseSummary: CaseSummary }) {
  const muted = c.status === "locked" || c.status === "in_preparation";
  const duration = formatDuration(c.durationMin, c.durationMax);

  return (
    <Link
      href={`/casos/${c.id}`}
      className="group relative block pt-4 focus-visible:outline-none"
      aria-label={`Caso ${c.code}: ${c.title}. ${c.status === "locked" ? "Bloqueado." : ""}`}
    >
      {/* Aba da pasta */}
      <span
        aria-hidden
        className="absolute left-0 top-0 rounded-t-sm border border-b-0 border-ink-600 bg-ink-850 px-3 py-1 font-mono text-[11px] tracking-[0.25em] text-paper-500"
      >
        CASO {c.code}
      </span>
      <article
        className={cn(
          "paper-texture overflow-hidden rounded-sm rounded-tl-none border border-ink-600 bg-ink-850 transition-colors",
          "group-hover:border-paper-500 group-focus-visible:border-amber-500",
        )}
      >
        <div className="relative aspect-[3/2] border-b border-ink-700">
          <CaseCover cover={c.cover} dimmed={muted} />
          {c.status === "locked" ? (
            <span className="absolute inset-0 grid place-items-center">
              <Lock aria-hidden className="size-6 text-paper-500" />
            </span>
          ) : null}
          <CaseStatusBadge status={c.status} className="absolute right-3 top-3" />
        </div>
        <div className="flex flex-col gap-3 p-4">
          <h3 className="text-lg font-medium leading-snug text-paper-50">{c.title}</h3>
          {c.status === "locked" ? (
            <p className="text-sm text-paper-500">
              Requer: {c.unlockRequires.map((r) => `Caso ${r.code}`).join(", ")}
            </p>
          ) : (
            <p className="line-clamp-3 text-sm leading-relaxed text-paper-300">{c.synopsis}</p>
          )}
          <dl className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.15em] text-paper-500">
            <div className="flex gap-1">
              <dt className="sr-only">Categoria</dt>
              <dd>{c.category}</dd>
            </div>
            <div className="flex gap-1">
              <dt>Dific.</dt>
              <dd>{DIFFICULTY_LABEL[c.difficulty]}</dd>
            </div>
            {duration ? (
              <div className="flex gap-1">
                <dt className="sr-only">Duração estimada</dt>
                <dd>{duration}</dd>
              </div>
            ) : null}
            {c.puzzleCount !== null ? (
              <div className="flex gap-1">
                <dt className="sr-only">Enigmas</dt>
                <dd>{c.puzzleCount} enigmas</dd>
              </div>
            ) : null}
          </dl>
          {c.progress !== null ? (
            <div className="h-1 overflow-hidden rounded-full bg-ink-700" role="progressbar" aria-valuenow={c.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da investigação">
              <div className="h-full bg-amber-500" style={{ width: `${c.progress}%` }} />
            </div>
          ) : null}
        </div>
      </article>
    </Link>
  );
}
