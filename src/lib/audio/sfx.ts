"use client";

import { useSyncExternalStore } from "react";

/**
 * Efeitos sonoros procedurais (Web Audio, sem arquivos). Opcionais e DESLIGADOS por padrão.
 * O AudioContext só é criado depois de um gesto do usuário (restrição dos navegadores móveis).
 * Todo som acompanha um aviso visual — nada depende só do áudio.
 */
export type Sfx = "open" | "discover" | "solve" | "error" | "chapter" | "message";

const KEY = "duossie:sound";
let enabled = false;
let ctx: AudioContext | null = null;
const listeners = new Set<() => void>();

function readPreference() {
  try {
    return window.localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

if (typeof window !== "undefined") enabled = readPreference();

function emit() {
  for (const l of listeners) l();
}

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Liga/desliga. Deve ser chamado num gesto do usuário (clique/toque). */
export function setSoundEnabled(on: boolean) {
  enabled = on;
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* sem storage: vale só nesta página */
  }
  if (on) {
    context();
    play("discover");
  }
  emit();
}

export function useSoundEnabled() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => enabled,
    () => false,
  );
}

function tone(ac: AudioContext, freq: number, start: number, duration: number, type: OscillatorType, gain: number) {
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

function noise(ac: AudioContext, start: number, duration: number, gain: number, cutoff: number) {
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * duration), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = cutoff;
  const amp = ac.createGain();
  amp.gain.value = gain;
  src.connect(filter).connect(amp).connect(ac.destination);
  src.start(start);
}

export function play(name: Sfx) {
  if (!enabled) return;
  const ac = context();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  switch (name) {
    case "open": // papel sendo puxado da pasta
      noise(ac, t, 0.18, 0.18, 2400);
      break;
    case "discover": // duas notas ascendentes
      tone(ac, 523.25, t, 0.25, "sine", 0.08);
      tone(ac, 783.99, t + 0.09, 0.35, "sine", 0.07);
      break;
    case "solve": // acorde que se abre
      [392, 493.88, 587.33, 783.99].forEach((f, i) => tone(ac, f, t + i * 0.07, 0.6, "triangle", 0.06));
      break;
    case "error": // batida grave e curta
      tone(ac, 110, t, 0.22, "sine", 0.12);
      break;
    case "chapter": // nota longa e baixa
      tone(ac, 98, t, 1.6, "sine", 0.08);
      tone(ac, 146.83, t + 0.2, 1.4, "sine", 0.05);
      break;
    case "message": // bip discreto
      tone(ac, 880, t, 0.12, "sine", 0.05);
      break;
  }
}
