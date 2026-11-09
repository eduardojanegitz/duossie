import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Contêiner de tela mobile-first que respeita safe areas. */
export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main className={cn("safe-px safe-pt safe-pb mx-auto flex w-full max-w-xl flex-1 flex-col", className)}>
      {children}
    </main>
  );
}

/** Rótulo de seção no estilo de ficha de arquivo. */
export function FileLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("font-mono text-xs uppercase tracking-[0.3em] text-paper-500", className)}>{children}</p>
  );
}

/** Estado de carregamento padrão: uma linha de leitura de arquivo. */
export function LoadingFile({ label = "Acessando arquivo" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <div className="h-px w-40 overflow-hidden bg-ink-700">
        <div className="h-full w-1/3 animate-[scan_1.2s_ease-in-out_infinite] bg-amber-500" />
      </div>
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-paper-500">{label}…</p>
    </div>
  );
}
