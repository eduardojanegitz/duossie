"use client";

import Link from "next/link";
import { useEffect } from "react";
import { FileLabel, Screen } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";

/** Falha inesperada em qualquer rota: mensagem neutra e tentativa de recuperação. */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    // Só o digest/mensagem vai para o console; detalhes ficam no log do servidor.
    console.error("[duossie] erro na interface", error instanceof Error ? error.message : error);
  }, [error]);

  return (
    <Screen className="justify-center gap-8 py-12">
      <div className="flex flex-col gap-3">
        <FileLabel className="text-stamp-500">Falha na leitura do arquivo</FileLabel>
        <h1 className="text-3xl font-medium text-paper-50">A conexão com o arquivo caiu.</h1>
        <p className="text-paper-300">
          Seu progresso fica salvo no servidor. Tente de novo; se continuar, volte para a central.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <Button block onClick={() => retry()}>
          Tentar novamente
        </Button>
        <Button asChild variant="quiet" block>
          <Link href="/central">Voltar para a central</Link>
        </Button>
      </div>
    </Screen>
  );
}
