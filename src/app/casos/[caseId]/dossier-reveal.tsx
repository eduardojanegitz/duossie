"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

/** Entrada discreta do dossiê: desliza levemente "para fora da pasta". */
export function DossierReveal({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, rotate: -0.6 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
