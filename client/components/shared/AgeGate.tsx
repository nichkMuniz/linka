import * as React from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

const AGE_GATE_KEY = "linka_age_verified";

interface AgeGateProps {
  children: React.ReactNode;
}

export function AgeGate({ children }: AgeGateProps) {
  const { resolvedTheme } = useTheme();
  const [verified, setVerified] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem(AGE_GATE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const logoSrc = resolvedTheme === "dark" ? "/logo-branco.png" : "/logo.png";

  function handleConfirm() {
    try {
      localStorage.setItem(AGE_GATE_KEY, "true");
    } catch {
      // silently ignore (private mode)
    }
    setVerified(true);
  }

  function handleDeny() {
    // Informa o usuário que não pode usar o app e não avança
    alert(
      "Você precisa ter 13 anos ou mais para usar o LinKa."
    );
  }

  if (verified) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center space-y-6">
        {/* Logo */}
        <img src={logoSrc} alt="LinKa" className="h-10 mx-auto" />

        {/* Ícone e título */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">
            Verificação de Idade
          </h1>
        </div>

        {/* Texto */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            O LinKa é destinado a pessoas com <strong>13 anos ou mais</strong>.
            Para continuar, confirme sua idade.
          </p>
          <p className="text-xs text-muted-foreground">
            Ao confirmar, você declara que possui 13 anos ou mais e concorda
            com nossos Termos de Uso e Política de Privacidade.
          </p>
        </div>

        {/* Botões */}
        <div className="flex flex-col gap-3">
          <Button
            className="w-full"
            size="lg"
            onClick={handleConfirm}
          >
            Tenho 13 anos ou mais
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="w-full text-muted-foreground"
            onClick={handleDeny}
          >
            Tenho menos de 13 anos
          </Button>
        </div>
      </div>
    </div>
  );
}
