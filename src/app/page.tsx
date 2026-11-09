import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoadingFile } from "@/components/layout/screen";
import { getViewer, onboardingStage, pathForStage } from "@/server/auth/viewer";

export default function Home() {
  return (
    <Suspense fallback={<LoadingFile label="Verificando credenciais" />}>
      <RouteByStage />
    </Suspense>
  );
}

async function RouteByStage(): Promise<null> {
  const viewer = await getViewer();
  redirect(pathForStage(onboardingStage(viewer)));
}
