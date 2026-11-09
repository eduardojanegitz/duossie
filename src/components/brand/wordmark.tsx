import { cn } from "@/lib/cn";

/** Marca Duossie: dois "o" que se sobrepõem — duas perspectivas, uma verdade. */
export function Wordmark({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const text = { sm: "text-base", md: "text-2xl", lg: "text-4xl" }[size];
  return (
    <span className={cn("inline-flex items-center gap-3 font-mono uppercase tracking-[0.35em]", text, className)}>
      <svg aria-hidden viewBox="0 0 40 24" className="h-[1em] w-[1.7em]">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="28" cy="12" r="9" fill="none" stroke="var(--amber-500)" strokeWidth="2" />
      </svg>
      <span>Duossie</span>
    </span>
  );
}
