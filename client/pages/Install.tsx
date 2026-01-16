import * as React from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Share2,
  PlusSquare,
  Smartphone,
  Chrome,
} from "lucide-react";

import { usePwaInstall } from "@/hooks/use-pwa-install";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

function Step({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/60 p-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-muted">
        {icon}
      </div>
      <div className="space-y-1">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}

export default function Install() {
  const {
    platform,
    isSafariIOS,
    installed,
    isInstallable,
    promptInstall,
    resetDismissed,
  } = usePwaInstall();

  const header = installed
    ? "RitmoFit já está instalado"
    : "Instalar RitmoFit";

  const subheader = installed
    ? "Abra pelo ícone da sua tela inicial para a experiência completa."
    : "Deixe o RitmoFit como um app no seu celular — sem App Store.";

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" className="rounded-full">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>

        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          onClick={() => {
            resetDismissed();
            toast({
              title: "Aviso reativado",
              description: "O banner de instalação pode aparecer novamente.",
            });
          }}
        >
          Mostrar aviso
        </Button>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-brand" />
            {header}
          </CardTitle>
          <CardDescription>{subheader}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!installed ? (
            <div
              className={cn(
                "flex flex-col gap-2 sm:flex-row sm:items-center",
                isInstallable ? "sm:justify-between" : "sm:justify-start",
              )}
            >
              {isInstallable ? (
                <Button
                  type="button"
                  className="rounded-full"
                  onClick={async () => {
                    const result = await promptInstall();
                    if (!result) {
                      toast({
                        title: "Instalação indisponível",
                        description:
                          "Abra o menu do navegador e procure por ‘Instalar app’.",
                      });
                      return;
                    }

                    toast({
                      title:
                        result.outcome === "accepted"
                          ? "Instalando…"
                          : "Tudo bem",
                      description:
                        result.outcome === "accepted"
                          ? "Se o sistema pedir, confirme a instalação."
                          : "Você pode instalar depois quando quiser.",
                    });
                  }}
                >
                  <Download className="h-4 w-4" />
                  Instalar agora
                </Button>
              ) : null}

              {platform === "ios" ? (
                <div className="text-sm text-muted-foreground">
                  {isSafariIOS
                    ? "No iPhone/iPad, a instalação é feita pelo botão de compartilhar."
                    : "No iPhone/iPad, abra este site no Safari para ver ‘Adicionar à Tela de Início’."}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Se não aparecer o botão acima, use o menu do navegador.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
              Dica: para ficar 100% “modo app”, abra o RitmoFit pelo ícone da tela inicial.
            </div>
          )}

          {platform === "ios" ? (
            <div className="grid gap-3">
              <Step
                icon={<Share2 className="h-5 w-5" />}
                title="1) Toque em Compartilhar"
                description="No Safari, use o ícone de compartilhar (quadrado com seta para cima)."
              />
              <Step
                icon={<PlusSquare className="h-5 w-5" />}
                title="2) Adicionar à Tela de Início"
                description="Role o menu e selecione ‘Adicionar à Tela de Início’."
              />
              <Step
                icon={<Smartphone className="h-5 w-5" />}
                title="3) Abrir como app"
                description="Pronto! Agora use o ícone na tela inicial para abrir o RitmoFit."
              />
            </div>
          ) : (
            <div className="grid gap-3">
              <Step
                icon={<Chrome className="h-5 w-5" />}
                title="1) Abra o menu do navegador"
                description="No Chrome/Edge, toque nos 3 pontinhos (⋮) no topo." 
              />
              <Step
                icon={<Download className="h-5 w-5" />}
                title="2) Toque em “Instalar app”"
                description="Procure por ‘Instalar app’ ou ‘Adicionar à tela inicial’."
              />
              <Step
                icon={<Smartphone className="h-5 w-5" />}
                title="3) Confirme"
                description="Confirme e o RitmoFit vai aparecer como um app no seu celular."
              />
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="secondary" className="rounded-full">
              <Link to="/">Voltar para Home</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/perfil">Ir para Perfil</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
