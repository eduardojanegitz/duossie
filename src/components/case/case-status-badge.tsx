import { cn } from "@/lib/cn";
import { CASE_STATUS_LABEL, type CaseStatus } from "@/lib/case-status";

const STYLE: Record<CaseStatus, string> = {
  locked: "border-ink-500 text-paper-500",
  in_preparation: "border-ink-500 text-paper-500",
  available: "border-amber-500 text-amber-400",
  in_progress: "border-signal-500 text-signal-400",
  completed: "border-paper-300 text-paper-100",
};

/** Carimbo de situação. O texto sempre acompanha a cor (não depende só de cor). */
export function CaseStatusBadge({ status, className }: { status: CaseStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border bg-ink-950/80 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] backdrop-blur-sm",
        STYLE[status],
        className,
      )}
    >
      {CASE_STATUS_LABEL[status]}
    </span>
  );
}
