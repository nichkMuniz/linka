import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, History } from "lucide-react";

import { ScreenAura } from "@/components/shared/screen-aura";
import { UserAvatar } from "@/components/shared/user-avatar";
import { LoadingSpinner, SkeletonLoader } from "@/components/shared/animated-loading";
import {
  BADGE_TONE_STYLE,
  HISTORY_KIND_STYLE,
  WorkoutHistoryDetail,
  challengeBadge,
  challengeSubtitle,
  countLabel,
  formatHistoryDate,
  formatHistoryNumber,
  historyLocale,
} from "@/components/goals/workout-history-detail";
import { toast } from "@/components/ui/use-toast";
import { useLanguage } from "@/lib/language-context";
import { useAppRefreshTick } from "@/lib/app-refresh";
import { reportHandledError } from "@/lib/monitoring";
import { FEATURES } from "@/lib/feature-flags";
import {
  getWorkoutHistoryPageDb,
  type WorkoutHistoryKind,
  type WorkoutHistorySession,
} from "@/lib/ritmofit-db";

type Filter = "all" | WorkoutHistoryKind;

/**
 * Última leitura em memória: voltar de Metas para cá pinta na hora e relê por
 * baixo. Só a 1ª página — as mais antigas recarregam sob demanda.
 */
let lastFirstPage: { sessions: WorkoutHistorySession[]; nextBefore: string | null } | null = null;

/** Segunda-feira 00:00 (local) da semana de `d`. */
function weekStart(d: Date): number {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x.getTime();
}

/**
 * Histórico de treinos (`/metas/historico`, 2026-10-05) — todos os treinos
 * finalizados: de rotina, rápidos, em conjunto e desafios. Aberto pelo botão de
 * relógio no card de streak de Metas. Ver docs/22-historico-treinos.md.
 */
export default function WorkoutHistory() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedKey = searchParams.get("s");

  const [sessions, setSessions] = React.useState<WorkoutHistorySession[]>(lastFirstPage?.sessions ?? []);
  const [nextBefore, setNextBefore] = React.useState<string | null>(lastFirstPage?.nextBefore ?? null);
  const [loading, setLoading] = React.useState(!lastFirstPage);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [filter, setFilter] = React.useState<Filter>("all");
  const refreshTick = useAppRefreshTick();

  React.useEffect(() => {
    let cancelled = false;
    getWorkoutHistoryPageDb()
      .then((page) => {
        if (cancelled) return;
        lastFirstPage = page;
        setSessions(page.sessions);
        setNextBefore(page.nextBefore);
      })
      .catch((err) => {
        if (cancelled) return;
        reportHandledError(err, "workout-history:load");
        toast({ title: t("goals_history_load_error"), description: t("retry"), variant: "destructive" });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // `t` fora de propósito: trocar o idioma não relê o banco.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  const loadMore = async () => {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getWorkoutHistoryPageDb(nextBefore);
      setSessions((prev) => {
        const seen = new Set(prev.map((s) => s.key));
        return [...prev, ...page.sessions.filter((s) => !seen.has(s.key))];
      });
      setNextBefore(page.nextBefore);
    } catch (err) {
      reportHandledError(err, "workout-history:load-more");
      toast({ title: t("goals_history_load_error"), description: t("retry"), variant: "destructive" });
    } finally {
      setLoadingMore(false);
    }
  };

  // ── Detalhe: `?s=<key>` na URL, para o voltar (botão/gesto) fechar o detalhe ──
  const selected = selectedKey ? sessions.find((s) => s.key === selectedKey) ?? null : null;
  const listScrollRef = React.useRef(0);
  const openSession = (key: string) => {
    listScrollRef.current = window.scrollY;
    navigate({ search: `?s=${encodeURIComponent(key)}` });
  };
  React.useEffect(() => {
    if (selected) {
      window.scrollTo(0, 0);
    } else if (!selectedKey) {
      // Voltou do detalhe: devolve a lista onde estava.
      requestAnimationFrame(() => window.scrollTo(0, listScrollRef.current));
    }
  }, [selected, selectedKey]);
  // Link de uma sessão que não está carregada (ex.: recarregou o app numa
  // página antiga): cai na lista em vez de ficar numa tela vazia.
  React.useEffect(() => {
    if (selectedKey && !selected && !loading) setSearchParams({}, { replace: true });
  }, [selectedKey, selected, loading, setSearchParams]);

  const chips = React.useMemo(() => {
    const list: Array<{ id: Filter; label: string }> = [
      { id: "all", label: t("goals_history_filter_all") },
      { id: "routine", label: t("goals_history_filter_routine") },
    ];
    if (FEATURES.quickWorkout) list.push({ id: "quick", label: t("goals_history_filter_quick") });
    if (FEATURES.workoutParty) list.push({ id: "party", label: t("goals_history_filter_party") });
    if (FEATURES.workoutChallenge) list.push({ id: "challenge", label: t("goals_history_filter_challenge") });
    return list;
  }, [t]);

  const monthSummary = React.useMemo(() => {
    const now = new Date();
    const inMonth = sessions.filter((s) => {
      const d = new Date(s.completedAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    return {
      count: inMonth.length,
      sets: inMonth.reduce((n, s) => n + s.totalSeries, 0),
      volume: inMonth.reduce((n, s) => n + s.volumeKg, 0),
    };
  }, [sessions]);

  const groups = React.useMemo(() => {
    const visible = filter === "all" ? sessions : sessions.filter((s) => s.kind === filter);
    const thisWeek = weekStart(new Date());
    const lastWeek = thisWeek - 7 * 24 * 60 * 60_000;
    const locale = historyLocale(language);
    const out: Array<{ key: string; label: string; items: WorkoutHistorySession[] }> = [];
    for (const s of visible) {
      const d = new Date(s.completedAt);
      const ws = weekStart(d);
      let key: string;
      let label: string;
      if (ws >= thisWeek) {
        key = "w0";
        label = t("goals_history_this_week");
      } else if (ws >= lastWeek) {
        key = "w1";
        label = t("goals_history_last_week");
      } else {
        key = `m${d.getFullYear()}-${d.getMonth()}`;
        const month = d.toLocaleDateString(locale, { month: "long", year: "numeric" });
        label = month.charAt(0).toUpperCase() + month.slice(1);
      }
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(s);
      else out.push({ key, label, items: [s] });
    }
    return out;
  }, [sessions, filter, language, t]);

  if (selected) {
    return (
      <div className="relative mx-auto w-full max-w-2xl px-4 pt-2 pb-28">
        <ScreenAura variant="goals" />
        <WorkoutHistoryDetail
          session={selected}
          onBack={() => navigate(-1)}
          onSharedToFeed={() => navigate("/", { state: { refreshFeed: true, showFollowing: true } })}
        />
      </div>
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-2xl px-4 pt-2 pb-28">
      <ScreenAura variant="goals" />

      <div className="flex items-center gap-3 py-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label={t("goals_back")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white active:scale-90 transition-transform"
          style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)" }}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-[20px] font-bold text-white">{t("goals_history_title")}</h1>
      </div>

      {loading && sessions.length === 0 ? (
        <SkeletonLoader lines={6} className="mt-4" />
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <div
            className="mb-1 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: "rgba(91,140,255,.18)" }}
          >
            <History className="h-6 w-6" style={{ color: "#b9cfff" }} />
          </div>
          <p className="text-[15px] font-semibold text-white">{t("goals_history_empty_title")}</p>
          <p className="max-w-xs text-[13px] text-white/60">{t("goals_history_empty_desc")}</p>
        </div>
      ) : (
        <div className="mt-2 space-y-4">
          {monthSummary.count > 0 && (
            <div
              className="px-4 py-3.5"
              style={{
                borderRadius: 22,
                background: "linear-gradient(rgba(255,255,255,.08),rgba(255,255,255,.03))",
                border: "1px solid rgba(255,255,255,.1)",
              }}
            >
              <p className="text-[12px] font-semibold text-white/60">{t("goals_history_this_month")}</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  { v: String(monthSummary.count), l: t("goals_history_stat_workouts") },
                  { v: String(monthSummary.sets), l: t("goals_history_stat_sets") },
                  { v: formatHistoryNumber(monthSummary.volume, language), l: t("goals_history_stat_volume") },
                ].map((s) => (
                  <div key={s.l}>
                    <p className="text-[20px] font-extrabold text-white tabular-nums">{s.v}</p>
                    <p className="text-[12px] text-white/60">{s.l}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar">
            {chips.map((c) => {
              const active = c.id === filter;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setFilter(c.id)}
                  aria-pressed={active}
                  className="h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-[13.5px] transition-colors"
                  style={
                    active
                      ? { background: "#fff", color: "#0b0c11", fontWeight: 650, border: "1px solid #fff" }
                      : { background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.85)", fontWeight: 550, border: "1px solid rgba(255,255,255,.14)" }
                  }
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          {groups.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-white/55">{t("goals_history_filter_empty")}</p>
          ) : (
            groups.map((g) => (
              <section key={g.key} className="space-y-2">
                <h2 className="text-[13px] font-semibold text-white/60">{g.label}</h2>
                {g.items.map((s) => (
                  <HistoryRow key={s.key} session={s} onOpen={() => openSession(s.key)} />
                ))}
              </section>
            ))
          )}

          {nextBefore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="flex h-11 w-full items-center justify-center rounded-full text-[14px] font-semibold text-white disabled:opacity-60"
              style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)" }}
            >
              {loadingMore ? <LoadingSpinner className="h-5 w-5" /> : t("goals_history_load_more")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryRow({ session, onOpen }: { session: WorkoutHistorySession; onOpen: () => void }) {
  const { t, language } = useLanguage();
  const style = HISTORY_KIND_STYLE[session.kind];
  const Icon = style.icon;
  const badge = session.kind === "challenge" ? challengeBadge(session.challenges, t) : null;
  const kicker = `${t(style.labelKey)} · ${formatHistoryDate(session.completedAt, language, t)}`;
  // Desafio: o adversário vai para a linha de baixo — na de cima, um nome longo
  // empurrava a data para fora.
  const meta = [
    session.kind === "challenge"
      ? challengeSubtitle(session.challenges, t)
      : countLabel(session.exercises.length, "goals_history_exercises_one", "goals_history_exercises", t),
    countLabel(session.totalSeries, "goals_history_sets_one", "goals_history_sets", t),
  ].join(" · ");

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 p-3 text-left active:scale-[0.99] transition-transform"
      style={{
        borderRadius: 18,
        background: "linear-gradient(rgba(255,255,255,.07),rgba(255,255,255,.025))",
        border: "1px solid rgba(255,255,255,.09)",
      }}
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]"
        style={{ background: style.tint, color: style.color }}
      >
        <Icon className="h-[21px] w-[21px]" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11.5px] font-semibold text-white/60">{kicker}</p>
        <p className="truncate text-[15px] font-semibold text-white">{session.title}</p>
        <p className="truncate text-[12.5px] text-white/60">{meta}</p>
      </div>
      {badge ? (
        <span
          className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-bold"
          style={BADGE_TONE_STYLE[badge.tone]}
        >
          {badge.label}
        </span>
      ) : session.kind === "party" && session.party && session.party.others.length > 0 ? (
        <div className="flex shrink-0 -space-x-2">
          {session.party.others.slice(0, 3).map((o) => (
            <div key={o.userId} className="rounded-full" style={{ boxShadow: "0 0 0 2px #0b0c11" }}>
              <UserAvatar photo={o.photo} nickname={o.nickname} size="sm" />
            </div>
          ))}
        </div>
      ) : (
        <ChevronRight className="h-[18px] w-[18px] shrink-0 text-white/45" />
      )}
    </button>
  );
}
