import * as React from "react";
import { AlertTriangle, CalendarDays, Clock, X } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import type { TranslationKey } from "@/lib/i18n";
import { formatScheduledTime } from "@/hooks/use-routine-notifications";
import { buildRoutineWeekdayMap } from "@/components/goals/suggested-routines-data";
import { isSequentialCard, type RoutineCard } from "@/components/goals/goals-helpers";
import type { RoutineTypeCode } from "@/lib/ritmofit-db";

// seg→dom (0..6) — a mesma convenção Monday-first usada no resto de Metas.
const WEEKDAY_KEYS: TranslationKey[] = [
  "goals_weekday_mon", "goals_weekday_tue", "goals_weekday_wed",
  "goals_weekday_thu", "goals_weekday_fri", "goals_weekday_sat", "goals_weekday_sun",
];

interface RoutineScheduleModalProps {
  open: boolean;
  onClose: () => void;
  /** Cards já filtrados pelo tipo do drawer (treino/dieta/hábito). */
  cards: RoutineCard[];
  type: RoutineTypeCode;
  onOpenCard: (card: RoutineCard) => void;
}

type Entry = {
  card: RoutineCard;
  /** "HH:MM" ou null (sem horário) */
  time: string | null;
  /** roda todo dia (scheduled_days vazio) — marcado para o usuário não achar erro */
  everyday: boolean;
  /** há outra rotina no MESMO dia e MESMO horário */
  conflict: boolean;
};

/**
 * Agenda semanal das rotinas de um tipo: para cada dia (seg→dom), quais rotinas
 * rodam e em que horário. Destaca horários repetidos no mesmo dia (duas rotinas
 * ao mesmo tempo) — ajuda a flagrar agendamento errado. Só leitura; tocar numa
 * rotina abre o detalhe dela.
 */
export function RoutineScheduleModal({
  open,
  onClose,
  cards,
  type,
  onOpenCard,
}: RoutineScheduleModalProps) {
  const { t } = useLanguage();
  // Mapa nome→dias do programa sugerido: fallback de treino sem dias explícitos
  // (mesma heurística do Hub do Hoje).
  const weekdayMap = React.useMemo(() => buildRoutineWeekdayMap(), []);

  // Dias (0..6) de uma rotina; null = todo dia. Prioriza scheduled_days; treino
  // sem dias cai no calendário do programa casado por nome.
  const cardWeekdays = React.useCallback(
    (card: RoutineCard): number[] | null => {
      const sd = (card.scheduledDays ?? "").trim();
      if (sd) {
        const parsed = sd
          .split(",")
          .map((p) => Number(p.trim()))
          .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
        return parsed.length > 0 ? parsed : null;
      }
      if (card.type === 1) {
        const mapped = weekdayMap.get((card.name ?? "").trim().toLowerCase());
        if (mapped && mapped.length > 0) return mapped;
      }
      return null;
    },
    [weekdayMap],
  );

  // Monta, por dia da semana, a lista de entradas ordenada por horário. Rotinas
  // "todo dia" entram em TODOS os dias (para o conflito de horário aparecer no
  // dia certo). Conflito = mesmo dia + mesmo "HH:MM" com 2+ rotinas.
  // Rotinas sequenciais (rodízio) não têm dia fixo → listadas à parte, na ordem
  // do rodízio (criação), fora da grade de dias.
  const sequentialCards = React.useMemo(
    () =>
      cards
        .filter(isSequentialCard)
        .sort((a, b) => {
          const na = a.routineId != null ? Number(a.routineId) : Infinity;
          const nb = b.routineId != null ? Number(b.routineId) : Infinity;
          return na - nb;
        }),
    [cards],
  );

  const byDay = React.useMemo<Entry[][]>(() => {
    const days: Entry[][] = [[], [], [], [], [], [], []];
    for (const card of cards) {
      if (isSequentialCard(card)) continue; // fora da grade de dias
      const wd = cardWeekdays(card);
      const everyday = wd === null;
      const targetDays = everyday ? [0, 1, 2, 3, 4, 5, 6] : wd!;
      const time = card.scheduledTime ? formatScheduledTime(card.scheduledTime) : null;
      for (const d of targetDays) {
        days[d].push({ card, time, everyday, conflict: false });
      }
    }
    for (const list of days) {
      // ordena por horário (sem horário vai para o fim)
      list.sort((a, b) => {
        if (a.time === b.time) return 0;
        if (!a.time) return 1;
        if (!b.time) return -1;
        return a.time < b.time ? -1 : 1;
      });
      // marca conflitos: 2+ entradas com o mesmo horário definido
      const counts = new Map<string, number>();
      for (const e of list) if (e.time) counts.set(e.time, (counts.get(e.time) ?? 0) + 1);
      for (const e of list) if (e.time && (counts.get(e.time) ?? 0) > 1) e.conflict = true;
    }
    return days;
  }, [cards, cardWeekdays]);

  const todayIdx = (new Date().getDay() + 6) % 7;
  const hasAny = cards.length > 0;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center pointer-events-none"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-auto"
        style={{ background: "rgba(0,0,0,.6)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
        onClick={onClose}
      />

      <div
        className="relative pointer-events-auto w-full max-w-[420px] flex flex-col"
        style={{
          maxHeight: "100%",
          borderRadius: "28px",
          background: "linear-gradient(160deg, rgba(255,255,255,.13) 0%, rgba(255,255,255,.05) 100%)",
          backdropFilter: "blur(32px) saturate(180%)",
          WebkitBackdropFilter: "blur(32px) saturate(180%)",
          border: "1px solid rgba(255,255,255,.15)",
          boxShadow: "0 24px 80px -12px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.2)",
        }}
      >
        {/* header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0" style={{ color: "#9d6bff" }} />
              <span className="text-white font-bold" style={{ fontSize: "17px" }}>
                {t("goals_schedule_title")}
              </span>
            </div>
            <p className="mt-1 text-xs leading-snug" style={{ color: "rgba(255,255,255,.5)" }}>
              {t("goals_schedule_hint")}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t("close")}
            className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.14)" }}
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* corpo: 7 dias */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-5 space-y-2">
          {sequentialCards.length > 0 && (
            <div
              className="rounded-2xl p-3"
              style={{ background: "rgba(93,140,255,.1)", border: "1px solid rgba(93,140,255,.28)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#a9c0ff" }}>
                  {t("goals_seq_label")}
                </span>
                <span className="text-[11px]" style={{ color: "rgba(255,255,255,.4)" }}>
                  {t("goals_schedule_seq_hint")}
                </span>
              </div>
              <div className="space-y-1.5">
                {sequentialCards.map((card, i) => (
                  <button
                    key={card.key}
                    onClick={() => { onClose(); onOpenCard(card); }}
                    className="w-full flex items-center gap-2 rounded-xl px-2.5 py-2 text-left active:scale-[.99] transition-transform"
                    style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}
                  >
                    <span className="shrink-0 tabular-nums text-sm font-semibold w-[24px] text-center" style={{ color: "rgba(255,255,255,.55)" }}>
                      {i + 1}
                    </span>
                    <span className="flex-1 min-w-0 truncate text-sm text-white">
                      {card.name ?? t(TYPE_LABEL_KEY[type])}
                    </span>
                    {card.scheduledTime && (
                      <span className="shrink-0 tabular-nums text-sm font-semibold" style={{ color: "#fff" }}>
                        {formatScheduledTime(card.scheduledTime)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!hasAny && (
            <p className="text-sm text-center py-8" style={{ color: "rgba(255,255,255,.5)" }}>
              {t("goals_schedule_empty")}
            </p>
          )}

          {/* Grade de dias — só quando há rotina por dia da semana (senão
              todos os 7 dias ficariam "sem rotina" numa lista só de sequenciais). */}
          {cards.some((c) => !isSequentialCard(c)) &&
            WEEKDAY_KEYS.map((key, dayIdx) => {
              const entries = byDay[dayIdx];
              const isToday = dayIdx === todayIdx;
              return (
                <div
                  key={key}
                  className="rounded-2xl p-3"
                  style={{
                    background: isToday ? "rgba(157,107,255,.1)" : "rgba(255,255,255,.05)",
                    border: `1px solid ${isToday ? "rgba(157,107,255,.3)" : "rgba(255,255,255,.09)"}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-xs font-bold uppercase tracking-wide"
                      style={{ color: isToday ? "#c9b0ff" : "rgba(255,255,255,.7)" }}
                    >
                      {t(key)}
                    </span>
                    <span className="text-[11px]" style={{ color: "rgba(255,255,255,.35)" }}>
                      {entries.length > 0 ? `· ${entries.length}` : ""}
                    </span>
                  </div>

                  {entries.length === 0 ? (
                    <p className="text-xs" style={{ color: "rgba(255,255,255,.35)" }}>
                      {t("goals_schedule_rest")}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {entries.map((e, i) => (
                        <button
                          key={`${e.card.key}-${i}`}
                          onClick={() => { onClose(); onOpenCard(e.card); }}
                          className="w-full flex items-center gap-2 rounded-xl px-2.5 py-2 text-left active:scale-[.99] transition-transform"
                          style={{
                            background: e.conflict ? "rgba(245,158,11,.12)" : "rgba(255,255,255,.05)",
                            border: `1px solid ${e.conflict ? "rgba(245,158,11,.4)" : "rgba(255,255,255,.08)"}`,
                          }}
                        >
                          {/* horário */}
                          <span
                            className="shrink-0 tabular-nums text-sm font-semibold w-[52px] text-center"
                            style={{ color: e.time ? "#fff" : "rgba(255,255,255,.4)" }}
                          >
                            {e.time ?? "—"}
                          </span>
                          <span className="w-px self-stretch" style={{ background: "rgba(255,255,255,.1)" }} />
                          {/* nome + tags */}
                          <span className="flex-1 min-w-0">
                            <span className="block truncate text-sm text-white">
                              {e.card.name ?? t(TYPE_LABEL_KEY[type])}
                            </span>
                            <span className="flex items-center gap-1.5 mt-0.5">
                              {e.everyday && (
                                <span className="text-[10px]" style={{ color: "rgba(255,255,255,.4)" }}>
                                  {t("goals_schedule_everyday_tag")}
                                </span>
                              )}
                              {!e.time && (
                                <span className="inline-flex items-center gap-0.5 text-[10px]" style={{ color: "rgba(255,255,255,.4)" }}>
                                  <Clock className="h-2.5 w-2.5" />
                                  {t("goals_schedule_no_time")}
                                </span>
                              )}
                            </span>
                          </span>
                          {e.conflict && (
                            <span className="inline-flex items-center gap-1 shrink-0 text-[10px] font-medium" style={{ color: "#f59e0b" }}>
                              <AlertTriangle className="h-3 w-3" />
                              {t("goals_schedule_conflict")}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

const TYPE_LABEL_KEY: Record<RoutineTypeCode, TranslationKey> = {
  1: "goals_rt_exercises",
  2: "goals_rt_diets",
  3: "goals_rt_habits",
};
