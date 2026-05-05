import * as React from "react";
import { CalendarIcon, ChevronDown, Clock, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
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
      const weekDayDates = next.map(getNextOccurrence);
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
    const weekDayOccurrences = selectedWeekDays.map(getNextOccurrence);
    const stillSelected = selectedWeekDays.filter((day) =>
      weekDayOccurrences.find(
        (d) => d.getDay() === day && newDates.some((nd) => nd.toDateString() === d.toDateString())
      )
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
    <DialogPrimitive.Root open={open} onOpenChange={(v) => { if (!v) onOpenChange(false); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[200] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none"
          style={{
            paddingTop: "max(1rem, env(safe-area-inset-top))",
            paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
            paddingLeft: "max(1rem, env(safe-area-inset-left))",
            paddingRight: "max(1rem, env(safe-area-inset-right))",
          }}
        >
          <DialogPrimitive.Content
            onOpenAutoFocus={(e) => e.preventDefault()}
            className="pointer-events-auto w-[calc(100vw-2rem)] max-w-sm rounded-2xl max-h-[85dvh] flex flex-col overflow-hidden bg-background border border-border shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-3 shrink-0 flex items-center justify-between">
              <h2 className="text-base font-semibold">Horário para realizar</h2>
              <DialogPrimitive.Close className="rounded-sm opacity-70 hover:opacity-100 transition-opacity">
                <X className="h-4 w-4" />
                <span className="sr-only">Fechar</span>
              </DialogPrimitive.Close>
            </div>

            {/* Body */}
            <div className="flex flex-col gap-4 px-5 pb-5 flex-1 overflow-y-auto">
              <p className="text-sm text-muted-foreground">
                Defina quando você pretende realizar esta rotina. Os dias selecionados serão usados para enviar lembretes. Opcional.
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
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Horário (opcional)
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-1">
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
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
