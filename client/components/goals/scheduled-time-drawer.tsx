import * as React from "react";
import { Bell, BellOff, Clock } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

interface ScheduledTimeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSaving: boolean;
  routineName: string;
  currentTime: string | null;
  onConfirm: (scheduledTime: string | null) => void;
}

export function ScheduledTimeDrawer({
  open,
  onOpenChange,
  isSaving,
  routineName,
  currentTime,
  onConfirm,
}: ScheduledTimeDrawerProps) {
  const [time, setTime] = React.useState(currentTime ?? "");

  React.useEffect(() => {
    if (open) setTime(currentTime ?? "");
  }, [open, currentTime]);

  const handleSave = () => {
    onConfirm(time || null);
    onOpenChange(false);
  };

  const handleRemove = () => {
    onConfirm(null);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={(v) => { if (!v) onOpenChange(false); }}>
      <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DrawerHeader className="shrink-0">
          <DrawerTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-brand" />
            Lembrete diário
          </DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-col gap-5 px-4 pb-6 flex-1 overflow-y-auto">
          <p className="text-sm text-muted-foreground">
            Defina um horário para receber uma notificação diária lembrando de realizar{" "}
            <span className="font-medium text-foreground">{routineName}</span>.
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              Horário do lembrete
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-3 rounded-xl border border-border/60 bg-background text-foreground text-base focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
            {time && (
              <p className="text-xs text-muted-foreground">
                Você receberá uma notificação todos os dias às{" "}
                <span className="font-medium text-brand">
                  {time}
                </span>
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 mt-auto pt-2">
            <Button
              className="w-full rounded-full"
              onClick={handleSave}
              disabled={isSaving || !time}
            >
              {isSaving ? "Salvando..." : "Salvar lembrete"}
            </Button>
            {currentTime && (
              <Button
                variant="outline"
                className="w-full rounded-full text-destructive border-destructive/40 hover:bg-destructive/10"
                onClick={handleRemove}
                disabled={isSaving}
              >
                <BellOff className="h-4 w-4 mr-1.5" />
                Remover lembrete
              </Button>
            )}
            <Button
              variant="ghost"
              className="w-full rounded-full text-muted-foreground"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
