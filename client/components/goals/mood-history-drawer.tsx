import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { getMoodHistoryDb, type MoodLog, type MoodValue } from "@/lib/ritmofit-db";

const MOODS: Record<MoodValue, { emoji: string; label: string; color: string }> = {
  muito_triste: { emoji: "😢", label: "Muito triste", color: "text-blue-400" },
  triste:       { emoji: "😕", label: "Triste",       color: "text-blue-300" },
  neutro:       { emoji: "😐", label: "Neutro",       color: "text-muted-foreground" },
  feliz:        { emoji: "😊", label: "Feliz",        color: "text-green-400" },
  muito_feliz:  { emoji: "😄", label: "Muito feliz",  color: "text-green-500" },
};

const MOOD_SCORE: Record<MoodValue, number> = {
  muito_triste: 1,
  triste:       2,
  neutro:       3,
  feliz:        4,
  muito_feliz:  5,
};

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

function getModeValue(arr: MoodValue[]): MoodValue {
  const counts: Partial<Record<MoodValue, number>> = {};
  for (const v of arr) counts[v] = (counts[v] ?? 0) + 1;
  return arr.reduce((a, b) => (counts[a]! >= counts[b]! ? a : b));
}

interface MoodHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

export function MoodHistoryDrawer({ open, onOpenChange, userId }: MoodHistoryDrawerProps) {
  const [logs, setLogs] = React.useState<MoodLog[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    getMoodHistoryDb(userId, 30)
      .then(setLogs)
      .finally(() => setLoading(false));
  }, [open, userId]);

  // Build last-7-days mini-calendar
  const today = new Date();
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const logByDate = React.useMemo(
    () => Object.fromEntries(logs.map((l) => [l.log_date, l.mood])),
    [logs],
  );

  const moodValues = logs.map((l) => l.mood);
  const avgScore =
    moodValues.length > 0
      ? moodValues.reduce((s, v) => s + MOOD_SCORE[v], 0) / moodValues.length
      : null;
  const dominantMood = moodValues.length > 0 ? getModeValue(moodValues) : null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="max-h-[85vh] flex flex-col"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <DrawerHeader className="shrink-0 pb-2">
          <DrawerTitle className="text-lg">Histórico de Humor</DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-5">
          {/* ─── Mini-calendário semanal ─────────────────────────── */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Últimos 7 dias
            </p>
            <div className="grid grid-cols-7 gap-1">
              {last7.map((date) => {
                const mood = logByDate[date] as MoodValue | undefined;
                const isToday = date === today.toISOString().slice(0, 10);
                return (
                  <div
                    key={date}
                    className={[
                      "flex flex-col items-center gap-0.5 py-2 rounded-xl",
                      isToday ? "bg-brand/10 ring-1 ring-brand/30" : "bg-muted/30",
                    ].join(" ")}
                  >
                    <span className="text-[10px] text-muted-foreground capitalize">
                      {new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "narrow" })}
                    </span>
                    <span className="text-xl leading-none">
                      {mood ? MOODS[mood].emoji : "·"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─── Resumo do período ───────────────────────────────── */}
          {logs.length > 0 && dominantMood && (
            <div className="bg-muted/30 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Humor predominante (30 dias)</p>
                <p className={`text-sm font-semibold mt-0.5 ${MOODS[dominantMood].color}`}>
                  {MOODS[dominantMood].emoji} {MOODS[dominantMood].label}
                </p>
              </div>
              {avgScore !== null && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Média</p>
                  <p className="text-2xl font-bold">{avgScore.toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground">/ 5</p>
                </div>
              )}
            </div>
          )}

          {/* ─── Lista cronológica ───────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Registros ({logs.length})
            </p>

            {loading && (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-xl bg-muted/40 animate-pulse" />
                ))}
              </div>
            )}

            {!loading && logs.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <span className="text-4xl">🌱</span>
                <p className="text-sm font-medium">Nenhum humor registrado ainda</p>
                <p className="text-xs text-muted-foreground">
                  Complete suas rotinas diárias e registre como está se sentindo.
                </p>
              </div>
            )}

            {!loading &&
              logs.map((log) => {
                const m = MOODS[log.mood];
                return (
                  <div
                    key={log.log_date}
                    className="flex items-center gap-3 bg-muted/30 rounded-xl px-4 py-3"
                  >
                    <span className="text-2xl leading-none">{m.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${m.color}`}>{m.label}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {formatDate(log.log_date)}
                      </p>
                    </div>
                    {/* score bar */}
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className={[
                            "w-1.5 h-4 rounded-full",
                            i < MOOD_SCORE[log.mood] ? "bg-brand" : "bg-muted",
                          ].join(" ")}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
