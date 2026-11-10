"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const STORAGE_KEY = "duossie:opening-seen";
const DURATION_MS = 2600;

function alreadySeen() {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true; // Sem storage (modo privado restrito): não insiste na abertura.
  }
}

function markSeen() {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignora */
  }
}

/**
 * Abertura curta: aparece uma vez por sessão do navegador, pode ser pulada com
 * toque/tecla e é omitida com `prefers-reduced-motion`.
 */
export function OpeningSequence() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Lido aqui (e não via hook) para decidir uma única vez, na montagem.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || alreadySeen()) return;
    // Exibe no próximo frame (após a hidratação) e só então marca como vista:
    // se o efeito for desmontado antes (Strict Mode, navegação), nada é perdido.
    const frame = window.requestAnimationFrame(() => {
      markSeen();
      setVisible(true);
    });
    const timer = window.setTimeout(() => setVisible(false), DURATION_MS);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onKey = () => setVisible(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="opening"
          role="presentation"
          onClick={() => setVisible(false)}
          className="fixed inset-0 z-50 grid cursor-pointer place-items-center bg-ink-950"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5 } }}
        >
          <div className="flex flex-col items-center gap-6">
            <svg viewBox="0 0 80 40" className="w-28" aria-hidden>
              <motion.circle
                cx="28"
                cy="20"
                r="15"
                fill="none"
                stroke="var(--paper-100)"
                strokeWidth="1.5"
                initial={{ x: -14, pathLength: 0 }}
                animate={{ x: 0, pathLength: 1 }}
                transition={{ duration: 1.1, ease: "easeInOut" }}
              />
              <motion.circle
                cx="52"
                cy="20"
                r="15"
                fill="none"
                stroke="var(--amber-500)"
                strokeWidth="1.5"
                initial={{ x: 14, pathLength: 0 }}
                animate={{ x: 0, pathLength: 1 }}
                transition={{ duration: 1.1, ease: "easeInOut" }}
              />
            </svg>
            <motion.p
              className="font-mono text-xl uppercase tracking-[0.5em] text-paper-50"
              initial={{ opacity: 0, letterSpacing: "0.9em" }}
              animate={{ opacity: 1, letterSpacing: "0.5em" }}
              transition={{ delay: 0.7, duration: 0.9 }}
            >
              Duossie
            </motion.p>
            <motion.p
              className="text-sm text-paper-500"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.3, duration: 0.6 }}
            >
              Duas perspectivas. Uma única verdade.
            </motion.p>
          </div>
          <span className="absolute bottom-[max(1.5rem,var(--safe-bottom))] font-mono text-[10px] uppercase tracking-[0.3em] text-ink-500">
            Toque para pular
          </span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
