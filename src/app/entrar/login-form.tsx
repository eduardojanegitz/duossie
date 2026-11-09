"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { requestAccessCode, verifyAccessCode } from "@/server/actions/auth";

type Step = { kind: "email" } | { kind: "code"; email: string };

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "email" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submitEmail(formData: FormData) {
    const email = String(formData.get("email") ?? "");
    setError(null);
    startTransition(async () => {
      const result = await requestAccessCode({ email });
      if (!result.ok) return setError(result.error);
      setStep({ kind: "code", email: email.trim().toLowerCase() });
    });
  }

  function submitCode(formData: FormData) {
    if (step.kind !== "code") return;
    const code = String(formData.get("code") ?? "");
    setError(null);
    startTransition(async () => {
      const result = await verifyAccessCode({ email: step.email, code });
      if (!result.ok) return setError(result.error);
      router.replace(result.data.next);
      router.refresh();
    });
  }

  if (step.kind === "email") {
    return (
      <form action={submitEmail} className="flex flex-col gap-6" noValidate>
        <Field
          label="E-mail do investigador"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          error={error}
          placeholder="voce@exemplo.com"
        />
        <Button type="submit" block disabled={pending}>
          {pending ? "Enviando…" : "Receber código"}
        </Button>
      </form>
    );
  }

  return (
    <form action={submitCode} className="flex flex-col gap-6" noValidate>
      <p className="text-paper-300">
        Enviamos um código de 6 dígitos para <span className="text-paper-50">{step.email}</span>.
      </p>
      <Field
        key="code"
        label="Código de acesso"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        required
        autoFocus
        error={error}
        className="font-mono text-2xl tracking-[0.5em]"
      />
      <Button type="submit" block disabled={pending}>
        {pending ? "Verificando…" : "Entrar"}
      </Button>
      <Button
        variant="quiet"
        onClick={() => {
          setError(null);
          setStep({ kind: "email" });
        }}
      >
        Usar outro e-mail
      </Button>
    </form>
  );
}
