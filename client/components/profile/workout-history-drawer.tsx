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
      <DrawerContent
        handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
        className="max-h-[80dvh] flex flex-col modal-enter !rounded-t-[32px] !border-0"
        style={{
          background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderTop: "1px solid rgba(255,255,255,.14)",
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DrawerHeader className="shrink-0">
          <DrawerTitle style={{ color: "#fff" }}>Histórico de {workout?.name || "Exercício"}</DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {isLoading ? (
            <div className="space-y-4 py-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-24 rounded animate-pulse" style={{ background: "rgba(255,255,255,.1)" }} />
                  <div className="h-24 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,.07)" }} />
                </div>
              ))}
            </div>
          ) : history.length > 0 ? (
            sortedDates.map((dateKey) => {
              const dayRecords = groupedByDay[dateKey];
              const totalKilos = dayRecords.reduce((sum, r) => sum + (r.kilos || 0), 0);
              const totalReps = dayRecords.length;

              return (
                <div key={dateKey} className="mb-4">
                  <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                    <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                      <p className="text-xs font-semibold uppercase" style={{ color: "rgba(255,255,255,.5)" }}>{dateKey}</p>
                      <div className="flex gap-4 mt-0.5">
                        <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{totalReps} série(s)</p>
                        {totalKilos > 0 && (
                          <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{totalKilos} kg total</p>
                        )}
                      </div>
                    </div>

                    <div className="divide-y" style={{ borderColor: "rgba(255,255,255,.06)" }}>
                      {dayRecords.map((record) => {
                        const time = new Date(record.createdAt).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                        return (
                          <div
                            key={record.id || `${record.createdAt}-${record.kilos}`}
                            className="flex items-center justify-between px-4 py-2.5"
                            style={{ borderColor: "rgba(255,255,255,.06)" }}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <p className="text-xs w-10" style={{ color: "rgba(255,255,255,.5)" }}>{time}</p>
                              <div className="flex gap-2 flex-1 min-w-0 overflow-x-auto">
                                {record.kilos && (
                                  <span className="text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap" style={{ background: "rgba(255,255,255,.08)", color: "#fff" }}>
                                    {record.kilos} kg
                                  </span>
                                )}
                                {record.volume && (
                                  <span className="text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap" style={{ background: "rgba(255,255,255,.08)", color: "#fff" }}>
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
                </div>
              );
            })
          ) : (
            <div className="text-center py-6 text-sm" style={{ color: "rgba(255,255,255,.5)" }}>
              Nenhum registro de treino encontrado
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
