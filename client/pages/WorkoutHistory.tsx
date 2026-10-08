import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, History, MoreVertical, Trash2 } from "lucide-react";

import { ScreenAura } from "@/components/shared/screen-aura";
import { UserAvatar } from "@/components/shared/user-avatar";
import { LoadingSpinner, SkeletonLoader } from "@/components/shared/animated-loading";
import {
  BADGE_TONE_STYLE,
  HISTORY_KIND_STYLE,
  WorkoutHistoryDetail,
  buildHistorySummaryData,
  challengeBadge,
  challengeSubtitle,
  countLabel,
  formatHistoryDate,
  formatHistoryNumber,
  historyLocale,
} from "@/components/goals/workout-history-detail";
import { toast } from "@/components/ui/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { WorkoutSummaryData } from "@/components/goals/workout-summary-overlay";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/language-context";
import { useAppRefreshTick } from "@/lib/app-refresh";
import { reportHandledError } from "@/lib/monitoring";
import { hapticLight } from "@/lib/haptics";
import { FEATURES } from "@/lib/feature-flags";
import {
  deleteWorkoutHistoryDb,
  getPendingWorkoutChallengesDb,
  getWorkoutHistoryFirstDateDb,
  getWorkoutHistoryMonthStatsDb,
  getWorkoutHistoryPageDb,
  type WorkoutHistoryMonthStats,
  type WorkoutChallenge,
  type WorkoutHistoryKind,
  type WorkoutHistorySession,
} from "@/lib/ritmofit-db";

type Filter = "all" | WorkoutHistoryKind;

// ~3.900 linhas (canvas, templates) — só baixa quando alguém abre o resumo.
// `openSummary` espera o chunk ANTES de montar o overlay: sem rede, a falha vira
// toast em vez de derrubar a tela pelo Suspense.
const loadSummaryOverlay = () => import("@/components/goals/workout-summary-overlay");
const WorkoutSummaryOverlay = React.lazy(() =>
  loadSummaryOverlay().then((m) => ({ default: m.WorkoutSummaryOverlay })),
);

/**
 * Última leitura em memória: voltar de Metas para cá pinta na hora e relê por
 * baixo. Só a 1ª página — as mais antigas recarregam sob demanda.
 */
let lastFirstPage: { sessions: WorkoutHistorySession[]; nextBefore: string | null } | null = null;
/**
 * Macro dos meses que a lista carregada NÃO cobre (lidos do banco), por
 * "ano-mês". Zerado ao apagar treino e ao reler a tela.
 */
const monthStatsCache = new Map<string, WorkoutHistoryMonthStats>();
/** Idem para os desafios recebidos em aberto (seção "Desafios pendentes"). */
let lastPending: WorkoutChallenge[] = [];

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
  const [clearConfirmOpen, setClearConfirmOpen] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);
  // Mês do card de resumo — na página para sobreviver a abrir/fechar um treino.
  const [statsMonth, setStatsMonth] = React.useState(() => startOfMonth(new Date()));
  const refreshTick = useAppRefreshTick();
  const { user } = useAuth();
  // "Resumo do treino" da sessão aberta no detalhe (o mesmo overlay do Finalizar).
  const [summaryData, setSummaryData] = React.useState<WorkoutSummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = React.useState(false);
  // Desafios que me mandaram e ainda não fiz (pendentes ou aceitos e largados).
  const [pending, setPending] = React.useState<WorkoutChallenge[]>(lastPending);

  const openSummary = async (session: WorkoutHistorySession) => {
    if (!user || summaryLoading) return;
    setSummaryLoading(true);
    try {
      const [data] = await Promise.all([buildHistorySummaryData(session, user.id), loadSummaryOverlay()]);
      setSummaryData(data);
    } catch (err) {
      reportHandledError(err, "workout-history:open-summary");
      toast({ title: t("goals_history_summary_error"), description: t("retry"), variant: "destructive" });
    } finally {
      setSummaryLoading(false);
    }
  };
  // O resumo é de UMA sessão: sair do detalhe (voltar) ou abrir outra o descarta.
  React.useEffect(() => {
    setSummaryData(null);
  }, [selectedKey]);

  // Publicou no feed / vai criar o flow: mesmo destino do resumo em Metas.
  const leaveSummaryToFeed = (state: Record<string, unknown>) => {
    setSummaryData(null);
    navigate("/", { state });
  };

  // Mantém o cache do módulo em dia com o que a tela mostra depois de apagar —
  // senão voltar para cá pintaria por um instante o treino apagado.
  const applySessions = (next: WorkoutHistorySession[], nextCursor: string | null) => {
    setSessions(next);
    setNextBefore(nextCursor);
    if (lastFirstPage) lastFirstPage = { sessions: next, nextBefore: nextCursor };
  };

  const deleteSession = async (session: WorkoutHistorySession) => {
    await deleteWorkoutHistoryDb(session.rowIds);
    monthStatsCache.clear();
    applySessions(sessions.filter((s) => s.key !== session.key), nextBefore);
    // Fecha o detalhe (o `?s=` foi empilhado ao abrir).
    navigate(-1);
  };

  // "Apagar histórico": todas as séries do usuário, inclusive as páginas ainda
  // não carregadas (`null` na RPC = tudo).
  const clearHistory = async () => {
    setClearing(true);
    try {
      await deleteWorkoutHistoryDb(null);
      monthStatsCache.clear();
      applySessions([], null);
      setFilter("all");
      setClearConfirmOpen(false);
      toast({ title: t("goals_history_cleared") });
    } catch (err) {
      reportHandledError(err, "workout-history:clear");
      toast({ title: t("goals_history_delete_error"), description: t("retry"), variant: "destructive" });
    } finally {
      setClearing(false);
    }
  };

  React.useEffect(() => {
    let cancelled = false;
    monthStatsCache.clear();
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

  React.useEffect(() => {
    if (!FEATURES.workoutChallenge || !user) return;
    let cancelled = false;
    // Já devolve [] em erro: a seção é um atalho, a lista segue sem ela.
    void getPendingWorkoutChallengesDb().then((list) => {
      if (cancelled) return;
      lastPending = list;
      setPending(list);
    });
    return () => { cancelled = true; };
  }, [refreshTick, user]);

  // Aceitar/recusar mora em Metas (o aceite abre a sessão do desafio lá):
  // `?challenge=<id>` abre o mesmo ChallengeInviteDialog do push.
  const openPendingChallenge = (c: WorkoutChallenge) => navigate(`/metas?challenge=${encodeURIComponent(c.id)}`);
  const showPending =
    FEATURES.workoutChallenge && pending.length > 0 && (filter === "all" || filter === "challenge");
  const pendingSection = showPending ? (
    <section className="space-y-2">
      <h2 className="text-[13px] font-semibold text-white/60">{t("goals_history_pending_title")}</h2>
      {pending.map((c) => (
        <PendingChallengeRow key={c.id} challenge={c} onOpen={() => openPendingChallenge(c)} />
      ))}
    </section>
  ) : null;

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
          onDelete={() => deleteSession(selected)}
          onOpenSummary={() => void openSummary(selected)}
          summaryLoading={summaryLoading}
        />
        {summaryData && (
          <React.Suspense fallback={null}>
            <WorkoutSummaryOverlay
              data={summaryData}
              onClose={() => setSummaryData(null)}
              onSharedToFeed={() => leaveSummaryToFeed({ refreshFeed: true })}
              // Não publica o flow aqui: o criador mora no Feed e abre direto na
              // legenda com a mídia do resumo (ver Goals.tsx).
              onShareToFlow={(seed, opts) =>
                leaveSummaryToFeed(
                  opts?.alsoPostedToFeed ? { createFlowSeed: seed, refreshFeed: true } : { createFlowSeed: seed },
                )
              }
            />
          </React.Suspense>
        )}
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
        {sessions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t("goals_history_options")}
                className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white active:scale-90 transition-transform"
                style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)" }}
              >
                <MoreVertical className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onClick={() => setClearConfirmOpen(true)}
                className="text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t("goals_history_clear")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <AlertDialog open={clearConfirmOpen} onOpenChange={(open) => !clearing && setClearConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("goals_history_clear_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("goals_history_clear_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>{t("goals_cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={clearing}
              onClick={(e) => {
                e.preventDefault();
                void clearHistory();
              }}
            >
              {clearing ? <LoadingSpinner className="h-4 w-4" /> : t("goals_history_clear_confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {loading && sessions.length === 0 ? (
        <SkeletonLoader lines={6} className="mt-4" />
      ) : sessions.length === 0 ? (
        <>
          {pendingSection && <div className="mt-2">{pendingSection}</div>}
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
        </>
      ) : (
        <div className="mt-2 space-y-4">
          <MonthStatsCard
            sessions={sessions}
            nextBefore={nextBefore}
            refreshTick={refreshTick}
            month={statsMonth}
            onMonthChange={setStatsMonth}
          />

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

          {pendingSection}

          {groups.length === 0 ? (
            !pendingSection && <p className="py-10 text-center text-[13px] text-white/55">{t("goals_history_filter_empty")}</p>
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

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * Macro do mês (treinos · séries · kg de volume) com navegação ‹ › entre meses
 * (2026-10-08). Mês que a lista carregada cobre inteiro = conta das sessões já
 * na tela; mais antigo que isso = `getWorkoutHistoryMonthStatsDb` (só as
 * séries daquele mês, com cache). Vai até o mês da 1ª série do usuário.
 */
function MonthStatsCard({
  sessions,
  nextBefore,
  refreshTick,
  month,
  onMonthChange,
}: {
  sessions: WorkoutHistorySession[];
  nextBefore: string | null;
  refreshTick: number;
  /** Dia 1, 00:00 local. */
  month: Date;
  onMonthChange: (month: Date) => void;
}) {
  const { t, language } = useLanguage();
  const thisMonth = startOfMonth(new Date());
  const [firstDate, setFirstDate] = React.useState<string | null>(null);
  const [, setCacheVersion] = React.useState(0);
  const key = `${month.getFullYear()}-${month.getMonth()}`;
  const monthMs = month.getTime();
  const nextMonthMs = new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime();
  const isEmpty = sessions.length === 0;

  // Limite da seta ‹: o mês da 1ª série. Relê ao voltar ao app e se a lista
  // esvaziar (apagou o histórico).
  React.useEffect(() => {
    let cancelled = false;
    getWorkoutHistoryFirstDateDb()
      .then((iso) => { if (!cancelled) setFirstDate(iso); })
      .catch(() => { /* sem o limite, a seta usa a sessão mais antiga carregada */ });
    return () => { cancelled = true; };
  }, [refreshTick, isEmpty]);

  // A lista desce do mais novo para o mais antigo: cobre o mês inteiro se não
  // há mais páginas ou se a sessão mais antiga carregada é anterior ao mês.
  const oldest = sessions[sessions.length - 1];
  const covered = !nextBefore || (!!oldest && Date.parse(oldest.completedAt) < monthMs);

  const local = React.useMemo<WorkoutHistoryMonthStats>(() => {
    const inMonth = sessions.filter((s) => {
      const ms = Date.parse(s.completedAt);
      return ms >= monthMs && ms < nextMonthMs;
    });
    return {
      count: inMonth.length,
      sets: inMonth.reduce((n, s) => n + s.totalSeries, 0),
      volumeKg: inMonth.reduce((n, s) => n + s.volumeKg, 0),
    };
  }, [sessions, monthMs, nextMonthMs]);

  React.useEffect(() => {
    if (covered || monthStatsCache.has(key)) return;
    let cancelled = false;
    getWorkoutHistoryMonthStatsDb(new Date(monthMs))
      .then((stats) => {
        monthStatsCache.set(key, stats);
        if (!cancelled) setCacheVersion((v) => v + 1);
      })
      .catch((err) => {
        if (cancelled) return;
        reportHandledError(err, "workout-history:month-stats");
        toast({ title: t("goals_history_load_error"), description: t("retry"), variant: "destructive" });
      });
    return () => { cancelled = true; };
    // `t` fora de propósito: trocar o idioma não relê o banco.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, covered, refreshTick]);

  const stats = covered ? local : monthStatsCache.get(key) ?? null;

  const firstMonthMs = firstDate
    ? startOfMonth(new Date(firstDate)).getTime()
    : oldest
      ? startOfMonth(new Date(oldest.completedAt)).getTime()
      : thisMonth.getTime();
  // Sem o limite do banco e com páginas por carregar, ainda pode haver meses antes.
  const canPrev = monthMs > firstMonthMs || (!firstDate && !!nextBefore);
  const canNext = monthMs < thisMonth.getTime();
  const shift = (delta: number) => {
    hapticLight();
    onMonthChange(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  };

  let label = t("goals_history_this_month");
  if (monthMs !== thisMonth.getTime()) {
    const m = month.toLocaleDateString(historyLocale(language), { month: "long", year: "numeric" });
    label = m.charAt(0).toUpperCase() + m.slice(1);
  }

  const arrow = (dir: -1 | 1, enabled: boolean) => (
    <button
      type="button"
      onClick={() => shift(dir)}
      disabled={!enabled}
      aria-label={dir < 0 ? t("goals_history_prev_month") : t("goals_history_next_month")}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white active:scale-90 transition-transform disabled:opacity-30 disabled:active:scale-100"
      style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)" }}
    >
      {dir < 0 ? <ChevronLeft className="h-[18px] w-[18px]" /> : <ChevronRight className="h-[18px] w-[18px]" />}
    </button>
  );

  return (
    <div
      className="px-4 py-3"
      style={{
        borderRadius: 22,
        background: "linear-gradient(rgba(255,255,255,.08),rgba(255,255,255,.03))",
        border: "1px solid rgba(255,255,255,.1)",
      }}
    >
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white/70" aria-live="polite">
          {label}
        </p>
        {arrow(-1, canPrev)}
        {arrow(1, canNext)}
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        {[
          { v: stats ? String(stats.count) : null, l: t("goals_history_stat_workouts") },
          { v: stats ? String(stats.sets) : null, l: t("goals_history_stat_sets") },
          { v: stats ? formatHistoryNumber(stats.volumeKg, language) : null, l: t("goals_history_stat_volume") },
        ].map((s) => (
          <div key={s.l}>
            {s.v != null ? (
              <p className="text-[20px] font-extrabold text-white tabular-nums">{s.v}</p>
            ) : (
              <div className="my-[5px] h-[20px] w-10 rounded-md bg-white/10 animate-pulse" />
            )}
            <p className="text-[12px] text-white/60">{s.l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Desafio recebido em aberto — toque abre o convite (aceitar/recusar) em Metas. */
function PendingChallengeRow({ challenge, onOpen }: { challenge: WorkoutChallenge; onOpen: () => void }) {
  const { t, language } = useLanguage();
  const style = HISTORY_KIND_STYLE.challenge;
  const Icon = style.icon;
  const kicker = `${t(style.labelKey)} · ${formatHistoryDate(challenge.createdAt, language, t)}`;
  const leftMs = Date.parse(challenge.expiresAt) - Date.now();
  const leftHours = Math.max(1, Math.ceil(leftMs / 3_600_000));
  const expires = Number.isFinite(leftMs)
    ? leftHours <= 24
      ? t("goals_history_pending_expires_hours").replace("{n}", String(leftHours))
      : t("goals_history_pending_expires_days").replace("{n}", String(Math.ceil(leftHours / 24)))
    : null;
  const meta = [
    t("goals_history_challenge_from").replace("{name}", challenge.challengerNickname),
    countLabel(challenge.snapshot.items.length, "goals_history_exercises_one", "goals_history_exercises", t),
    expires,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 p-3 text-left active:scale-[0.99] transition-transform"
      style={{
        borderRadius: 18,
        background: "linear-gradient(rgba(244,63,94,.14),rgba(244,63,94,.04))",
        border: "1px solid rgba(244,63,94,.32)",
      }}
    >
      <div className="relative shrink-0">
        <UserAvatar photo={challenge.challengerPhoto} nickname={challenge.challengerNickname} size="md" />
        <span
          className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full"
          style={{ background: "#2a1218", color: style.color, boxShadow: "0 0 0 2px #0b0c11" }}
        >
          <Icon className="h-3 w-3" strokeWidth={2.4} />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11.5px] font-semibold text-white/60">{kicker}</p>
        <p className="truncate text-[15px] font-semibold text-white">
          {challenge.routineName || t(style.labelKey)}
        </p>
        <p className="truncate text-[12.5px] text-white/60">{meta}</p>
      </div>
      <span
        className="shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-bold"
        style={{ background: style.color, color: "#0b0c11" }}
      >
        {challenge.status === "accepted" ? t("goals_history_pending_resume") : t("goals_history_pending_accept")}
      </span>
    </button>
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
