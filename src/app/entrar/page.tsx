import type { Metadata } from "next";
import { Wordmark } from "@/components/brand/wordmark";
import { Screen } from "@/components/layout/screen";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function EntrarPage() {
  return (
    <Screen className="justify-center gap-12 py-12">
      <header className="flex flex-col gap-6">
        <Wordmark size="lg" className="text-paper-50" />
        <p className="max-w-sm text-lg leading-relaxed text-paper-300">
          Duas perspectivas. <span className="text-paper-50">Uma única verdade.</span>
        </p>
      </header>
      <LoginForm />
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-ink-500">Acesso restrito · investigadores autorizados</p>
    </Screen>
  );
}
