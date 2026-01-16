import * as React from "react";
import { Download, X } from "lucide-react";
import { Link } from "react-router-dom";

import { usePwaInstall } from "@/hooks/use-pwa-install";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

export function PwaInstallBanner() {
  const { platform, isSafariIOS, installed, isInstallable, dismissed, dismiss, promptInstall } =
    usePwaInstall();

  const shouldShow =
    !installed &&
    !dismissed &&
    (isInstallable || platform === "ios" || platform === "android");

  if (!shouldShow) return null;

  const title = "Instale o RitmoFit";

  const description =
    platform === "ios"
      ? isSafariIOS
        ? "Adicione à Tela de Início e use como app."
        : "Para instalar no iPhone, abra o RitmoFit no Safari."
      : "Use como app e abra mais rápido direto da sua tela inicial.";

  return (
    <Alert className="mb-4 border-border/60 bg-gradient-to-br from-brand/10 via-background to-brand-2/10">
      <Download className="h-4 w-4" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <AlertTitle className="text-sm">{title}</AlertTitle>
          <AlertDescription className="text-sm text-muted-foreground">
            {description}
          </AlertDescription>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isInstallable ? (
            <Button
              type="button"
              className="rounded-full"
              onClick={async () => {
                const result = await promptInstall();
                if (!result) {
                  toast({
                    title: "Instalação indisponível",
                    description: "Abra o menu do navegador e procure por ‘Instalar app’.",
                  });
                  return;
                }

                if (result.outcome === "accepted") {
                  toast({
                    title: "Boa!",
                    description: "RitmoFit foi adicionado como app.",
                  });
                } else {
                  toast({
                    title: "Tudo certo",
                    description: "Você pode instalar depois quando quiser.",
                  });
                }
              }}
            >
              Instalar
            </Button>
          ) : (
            <Button asChild className="rounded-full">
              <Link to="/instalar">Ver como instalar</Link>
            </Button>
          )}

          <Button asChild variant="ghost" className="rounded-full">
            <Link to="/instalar">Instruções</Link>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full"
            aria-label="Fechar aviso"
            onClick={dismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Alert>
  );
}
