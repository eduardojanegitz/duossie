"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { formatDateTime } from "@/lib/format";
import { createDuo, createInvite, joinDuo } from "@/server/actions/duo";

export function CreateDuoForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await createDuo({ name: String(formData.get("name") ?? "") });
          if (!result.ok) return setError(result.error);
          router.refresh();
        });
      }}
    >
      <Field label="Nome da dupla" name="name" maxLength={40} required error={error} placeholder="Ex.: Unidade Noturna" />
      <Button type="submit" block disabled={pending}>
        {pending ? "Criando…" : "Criar dupla"}
      </Button>
    </form>
  );
}

export function JoinDuoForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await joinDuo({ code: String(formData.get("code") ?? "") });
          if (!result.ok) return setError(result.error);
          router.refresh();
        });
      }}
    >
      <Field
        label="Código de convite"
        name="code"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        maxLength={9}
        required
        error={error}
        placeholder="XXXX-XXXX"
        className="font-mono uppercase tracking-[0.3em]"
      />
      <Button type="submit" variant="outline" block disabled={pending}>
        {pending ? "Verificando…" : "Entrar na dupla"}
      </Button>
    </form>
  );
}

export function InvitePanel() {
  const [invite, setInvite] = useState<{ code: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function generate() {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const result = await createInvite();
      if (!result.ok) return setError(result.error);
      setInvite(result.data);
    });
  }

  async function copy() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section aria-labelledby="invite-title" className="flex flex-col gap-4 border-t border-ink-700 pt-6">
      <h2 id="invite-title" className="font-mono text-sm uppercase tracking-[0.2em] text-paper-300">
        Convidar parceiro
      </h2>
      {invite ? (
        <div className="flex flex-col gap-3 rounded-sm border border-amber-700 bg-ink-900 p-5">
          <p className="font-mono text-3xl tracking-[0.3em] text-amber-500" aria-label={`Código ${invite.code}`}>
            {invite.code}
          </p>
          <p className="text-sm text-paper-500">
            Válido até {formatDateTime(invite.expiresAt)}. Uso único.
          </p>
          <Button variant="outline" onClick={copy}>
            {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
            {copied ? "Copiado" : "Copiar código"}
          </Button>
        </div>
      ) : (
        <p className="text-paper-300">Gere um código e envie ao seu parceiro. Gerar um novo invalida o anterior.</p>
      )}
      {error ? (
        <p role="alert" className="text-sm text-stamp-500">
          {error}
        </p>
      ) : null}
      <Button variant={invite ? "quiet" : "default"} block onClick={generate} disabled={pending}>
        {pending ? "Gerando…" : invite ? "Gerar novo código" : "Gerar código de convite"}
      </Button>
    </section>
  );
}

/** Enquanto o parceiro não entra, atualiza a tela periodicamente e ao voltar o foco. */
export function WaitForPartner() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(refresh, 5000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);

  return (
    <p role="status" className="font-mono text-xs uppercase tracking-[0.25em] text-paper-500">
      Aguardando o parceiro entrar na dupla…
    </p>
  );
}
