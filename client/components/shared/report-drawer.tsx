import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Check } from "lucide-react";

interface ReportTarget {
  id: string;
  userId: string;
  userName: string;
  description?: string | null;
}

interface ReportDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "user" | "post" | null;
  target: ReportTarget | null;
}

const REPORT_REASONS = [
  "Conteúdo inadequado",
  "Spam",
  "Assédio ou bullying",
  "Violação de direitos autorais",
  "Outro",
];

export function ReportDrawer({ open, onOpenChange, type, target }: ReportDrawerProps) {
  const [reason, setReason] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  const handleSubmit = async () => {
    if (!type || !target || !reason.trim()) {
      toast({ title: "Erro", description: "Selecione um motivo para continuar.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      if (type === "user") {
        const { reportUserDb } = await import("@/lib/ritmofit-db");
        await reportUserDb(target.userId, reason);
      } else {
        const { reportPostDb } = await import("@/lib/ritmofit-db");
        await reportPostDb(target.id, reason);
      }
      toast({
        title: "Denúncia enviada",
        description: `Obrigado por denunciar este ${type === "user" ? "usuário" : "post"}. Nós analisaremos em breve.`,
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao enviar denúncia", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
        className="!rounded-t-[32px] !border-0"
        style={{
          background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderTop: "1px solid rgba(255,255,255,.14)",
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DrawerHeader>
          <DrawerTitle style={{ color: "#fff" }}>
            {type === "user" ? "Denunciar usuário" : "Denunciar post"}
          </DrawerTitle>
          {target && (
            <p className="text-sm" style={{ color: "rgba(255,255,255,.5)" }}>
              {type === "user"
                ? `Denunciando: ${target.userName}`
                : `Post de ${target.userName}`}
              {type === "post" && target.description && (
                <span className="block mt-0.5 text-xs line-clamp-1">"{target.description}"</span>
              )}
            </p>
          )}
        </DrawerHeader>

        {target && (
          <div className="px-4 pb-6 space-y-3">
            <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,.5)" }}>Motivo da denúncia</p>

            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className="w-full flex items-center gap-3 rounded-2xl p-4 text-left active:scale-[0.99] transition-all"
                style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}
              >
                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${reason === r ? "bg-primary border-primary" : ""}`} style={reason !== r ? { borderColor: "rgba(255,255,255,.3)" } : undefined}>
                  {reason === r && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <span className="text-sm font-medium flex-1" style={{ color: "#fff" }}>{r}</span>
              </button>
            ))}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 rounded-full"
                style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.12)" }}
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 rounded-full"
                style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
                onClick={handleSubmit}
                disabled={isSubmitting || !reason.trim()}
              >
                {isSubmitting ? "Enviando..." : "Enviar denúncia"}
              </Button>
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
