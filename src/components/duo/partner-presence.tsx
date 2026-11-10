"use client";

import { cn } from "@/lib/cn";
import { useDuoPresence, type Activity, type PartnerStatus } from "@/lib/realtime/use-duo-presence";

const LABEL: Record<PartnerStatus, string> = {
  connecting: "Conectando…",
  offline: "Offline",
  online: "Na central",
  away: "Ausente",
  investigating: "Investigando",
};

const DOT: Record<PartnerStatus, string> = {
  connecting: "bg-ink-500",
  offline: "bg-ink-500",
  online: "bg-signal-400",
  away: "bg-amber-700",
  investigating: "bg-amber-500 animate-pulse",
};

export function PartnerPresence(props: {
  duoId: string;
  userId: string;
  partnerId: string | null;
  partnerName: string;
  activity: Activity;
}) {
  const partner = useDuoPresence(props);

  return (
    <p className="flex items-center gap-2 text-sm" data-testid="partner-presence" data-status={partner.status}>
      <span aria-hidden className={cn("inline-block size-2 rounded-full", DOT[partner.status])} />
      <span className="text-paper-100">{props.partnerName}</span>
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-paper-500" aria-live="polite">
        {LABEL[partner.status]}
      </span>
    </p>
  );
}
