"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { saveCodename } from "@/server/actions/profile";

export function CodenameForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveCodename({ codename: String(formData.get("codename") ?? "") });
      if (!result.ok) return setError(result.error);
      router.replace(result.data.next);
      router.refresh();
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-6" noValidate>
      <Field
        label="Codinome"
        name="codename"
        defaultValue={initial}
        autoComplete="nickname"
        maxLength={24}
        required
        error={error}
        hint="Entre 2 e 24 caracteres."
      />
      <Button type="submit" block disabled={pending}>
        {pending ? "Salvando…" : "Confirmar"}
      </Button>
    </form>
  );
}
