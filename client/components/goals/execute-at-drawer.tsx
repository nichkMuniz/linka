import * as React from "react";
import { CalendarIcon, ChevronDown } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

interface ExecuteAtDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSaving: boolean;
  onConfirm: (executeAt: string | null) => void;
}

export function ExecuteAtDrawer({
  open,
  onOpenChange,
  isSaving,
  onConfirm,
}: ExecuteAtDrawerProps) {
  const [date, setDate] = React.useState<Date | undefined>(undefined);
  const [time, setTime] = React.useState("");
  const [calendarOpen, setCalendarOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setDate(undefined);
      setTime("");
      setCalendarOpen(false);
    }
  }, [open]);

  const buildExecuteAt = (): string | null => {
    if (!date) return null;
    const dateStr = date.toISOString().split("T")[0];
    return time ? `${dateStr}T${time}:00` : dateStr;
  };

  return (
    <Drawer open={open} onOpenChange={(v) => { if (!v) onOpenChange(false); }}>
      <DrawerContent className="max-h-[90dvh] flex flex-col modal-enter">
        <DrawerHeader className="shrink-0">
          <DrawerTitle>Horário para realizar</DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-col gap-4 px-4 pb-6 flex-1 overflow-y-auto">
          <p className="text-sm text-muted-foreground">
            Defina quando você pretende realizar esta rotina. Esse campo é opcional — você pode pular se preferir.
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium">Data (opcional)</label>
            <button
              type="button"
              onClick={() => setCalendarOpen((v) => !v)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 bg-background text-foreground text-sm hover:border-brand/60 transition-colors text-left"
            >
              <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              {date
                ? date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "long", year: "numeric" })
                : <span className="text-muted-foreground">Escolher data...</span>
              }
              <ChevronDown className={`h-4 w-4 text-muted-foreground ml-auto transition-transform ${calendarOpen ? "rotate-180" : ""}`} />
            </button>

            {calendarOpen && (
              <div className="rounded-lg border border-border/60 bg-background overflow-hidden">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => { setDate(d); setCalendarOpen(false); }}
                  disabled={(d) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const maxDate = new Date(today);
                    maxDate.setFullYear(maxDate.getFullYear() + 1);
                    return d < today || d > maxDate;
                  }}
                  className="mx-auto"
                />
              </div>
            )}

            {date && (
              <button
                type="button"
                onClick={() => { setDate(undefined); setTime(""); }}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Remover data
              </button>
            )}
          </div>

          {date && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Horário (opcional)</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
            </div>
          )}

          <div className="flex gap-3 mt-auto pt-2">
            <Button
              variant="outline"
              className="flex-1 rounded-full"
              onClick={() => { onConfirm(null); onOpenChange(false); }}
              disabled={isSaving}
            >
              Pular
            </Button>
            <Button
              className="flex-1 rounded-full"
              onClick={() => { onConfirm(buildExecuteAt()); onOpenChange(false); }}
              disabled={isSaving}
            >
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
