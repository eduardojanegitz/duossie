"use client";

import type { ReactNode } from "react";
import { MotionConfig, motion } from "motion/react";

/**
 * Entrada discreta do dossiê: desliza levemente "para fora da pasta".
 * A marcação é a mesma no servidor e no cliente; com `prefers-reduced-motion`,
 * o Motion elimina o deslocamento e mantém só o fade.
 */
export function DossierReveal({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={{ opacity: 0, y: 24, rotate: -0.6 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}
