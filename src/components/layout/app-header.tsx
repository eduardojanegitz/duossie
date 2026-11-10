import Link from "next/link";
import { UserRound } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";

/** Cabeçalho das telas autenticadas. */
export function AppHeader({ back }: { back?: { href: string; label: string } }) {
  return (
    <header className="flex min-h-12 items-center justify-between gap-4">
      {back ? (
        <Link
          href={back.href}
          className="-ml-2 inline-flex min-h-12 items-center px-2 font-mono text-xs uppercase tracking-[0.2em] text-paper-500 hover:text-paper-100"
        >
          ← {back.label}
        </Link>
      ) : (
        <Link href="/central" aria-label="Duossie — central" className="inline-flex min-h-12 items-center">
          <Wordmark size="sm" className="text-paper-100" />
        </Link>
      )}
      <Link
        href="/perfil"
        aria-label="Perfil do investigador"
        className="-mr-2 grid size-12 place-items-center text-paper-500 hover:text-paper-100"
      >
        <UserRound aria-hidden className="size-5" />
      </Link>
    </header>
  );
}
