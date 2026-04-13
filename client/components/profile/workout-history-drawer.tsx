import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { Workout } from "@/lib/ritmofit-db";

interface WorkoutHistoryRecord {
  id?: string;
  kilos?: number | null;
  volume?: string | null;
  createdAt: string;
}

interface WorkoutHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workout: Workout | null;
  history: WorkoutHistoryRecord[];
  isLoading: boolean;
}

export function WorkoutHistoryDrawer({
  open,
  onOpenChange,
  workout,
  history,
  isLoading,
}: WorkoutHistoryDrawerProps) {
  const groupedByDay = React.useMemo(() => {
    const map: Record<string, WorkoutHistoryRecord[]> = {};
    history.forEach((record) => {
      const dateKey = new Date(record.createdAt).toLocaleDateString("pt-BR");
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(record);
    });
    return map;
  }, [history]);

  const sortedDates = React.useMemo(
    () =>
      Object.keys(groupedByDay).sort((a, b) => {
        const dateA = new Date(a.split("/").reverse().join("-"));
        const dateB = new Date(b.split("/").reverse().join("-"));
        return dateB.getTime() - dateA.getTime();
      }),
    [groupedByDay],
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DrawerHeader className="shrink-0">
          <DrawerTitle>Histórico de {workout?.name || "Exercício"}</DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {isLoading ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Carregando histórico...
            </div>
          ) : history.length > 0 ? (
            sortedDates.map((dateKey) => {
              const dayRecords = groupedByDay[dateKey];
              const totalKilos = dayRecords.reduce((sum, r) => sum + (r.kilos || 0), 0);
              const totalReps = dayRecords.length;

              return (
                <div key={dateKey} className="mb-6">
                  <div className="sticky top-0 bg-background/95 py-2 mb-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">{dateKey}</p>
                    <div className="flex gap-4 mt-1">
                      <p className="text-xs text-muted-foreground">{totalReps} série(s)</p>
                      {totalKilos > 0 && (
                        <p className="text-xs text-muted-foreground">{totalKilos} kg total</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    {dayRecords.map((record) => {
                      const time = new Date(record.createdAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      return (
                        <div
                          key={record.id || `${record.createdAt}-${record.kilos}`}
                          className="flex items-center justify-between p-2 rounded hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground w-10">{time}</p>
                            <div className="flex gap-2 flex-1 min-w-0 overflow-x-auto">
                              {record.kilos && (
                                <span className="text-xs font-medium px-2 py-1 bg-muted/50 rounded whitespace-nowrap">
                                  {record.kilos} kg
                                </span>
                              )}
                              {record.volume && (
                                <span className="text-xs font-medium px-2 py-1 bg-muted/50 rounded whitespace-nowrap">
                                  {record.volume}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Nenhum registro de treino encontrado
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
