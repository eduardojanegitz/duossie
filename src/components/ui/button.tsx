import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-sm px-5 font-mono text-sm uppercase tracking-[0.18em] transition-colors disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-amber-500 text-ink-950 hover:bg-amber-400 active:bg-amber-400",
        ghost: "border border-ink-600 text-paper-100 hover:border-paper-500 hover:bg-ink-800",
        quiet: "text-paper-500 hover:text-paper-100 px-2",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary" },
  },
);

export type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, block, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, block }), className)} {...props} />;
}
