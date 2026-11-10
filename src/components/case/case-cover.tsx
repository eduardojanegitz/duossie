import type { ReactNode } from "react";
import type { CoverKey } from "@/content/catalog-schema";
import { cn } from "@/lib/cn";

/**
 * Capas ilustradas em SVG (traço fino + um único ponto de destaque âmbar).
 * Decorativas: o título do caso é sempre apresentado em texto ao lado.
 */
export function CaseCover({ cover, className, dimmed }: { cover: CoverKey; className?: string; dimmed?: boolean }) {
  return (
    <svg
      viewBox="0 0 300 200"
      aria-hidden
      className={cn("block h-full w-full", dimmed && "opacity-40 grayscale", className)}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={`sky-${cover}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d0f12" />
          <stop offset="1" stopColor="#171a1f" />
        </linearGradient>
        <radialGradient id={`glow-${cover}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#e8b04a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#e8b04a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="300" height="200" fill={`url(#sky-${cover})`} />
      {COVERS[cover](cover)}
    </svg>
  );
}

const line = { fill: "none", stroke: "#bdb7aa", strokeWidth: 1.2, strokeLinecap: "round" as const };

const COVERS: Record<CoverKey, (key: string) => ReactNode> = {
  train: (key) => (
    <g>
      {/* Plataforma e trilhos convergindo para o túnel */}
      <path d="M0 200 L130 96 M300 200 L170 96" {...line} strokeOpacity="0.5" />
      <path d="M60 200 L141 96 M240 200 L159 96" {...line} />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const y = 200 - i * i * 2.4 - i * 4;
        const half = 92 - i * 10.5;
        return <path key={i} d={`M${150 - half} ${y} L${150 + half} ${y}`} {...line} strokeOpacity={0.35} />;
      })}
      <path d="M118 96 Q150 52 182 96 Z" fill="#08090b" stroke="#474d57" />
      <circle cx="150" cy="84" r="26" fill={`url(#glow-${key})`} />
      <circle cx="150" cy="84" r="3" fill="#e8b04a" />
      {/* Relógio da estação */}
      <circle cx="48" cy="112" r="16" {...line} />
      <path d="M48 112 L48 100 M48 112 L56 116" {...line} stroke="#e8b04a" strokeWidth="1.6" />
      <text x="48" y="144" textAnchor="middle" fill="#9a9488" fontSize="9" fontFamily="monospace" letterSpacing="2">
        23:47
      </text>
    </g>
  ),
  house: (key) => (
    <g>
      <path d="M0 168 L300 168" {...line} strokeOpacity="0.4" />
      <path d="M90 168 L90 98 L150 56 L210 98 L210 168 Z" {...line} />
      <path d="M128 168 L128 128 L152 128 L152 168" {...line} />
      {[
        [104, 106],
        [168, 106],
        [168, 136],
      ].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="18" height="16" {...line} strokeOpacity="0.6" />
      ))}
      <circle cx="113" cy="144" r="18" fill={`url(#glow-${key})`} />
      <rect x="104" y="136" width="18" height="16" fill="#e8b04a" fillOpacity="0.8" />
      <circle cx="250" cy="40" r="10" {...line} strokeOpacity="0.5" />
    </g>
  ),
  phone: (key) => (
    <g>
      <rect x="95" y="92" width="110" height="70" rx="10" {...line} />
      <path d="M85 92 Q85 64 115 64 L185 64 Q215 64 215 92 L195 92 Q195 80 182 80 L118 80 Q105 80 105 92 Z" {...line} />
      <circle cx="150" cy="127" r="22" {...line} />
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        return <circle key={i} cx={150 + Math.cos(a) * 15} cy={127 + Math.sin(a) * 15} r="2.6" {...line} strokeOpacity="0.7" />;
      })}
      <circle cx="150" cy="127" r="30" fill={`url(#glow-${key})`} />
      <circle cx="150" cy="127" r="3" fill="#e8b04a" />
      <path d="M215 100 Q250 110 240 150 Q232 178 262 188" {...line} strokeOpacity="0.5" />
    </g>
  ),
  folder: (key) => (
    <g>
      <path d="M80 62 L130 62 L140 74 L220 74 L220 160 L80 160 Z" {...line} />
      <path d="M80 86 L220 86" {...line} strokeOpacity="0.5" />
      <rect x="98" y="104" width="64" height="18" fill="none" stroke="#d0614a" strokeWidth="1.4" transform="rotate(-8 130 113)" />
      <text x="130" y="117" textAnchor="middle" fill="#d0614a" fontSize="9" fontFamily="monospace" letterSpacing="2" transform="rotate(-8 130 113)">
        SIGILO
      </text>
      <circle cx="190" cy="130" r="22" fill={`url(#glow-${key})`} />
      <text x="190" y="138" textAnchor="middle" fill="#e8b04a" fontSize="24" fontFamily="monospace">
        0
      </text>
    </g>
  ),
};
