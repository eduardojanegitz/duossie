import type { PlayerView } from "@/engine";
import { FileLabel } from "@/components/layout/screen";
import { formatTime } from "@/lib/format";

/** Diário: contexto do caso, briefing do papel, capítulos e linha do tempo da dupla. */
export function JournalPanel({ view }: { view: PlayerView }) {
  const feed = [...view.feed].reverse();
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="intro-title" className="flex flex-col gap-3">
        <FileLabel>Ocorrência</FileLabel>
        <h2 id="intro-title" className="sr-only">
          Introdução
        </h2>
        <p className="font-typewriter text-lg leading-relaxed text-paper-100">{view.intro}</p>
      </section>

      <section aria-labelledby="role-title" className="flex flex-col gap-2 rounded-sm border border-amber-700/60 bg-ink-900 p-4">
        <FileLabel className="text-amber-400">Seu papel</FileLabel>
        <h2 id="role-title" className="text-xl font-medium text-paper-50">
          {view.roleInfo.name} <span className="text-sm font-normal text-paper-500">— {view.roleInfo.tagline}</span>
        </h2>
        <p className="text-paper-300">{view.roleInfo.briefing}</p>
        <p className="text-sm text-paper-500">
          Seu parceiro é <span className="text-paper-100">{view.partnerRoleName}</span> e vê coisas que você não vê. Conversem.
        </p>
      </section>

      <section aria-labelledby="chapters-title" className="flex flex-col gap-3">
        <h2 id="chapters-title" className="font-mono text-xs uppercase tracking-[0.25em] text-paper-500">
          Capítulos
        </h2>
        <ol className="flex flex-col gap-3">
          {view.chapters.map((c, i) => (
            <li key={c.id} className="border-l border-ink-600 pl-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper-500">Capítulo {i + 1}</p>
              <p className="text-paper-50">{c.title}</p>
              <p className="text-sm text-paper-300">{c.intro}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="feed-title" className="flex flex-col gap-3">
        <h2 id="feed-title" className="font-mono text-xs uppercase tracking-[0.25em] text-paper-500">
          Linha do tempo da investigação
        </h2>
        {feed.length === 0 ? (
          <p className="text-sm text-paper-500">Nada registrado ainda. Abram os arquivos e comecem a conversar.</p>
        ) : (
          <ol className="flex flex-col gap-2" data-testid="feed">
            {feed.map((f) => (
              <li key={f.seq} className="flex gap-3 text-sm">
                <time dateTime={f.at} className="shrink-0 font-mono text-xs text-paper-500">
                  {formatTime(f.at)}
                </time>
                <span className={f.kind === "solved" || f.kind === "chapter" ? "text-amber-400" : "text-paper-100"}>{f.label}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
