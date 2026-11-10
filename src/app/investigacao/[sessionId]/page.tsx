import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadingFile } from "@/components/layout/screen";
import { requireViewer } from "@/server/auth/viewer";
import { GameError, getPlayerView } from "@/server/game/service";
import { InvestigationClient } from "./investigation-client";

export const metadata: Metadata = { title: "Investigação" };

export default function InvestigationPage({ params }: PageProps<"/investigacao/[sessionId]">) {
  return (
    <Suspense fallback={<LoadingFile label="Abrindo a investigação" />}>
      <Investigation params={params} />
    </Suspense>
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Investigation({ params }: { params: PageProps<"/investigacao/[sessionId]">["params"] }) {
  const viewer = await requireViewer("ready");
  const { sessionId } = await params;
  if (!UUID.test(sessionId)) notFound();

  let view;
  try {
    view = await getPlayerView(viewer, sessionId);
  } catch (error) {
    if (error instanceof GameError && (error.code === "not_found" || error.code === "forbidden")) notFound();
    throw error;
  }

  const duo = viewer.duo!;
  const me = duo.members.find((m) => m.id === viewer.userId)!;
  const partner = duo.members.find((m) => m.id !== viewer.userId)!;

  return (
    <InvestigationClient
      view={view}
      duoId={duo.id}
      me={{ id: me.id, name: me.codename ?? "Você" }}
      partner={{ id: partner.id, name: partner.codename ?? "Parceiro" }}
    />
  );
}
