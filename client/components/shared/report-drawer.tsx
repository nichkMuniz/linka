import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

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
      <DrawerContent>
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
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Selecione um motivo" />
                </SelectTrigger>
                <SelectContent side="top" align="center">
                  {REPORT_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
