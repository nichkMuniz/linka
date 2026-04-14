import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

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
      <DrawerContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <DrawerHeader>
          <DrawerTitle>
            {type === "user" ? "Denunciar usuário" : "Denunciar post"}
          </DrawerTitle>
        </DrawerHeader>
        {target && (
          <div className="space-y-4 px-4 pb-6">
            <div className="p-4 border border-border/60 rounded-lg bg-muted/30">
              <p className="text-sm mb-3">
                {type === "user"
                  ? `Você está denunciando o usuário: ${target.userName}`
                  : `Você está denunciando o post de ${target.userName}`}
              </p>
              {type === "post" && target.description && (
                <p className="text-xs text-muted-foreground">
                  "{target.description.substring(0, 100)}..."
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo da denúncia</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={cn(
                  "flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm",
                  "ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  "appearance-none cursor-pointer",
                  !reason && "text-muted-foreground"
                )}
              >
                <option value="" disabled hidden>
                  Selecione um motivo
                </option>
                {REPORT_REASONS.map((r) => (
                  <option key={r} value={r} className="text-foreground bg-background">
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1 rounded-full"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 rounded-full"
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
