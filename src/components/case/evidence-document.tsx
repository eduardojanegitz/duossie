import type { Block } from "@/engine/schema";
import { cn } from "@/lib/cn";

/**
 * Renderiza o corpo de uma evidência como documento. Mobile-first: tabelas rolam na
 * horizontal dentro do próprio bloco (sem quebrar a página), texto em tamanho legível.
 */
export function EvidenceDocument({ blocks, className }: { blocks: Block[]; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-5 text-[15px] leading-relaxed text-paper-100", className)}>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "text":
      return <p className="text-paper-300">{block.text}</p>;
    case "heading":
      return <h3 className="font-mono text-xs uppercase tracking-[0.25em] text-paper-500">{block.text}</h3>;
    case "handwriting":
      return (
        <figure className="flex flex-col gap-2">
          <blockquote className="rotate-[-0.4deg] rounded-sm border border-ink-600 bg-paper-100 px-4 py-3 font-typewriter text-lg leading-snug text-ink-900 shadow-[2px_3px_0_rgba(0,0,0,0.35)]">
            {block.text}
          </blockquote>
          {block.note ? <figcaption className="text-xs text-paper-500">{block.note}</figcaption> : null}
        </figure>
      );
    case "quote":
      return (
        <figure className="border-l-2 border-amber-700 pl-4">
          <blockquote className="text-paper-50">“{block.text}”</blockquote>
          {block.speaker ? (
            <figcaption className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-500">— {block.speaker}</figcaption>
          ) : null}
        </figure>
      );
    case "fields":
      return (
        <dl className="grid gap-px overflow-hidden rounded-sm border border-ink-700 bg-ink-700 sm:grid-cols-2">
          {block.items.map((item) => (
            <div key={item.label} className="bg-ink-900 px-3 py-2">
              <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper-500">{item.label}</dt>
              <dd className="text-paper-50">{item.value}</dd>
            </div>
          ))}
        </dl>
      );
    case "table":
      return (
        <figure className="flex flex-col gap-2">
          {block.caption ? (
            <figcaption className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper-500">{block.caption}</figcaption>
          ) : null}
          <div className="-mx-1 overflow-x-auto px-1" tabIndex={0} role="region" aria-label={block.caption ?? "Tabela"}>
            <table className="w-full min-w-max border-collapse text-sm">
              <thead>
                <tr>
                  {block.columns.map((c) => (
                    <th key={c} scope="col" className="border-b border-ink-600 px-3 py-2 text-left font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-paper-500">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={r} className="odd:bg-ink-900/60">
                    {row.map((cell, c) => (
                      <td key={c} className={cn("border-b border-ink-800 px-3 py-2 align-top text-paper-100", c === 0 && "font-mono whitespace-nowrap")}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </figure>
      );
    case "list":
      return (
        <ul className="flex flex-col gap-2">
          {block.items.map((item) => (
            <li key={item} className="flex gap-3 text-paper-100">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case "stamp":
      return (
        <p className="self-center rounded-sm border-2 border-stamp-500/80 px-5 py-3 font-mono text-3xl tracking-[0.4em] text-stamp-500">
          {block.text}
        </p>
      );
  }
}
