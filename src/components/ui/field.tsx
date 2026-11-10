"use client";

import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/cn";

type FieldProps = ComponentProps<"input"> & {
  label: string;
  hint?: ReactNode;
  error?: string | null;
};

/** Campo de texto com rótulo, dica e erro acessíveis. Altura confortável para toque. */
export function Field({ label, hint, error, className, id, ...props }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="font-mono text-xs uppercase tracking-[0.2em] text-paper-500">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined}
        className={cn(
          "min-h-12 rounded-sm border border-ink-600 bg-ink-900 px-4 text-base text-paper-50 placeholder:text-paper-500",
          "focus:border-amber-500 focus:outline-none",
          error && "border-stamp-500",
          className,
        )}
        {...props}
      />
      {hint && !error ? (
        <p id={hintId} className="text-sm text-paper-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-stamp-500">
          {error}
        </p>
      ) : null}
    </div>
  );
}
