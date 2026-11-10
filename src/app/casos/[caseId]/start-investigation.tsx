"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { startInvestigation } from "@/server/actions/game";

type RoleInfo = { name: string; tagline: string; briefing: string };

/** Quem abre a investigação escolhe o papel; o parceiro recebe o outro. */
export function StartInvestigation({ caseId, roles, partnerName }: { caseId: string; roles: { A: RoleInfo; B: RoleInfo }; partnerName: string }) {
  const [role, setRole] = useState<"A" | "B" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-paper-100">
          Escolha sua perspectiva. {partnerName} ficará com a outra — e cada um verá coisas que o outro não vê.
        </legend>
        {(["A", "B"] as const).map((r) => (
          <label
            key={r}
            className={cn(
              "flex cursor-pointer flex-col gap-1 rounded-sm border p-4",
              role === r ? "border-amber-500 bg-ink-800" : "border-ink-600 bg-ink-900 hover:border-paper-500",
            )}
          >
            <span className="flex items-center gap-3">
              <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="size-4 accent-[var(--amber-500)]" />
              <span className="text-lg text-paper-50">{roles[r].name}</span>
              <span className="text-sm text-paper-500">{roles[r].tagline}</span>
            </span>
            <span className="pl-7 text-sm text-paper-300">{roles[r].briefing}</span>
          </label>
        ))}
      </fieldset>
      {error ? (
        <p role="alert" className="text-sm text-stamp-500">
          {error}
        </p>
      ) : null}
      <Button
        disabled={!role || pending}
        onClick={() =>
          role &&
          startTransition(async () => {
            setError(null);
            const result = await startInvestigation({ caseId, role });
            if (result && !result.ok) setError(result.error);
          })
        }
      >
        {pending ? "Abrindo o arquivo…" : "Abrir investigação"}
      </Button>
    </div>
  );
}
