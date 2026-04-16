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
import { cn } from "@/lib/utils";

interface ExecuteAtDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSaving: boolean;
  onConfirm: (executeDates: string[]) => void;
}

const WEEK_DAYS = [
  { label: "Dom", value: 0 },
  { label: "Seg", value: 1 },
  { label: "Ter", value: 2 },
  { label: "Qua", value: 3 },
  { label: "Qui", value: 4 },
  { label: "Sex", value: 5 },
  { label: "Sáb", value: 6 },
];

function getNextOccurrence(dayOfWeek: number): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = (dayOfWeek - today.getDay() + 7) % 7;
  const next = new Date(today);
  next.setDate(today.getDate() + (diff === 0 ? 7 : diff));
  return next;
}

export function ExecuteAtDrawer({
  open,
  onOpenChange,
  isSaving,
  onConfirm,
}: ExecuteAtDrawerProps) {
  const [dates, setDates] = React.useState<Date[]>([]);
  const [time, setTime] = React.useState("");
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [selectedWeekDays, setSelectedWeekDays] = React.useState<number[]>([]);

  React.useEffect(() => {
    if (!open) {
      setDates([]);
      setTime("");
      setCalendarOpen(false);
      setSelectedWeekDays([]);
    }
  }, [open]);

  const toggleWeekDay = (day: number) => {
    setSelectedWeekDays((prev) => {
      const next = prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day];
      // Sync calendar dates with week day selection
      const weekDayDates = next.map(getNextOccurrence);
      // Keep manually picked dates that aren't from week day shortcuts
      const manualDates = dates.filter(
        (d) => !prev.map(getNextOccurrence).some((wd) => wd.toDateString() === d.toDateString())
      );
      setDates([...manualDates, ...weekDayDates].sort((a, b) => a.getTime() - b.getTime()));
      return next;
    });
  };

  const toggleAllWeekDays = () => {
    if (selectedWeekDays.length === 7) {
      setSelectedWeekDays([]);
      setDates([]);
    } else {
      const all = WEEK_DAYS.map((d) => d.value);
      setSelectedWeekDays(all);
      setDates(all.map(getNextOccurrence).sort((a, b) => a.getTime() - b.getTime()));
    }
  };

  const handleCalendarSelect = (selected: Date[] | undefined) => {
    const newDates = selected ?? [];
    setDates(newDates);
    // Clear week day shortcuts if manually deselected
    const weekDayOccurrences = selectedWeekDays.map(getNextOccurrence);
    const stillSelected = selectedWeekDays.filter((day) =>
      weekDayOccurrences
        .find((d) => d.getDay() === day && newDates.some((nd) => nd.toDateString() === d.toDateString()))
    );
    setSelectedWeekDays(stillSelected);
  };

  const buildExecuteDates = (): string[] => {
    return dates.map((d) => {
      const dateStr = d.toISOString().split("T")[0];
      return time ? `${dateStr}T${time}:00` : dateStr;
    });
  };

  const today = React.useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const maxDate = React.useMemo(() => {
    const m = new Date(today);
    m.setFullYear(m.getFullYear() + 1);
    return m;
  }, [today]);

  const formattedDates = dates
    .sort((a, b) => a.getTime() - b.getTime())
    .map((d) =>
      d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })
    );

  return (
    <Drawer open={open} onOpenChange={(v) => { if (!v) onOpenChange(false); }}>
      <DrawerContent className="max-h-[90dvh] flex flex-col modal-enter" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DrawerHeader className="shrink-0">
          <DrawerTitle>Horário para realizar</DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-col gap-4 px-4 pb-6 flex-1 overflow-y-auto">
          <p className="text-sm text-muted-foreground">
            Defina quando você pretende realizar esta rotina. A rotina será criada uma única vez — os dias selecionados serão usados para enviar lembretes de notificação. Esse campo é opcional.
          </p>

          {/* Atalhos de dias da semana */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Dias de lembrete</label>
              <button
                type="button"
                onClick={toggleAllWeekDays}
                className="text-xs text-brand hover:underline"
              >
                {selectedWeekDays.length === 7 ? "Limpar tudo" : "Todos os dias"}
              </button>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {WEEK_DAYS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleWeekDay(day.value)}
                  className={cn(
                    "flex-1 min-w-[36px] h-9 rounded-lg text-xs font-medium border transition-colors",
                    selectedWeekDays.includes(day.value)
                      ? "bg-brand text-white border-brand"
                      : "bg-background text-muted-foreground border-border/60 hover:border-brand/60"
                  )}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Calendário */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Ou escolha datas específicas</label>
            <button
              type="button"
              onClick={() => setCalendarOpen((v) => !v)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 bg-background text-foreground text-sm hover:border-brand/60 transition-colors text-left"
            >
              <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              {dates.length > 0
                ? <span className="truncate">{formattedDates.join(", ")}</span>
                : <span className="text-muted-foreground">Escolher datas...</span>
              }
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground ml-auto shrink-0 transition-transform", calendarOpen && "rotate-180")} />
            </button>

            {calendarOpen && (
              <div className="rounded-lg border border-border/60 bg-background overflow-hidden">
                <Calendar
                  mode="multiple"
                  selected={dates}
                  onSelect={handleCalendarSelect}
                  disabled={(d) => d < today || d > maxDate}
                  className="mx-auto"
                />
              </div>
            )}

            {dates.length > 0 && (
              <button
                type="button"
                onClick={() => { setDates([]); setSelectedWeekDays([]); }}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Remover datas selecionadas ({dates.length})
              </button>
            )}
          </div>

          {/* Horário */}
          {dates.length > 0 && (
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
              onClick={() => { onConfirm([]); onOpenChange(false); }}
              disabled={isSaving}
            >
              Pular
            </Button>
            <Button
              className="flex-1 rounded-full"
              onClick={() => { onConfirm(buildExecuteDates()); onOpenChange(false); }}
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
