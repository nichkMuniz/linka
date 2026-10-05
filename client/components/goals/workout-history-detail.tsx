import * as React from "react";
import { ArrowLeft, Dumbbell, Share2, Swords, Users, Zap, type LucideIcon } from "lucide-react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { LoadingSpinner } from "@/components/shared/animated-loading";
import { ChallengeComparison, shareChallengeResultToFeed } from "@/components/goals/workout-challenge";
import { toast } from "@/components/ui/use-toast";
import { useLanguage } from "@/lib/language-context";
import type { TranslationKey } from "@/lib/i18n";
import { reportHandledError } from "@/lib/monitoring";
import { compareChallenge, type ChallengeOutcome } from "@/lib/workout-challenge";
import { formatCardioKm, formatCardioMinutes, sumCardioSets } from "@/lib/cardio-exercises";
import {
  getWorkoutChallengeResultsDb,
  getWorkoutPartyMembersDb,
  type WorkoutHistoryChallengeLink,
  type WorkoutHistoryExercise,
  type WorkoutHistoryKind,
  type WorkoutHistorySession,
  type WorkoutPartyMember,
} from "@/lib/ritmofit-db";

type T = (key: any) => string;

/**
 * Histórico de treinos (2026-10-05) — peças compartilhadas entre a lista
 * (`pages/WorkoutHistory.tsx`) e o detalhe de uma sessão, que mora aqui.
 */

export const HISTORY_KIND_STYLE: Record<
  WorkoutHistoryKind,
  { icon: LucideIcon; color: string; tint: string; labelKey: TranslationKey }
> = {
  routine: { icon: Dumbbell, color: "#93b4ff", tint: "rgba(91,140,255,.18)", labelKey: "goals_history_kind_routine" },
  quick: { icon: Zap, color: "#ffab66", tint: "rgba(255,138,42,.18)", labelKey: "goals_history_kind_quick" },
  party: { icon: Users, color: "#c2a6ff", tint: "rgba(157,107,255,.2)", labelKey: "goals_history_kind_party" },
  challenge: { icon: Swords, color: "#ff8ea1", tint: "rgba(244,63,94,.18)", labelKey: "goals_history_kind_challenge" },
};

export function historyLocale(language: string): string {
  return language === "en" ? "en-US" : "pt-BR";
}

function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Hoje, 07:40" · "Ontem, 18:10" · "sáb., 3 de out., 18:10". */
export function formatHistoryDate(iso: string, language: string, t: T): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const locale = historyLocale(language);
  const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameLocalDay(d, now)) return `${t("goals_history_today")}, ${time}`;
  if (sameLocalDay(d, yesterday)) return `${t("goals_history_yesterday")}, ${time}`;
  const day = d.toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
  return `${day}, ${time}`;
}

export function formatHistoryNumber(n: number, language: string): string {
  return new Intl.NumberFormat(historyLocale(language), { maximumFractionDigits: 1 }).format(n);
}

function isExpired(link: WorkoutHistoryChallengeLink): boolean {
  const c = link.challenge;
  if (c.status === "completed" || c.status === "declined") return false;
  const exp = new Date(c.expiresAt).getTime();
  return Number.isFinite(exp) && exp < Date.now();
}

function opponentOf(link: WorkoutHistoryChallengeLink) {
  const c = link.challenge;
  return link.side === "challenger"
    ? { id: c.challengedId, nickname: c.challengedNickname, photo: c.challengedPhoto }
    : { id: c.challengerId, nickname: c.challengerNickname, photo: c.challengerPhoto };
}

/** "de Ana" (recebi) · "para Rafa" · "para Rafa +2" (enviei para vários). */
export function challengeSubtitle(links: WorkoutHistoryChallengeLink[], t: T): string {
  const first = links[0];
  if (!first) return "";
  const name = opponentOf(first).nickname;
  if (first.side === "challenged") return t("goals_history_challenge_from").replace("{name}", name);
  if (links.length > 1) {
    return t("goals_history_challenge_to_more").replace("{name}", name).replace("{n}", String(links.length - 1));
  }
  return t("goals_history_challenge_to").replace("{name}", name);
}

export type ChallengeBadge = { label: string; tone: "won" | "lost" | "tie" | "neutral" | "pending" };

/** Selo do lado direito da linha — sempre do MEU ponto de vista. */
export function challengeBadge(links: WorkoutHistoryChallengeLink[], t: T): ChallengeBadge | null {
  if (links.length === 0) return null;
  if (links.length > 1) {
    return { label: t("goals_history_badge_many").replace("{n}", String(links.length)), tone: "neutral" };
  }
  const link = links[0];
  const c = link.challenge;
  if (c.status === "completed" && c.winner) {
    const mine = (link.side === "challenger" ? c.challengerScore : c.challengedScore) ?? 0;
    const theirs = (link.side === "challenger" ? c.challengedScore : c.challengerScore) ?? 0;
    const key =
      c.winner === "tie" ? "goals_history_badge_tie" : c.winner === link.side ? "goals_history_badge_won" : "goals_history_badge_lost";
    const tone = c.winner === "tie" ? "tie" : c.winner === link.side ? "won" : "lost";
    return { label: t(key).replace("{a}", String(mine)).replace("{b}", String(theirs)), tone };
  }
  if (c.status === "declined") return { label: t("goals_history_badge_declined"), tone: "neutral" };
  if (isExpired(link)) return { label: t("goals_history_badge_expired"), tone: "neutral" };
  return { label: t("goals_history_badge_pending"), tone: "pending" };
}

export const BADGE_TONE_STYLE: Record<ChallengeBadge["tone"], React.CSSProperties> = {
  won: { background: "rgba(52,211,153,.16)", color: "#6ee7b7" },
  lost: { background: "rgba(248,113,113,.14)", color: "#fca5a5" },
  tie: { background: "rgba(251,191,36,.14)", color: "#fcd34d" },
  neutral: { background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.75)" },
  pending: { background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.7)", border: "1px dashed rgba(255,255,255,.22)" },
};

export function countLabel(n: number, oneKey: TranslationKey, manyKey: TranslationKey, t: T): string {
  return n === 1 ? t(oneKey) : t(manyKey).replace("{n}", String(n));
}

const CARD_STYLE: React.CSSProperties = {
  borderRadius: 20,
  background: "linear-gradient(rgba(255,255,255,.07),rgba(255,255,255,.025))",
  border: "1px solid rgba(255,255,255,.09)",
};

/** "80×8 · 80×8 · 75×7" (musculação) ou "5,2 km · 30min" (cardio). */
function exerciseDetail(ex: WorkoutHistoryExercise, language: string): string {
  if (ex.isCardio) {
    const { minutes, km } = sumCardioSets(ex.sets);
    return [km > 0 ? `${formatCardioKm(km)} km` : null, minutes > 0 ? formatCardioMinutes(minutes) : null]
      .filter(Boolean)
      .join(" · ");
  }
  return ex.sets
    .map((s) => (s.kg > 0 ? `${formatHistoryNumber(s.kg, language)}×${s.reps || 0}` : `${s.reps || 0}`))
    .join(" · ");
}

function ChallengeBlock({ link, onSharedToFeed }: { link: WorkoutHistoryChallengeLink; onSharedToFeed: () => void }) {
  const { t } = useLanguage();
  const c = link.challenge;
  const opponent = opponentOf(link);
  const completed = c.status === "completed";
  const [outcome, setOutcome] = React.useState<ChallengeOutcome | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [sharing, setSharing] = React.useState(false);

  React.useEffect(() => {
    if (!completed) return;
    let cancelled = false;
    getWorkoutChallengeResultsDb(c)
      .then((results) => {
        if (cancelled) return;
        if (!results.challenger || !results.challenged) {
          setFailed(true);
          return;
        }
        setOutcome(compareChallenge(c.snapshot, results.challenger, results.challenged));
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [c, completed]);

  const handleShare = async () => {
    if (!outcome || sharing) return;
    setSharing(true);
    try {
      await shareChallengeResultToFeed(c, outcome, t);
      toast({ title: t("goals_challenge_shared_toast"), description: t("goals_challenge_shared_desc") });
      onSharedToFeed();
    } catch (err: any) {
      reportHandledError(err, "workout-history:share-challenge");
      toast({ title: t("goals_challenge_share_error"), description: err?.message, variant: "destructive" });
      setSharing(false);
    }
  };

  const statusText = !completed
    ? (c.status === "declined"
        ? t("goals_history_challenge_declined_desc")
        : isExpired(link)
          ? t("goals_history_challenge_expired_desc")
          : t("goals_history_challenge_pending_desc")
      ).replace("{name}", opponent.nickname)
    : null;

  return (
    <div className="p-3.5" style={CARD_STYLE}>
      <div className="flex items-center gap-3 mb-3">
        <UserAvatar photo={opponent.photo} nickname={opponent.nickname} size="md" />
        <p className="flex-1 min-w-0 truncate text-[14.5px] font-semibold text-white">
          {t("goals_history_kind_challenge")} {challengeSubtitle([link], t)}
        </p>
      </div>
      {statusText ? (
        <p className="text-[13px] text-white/60 leading-snug">{statusText}</p>
      ) : outcome ? (
        <>
          <ChallengeComparison outcome={outcome} perspective={link.side} opponentName={opponent.nickname} />
          {link.side === "challenger" && (
            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              className="mt-3 w-full h-11 rounded-full flex items-center justify-center gap-2 text-[14px] font-semibold text-white active:scale-[0.985] transition-transform disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)" }}
            >
              <Share2 className="h-4 w-4" />
              {sharing ? t("goals_challenge_sharing") : t("goals_challenge_share_cta")}
            </button>
          )}
        </>
      ) : (
        <div className="flex justify-center py-4">
          {failed ? (
            <p className="text-[13px] text-white/55">{t("goals_history_challenge_unavailable")}</p>
          ) : (
            <LoadingSpinner className="h-6 w-6" />
          )}
        </div>
      )}
    </div>
  );
}

function PartyBlock({ session }: { session: WorkoutHistorySession }) {
  const { t, language } = useLanguage();
  const party = session.party!;
  const [members, setMembers] = React.useState<WorkoutPartyMember[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getWorkoutPartyMembersDb(party.partyId)
      .then((list) => { if (!cancelled) setMembers(list.filter((m) => m.status === "accepted" || m.status === "left")); })
      .catch(() => { if (!cancelled) setMembers([]); });
    return () => { cancelled = true; };
  }, [party.partyId]);

  // Sem as estatísticas ao vivo (banco sem a migração live-stats ou leitura
  // falhou), a lista sai só com os nomes que o histórico já trouxe.
  // Eu = o membro que não está em `others`; vou primeiro, como "Você".
  const otherIds = new Set(party.others.map((o) => o.userId));
  const isMe = (m: WorkoutPartyMember) => !otherIds.has(m.userId);
  const rows =
    members && members.length > 0
      ? [...members].sort((a, b) => Number(isMe(b)) - Number(isMe(a)))
      : null;

  return (
    <div className="space-y-2">
      <h2 className="text-[15px] font-bold text-white">{t("goals_history_people_title")}</h2>
      <div className="overflow-hidden" style={CARD_STYLE}>
        {rows === null && members === null ? (
          <div className="flex justify-center py-5"><LoadingSpinner className="h-6 w-6" /></div>
        ) : rows ? (
          rows.map((m) => (
            <div key={m.userId} className="flex items-center gap-3 px-3.5 py-2.5 border-b border-white/[0.06] last:border-b-0">
              <UserAvatar photo={m.photo} nickname={m.nickname} size="md" />
              <div className="flex-1 min-w-0">
                <p className="truncate text-[14.5px] font-semibold text-white">{isMe(m) ? t("goals_challenge_you") : m.nickname}</p>
                {m.setsDone > 0 && (
                  <p className="text-[12.5px] text-white/60">
                    {t("goals_history_party_stats")
                      .replace("{sets}", String(m.setsDone))
                      .replace("{kg}", formatHistoryNumber(Math.round(m.volumeKg), language))}
                  </p>
                )}
              </div>
              {m.bestKg > 0 && (
                <div className="text-right shrink-0">
                  <p className="text-[14px] font-bold text-white tabular-nums">{formatHistoryNumber(m.bestKg, language)} kg</p>
                  <p className="text-[11px] text-white/55">{t("goals_history_best_load")}</p>
                </div>
              )}
            </div>
          ))
        ) : (
          party.others.map((o) => (
            <div key={o.userId} className="flex items-center gap-3 px-3.5 py-2.5 border-b border-white/[0.06] last:border-b-0">
              <UserAvatar photo={o.photo} nickname={o.nickname} size="md" />
              <p className="flex-1 min-w-0 truncate text-[14.5px] font-semibold text-white">{o.nickname}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Detalhe de uma sessão do histórico — ocupa a página inteira no lugar da lista
 * (`/metas/historico?s=<key>`), então o gesto de voltar fecha o detalhe.
 */
export function WorkoutHistoryDetail({
  session,
  onBack,
  onSharedToFeed,
}: {
  session: WorkoutHistorySession;
  onBack: () => void;
  onSharedToFeed: () => void;
}) {
  const { t, language } = useLanguage();
  const style = HISTORY_KIND_STYLE[session.kind];
  const Icon = style.icon;

  const stats: Array<{ value: string; label: string }> = [
    { value: String(session.totalSeries), label: t("goals_history_stat_sets") },
    ...(session.volumeKg > 0
      ? [{ value: formatHistoryNumber(session.volumeKg, language), label: t("goals_history_stat_volume") }]
      : []),
    ...(session.caloriesKcal != null && session.caloriesKcal > 0
      ? [{ value: formatHistoryNumber(Math.round(session.caloriesKcal), language), label: t("goals_history_stat_kcal") }]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("goals_back")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white active:scale-90 transition-transform"
          style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)" }}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-wider" style={{ color: style.color }}>
          <Icon className="h-4 w-4" strokeWidth={2.2} />
          {t(style.labelKey)}
        </span>
      </div>

      <div>
        <h1 className="text-[24px] font-extrabold text-white leading-tight">{session.title}</h1>
        <p className="mt-1 text-[13px] text-white/60">
          {formatHistoryDate(session.completedAt, language, t)}
          {session.kind === "party" && session.party && session.party.others.length > 0 && (
            <> · {t("goals_history_with").replace("{names}", session.party.others.map((o) => o.nickname).join(", "))}</>
          )}
        </p>
      </div>

      <div
        className="grid gap-1.5 px-2 py-3 text-center"
        style={{ ...CARD_STYLE, gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
      >
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-[17px] font-extrabold text-white tabular-nums">{s.value}</p>
            <p className="text-[11.5px] text-white/60">{s.label}</p>
          </div>
        ))}
      </div>

      {session.challenges.map((link) => (
        <ChallengeBlock key={link.challenge.id} link={link} onSharedToFeed={onSharedToFeed} />
      ))}

      {session.kind === "party" && session.party && <PartyBlock session={session} />}

      <div className="space-y-2">
        <h2 className="text-[15px] font-bold text-white">{t("goals_history_exercises_title")}</h2>
        <div className="space-y-1.5">
          {session.exercises.map((ex) => (
            <div
              key={ex.workoutId}
              className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
              style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)" }}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] text-[13px] font-bold tabular-nums"
                style={{ background: style.tint, color: style.color }}
              >
                {ex.seriesCount}×
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-white">{ex.name}</p>
                <p className="truncate text-[12px] text-white/60 tabular-nums">{exerciseDetail(ex, language)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
