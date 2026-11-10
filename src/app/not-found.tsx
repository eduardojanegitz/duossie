import Link from "next/link";
import { FileLabel, Screen } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Screen className="justify-center gap-8 py-12">
      <div className="flex flex-col gap-3">
        <FileLabel>Registro inexistente</FileLabel>
        <h1 className="text-3xl font-medium text-paper-50">Nenhum arquivo com essa referência.</h1>
        <p className="text-paper-300">O endereço pode estar incorreto ou o arquivo foi removido.</p>
      </div>
      <Button asChild block>
        <Link href="/central">Voltar para a central</Link>
      </Button>
    </Screen>
  );
}
