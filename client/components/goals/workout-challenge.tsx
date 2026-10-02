import * as React from "react";
import { Swords, Trophy, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useLanguage } from "@/lib/language-context";
import {
  getWorkoutChallengeResultsDb,
  type WorkoutChallenge,
} from "@/lib/ritmofit-db";
import {
  compareChallenge,
  type ChallengeOutcome,
  type ChallengeSide,
  type WorkoutChallengeResultExercise,
} from "@/lib/workout-challenge";

/**
 * Desafio de treino (2026-10-02) — telas.
 *
 *  - `ChallengeInviteDialog`: o desafiado vê QUEM desafiou e QUAIS exercícios,
 *    com o nº de séries — nunca carga nem repetições (a RLS nem entrega).
 *  - `ChallengeComparison`: o placar exercício a exercício. Mesmo componente no
 *    resumo do desafiado e na tela de resultado de quem desafiou.
 *  - `ChallengeResultDialog`: o resultado para QUEM DESAFIOU (toque no push 25).
 */

/** Casca de modal centrado — mesma do convite de "treinar junto". */
function ChallengeModalShell({ onDismiss, dismissLabel, children }: {
  onDismiss: () => void;
  dismissLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div
      // Acima da sessão de treino (9999) e do resumo (9500), como o convite de treino.
      className="fixed inset-0 z-[10001] flex items-center justify-center pointer-events-none"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      <div className="absolute inset-0 bg-black/60 pointer-events-auto" onClick={onDismiss} />
      <div
        className="pointer-events-auto relative w-full max-w-[380px] max-h-full overflow-y-auto rounded-[28px] p-5"
        style={{
          background: "linear-gradient(rgba(34,32,46,.97),rgba(16,15,22,.99))",
          border: "1px solid rgba(255,255,255,.12)",
          boxShadow: "0 24px 60px rgba(0,0,0,.55)",
        }}
      >
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          className="absolute right-3 top-3 h-8 w-8 rounded-full flex items-center justify-center text-white/60 active:opacity-70"
          style={{ background: "rgba(255,255,255,.08)" }}
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

export function ChallengeInviteDialog({
  challenge,
  busyWithOtherWorkout,
  onAccept,
  onDecline,
  onDismiss,
}: {
  challenge: WorkoutChallenge;
  /** Já tem treino em andamento → não dá para aceitar agora (sobrescreveria). */
  busyWithOtherWorkout: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onDismiss: () => void;
}) {
  const { t } = useLanguage();
  const [responding, setResponding] = React.useState(false);
  const items = challenge.snapshot.items;
  const preview = items.slice(0, 6);
  const rest = items.length - preview.length;

  const respond = (accept: boolean) => {
    if (responding) return;
    setResponding(true);
    if (accept) onAccept();
    else onDecline();
  };

  return (
    <ChallengeModalShell onDismiss={onDismiss} dismissLabel={t("goals_challenge_later")}>
      <div className="flex flex-col items-center text-center gap-2 pt-1">
        <div className="relative">
          <UserAvatar photo={challenge.challengerPhoto} nickname={challenge.challengerNickname} size="xl" />
          <span
            className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full flex items-center justify-center"
            style={{ background: "#ef4444", border: "3px solid #16151e" }}
          >
            <Swords className="h-4 w-4 text-white" />
          </span>
        </div>
        <p className="text-[17px] font-semibold text-white leading-tight px-4">
          {t("goals_challenge_invite_title").replace("{name}", challenge.challengerNickname)}
        </p>
      </div>

      <div
        className="mt-4 rounded-2xl p-3"
        style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}
      >
        <p className="text-[13px] font-semibold text-white mb-2">
          {challenge.routineName || t("goals_rt_exercises")}
        </p>
        <ul className="space-y-1">
          {preview.map((item) => (
            <li key={item.workoutId} className="flex items-baseline justify-between gap-2 text-[13px] text-white/75">
              <span className="truncate">{item.name}</span>
              <span className="text-white/40 shrink-0 text-[12px]">
                {t("goals_challenge_sets").replace("{n}", String(item.series))}
              </span>
            </li>
          ))}
        </ul>
        {rest > 0 && (
          <p className="text-[12px] text-white/45 mt-1.5">
            {t("goals_party_incoming_more").replace("{n}", String(rest))}
          </p>
        )}
      </div>

      {busyWithOtherWorkout ? (
        <p className="mt-4 text-[12.5px] text-amber-300/90 text-center leading-snug">
          {t("goals_challenge_busy")}
        </p>
      ) : (
        <p className="mt-3 text-[12px] text-white/50 text-center leading-snug">
          🔒 {t("goals_challenge_hidden_hint").replace("{name}", challenge.challengerNickname)}
        </p>
      )}

      <div className="mt-4 space-y-2">
        {!busyWithOtherWorkout && (
          <Button
            className="w-full rounded-full h-12 font-semibold active:scale-[0.985]"
            style={{ background: "linear-gradient(135deg,#ef4444,#f97316)", color: "#fff" }}
            disabled={responding}
            onClick={() => respond(true)}
          >
            ⚔️ {t("goals_challenge_accept")}
          </Button>
        )}
        <button
          type="button"
          onClick={() => respond(false)}
          disabled={responding}
          className="w-full h-11 rounded-full text-[14px] font-medium text-white/60 active:opacity-70"
          style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}
        >
          {t("goals_challenge_decline")}
        </button>
      </div>
    </ChallengeModalShell>
  );
}

function sideValue(
  ex: WorkoutChallengeResultExercise | null,
  t: (k: any) => string,
): string {
  if (!ex) return "—";
  if (ex.isCardio) return `${ex.km} km`;
  if (ex.bestKg > 0) return t("goals_challenge_value").replace("{kg}", String(ex.bestKg)).replace("{reps}", String(ex.reps));
  return t("goals_challenge_value_reps").replace("{reps}", String(ex.reps));
}

/**
 * Placar do desafio, do ponto de vista de `perspective` ("eu" = esse lado).
 * Carga + repetições de cada um por exercício, com o vencedor destacado.
 */
export function ChallengeComparison({
  outcome,
  perspective,
  opponentName,
}: {
  outcome: ChallengeOutcome;
  perspective: ChallengeSide;
  opponentName: string;
}) {
  const { t } = useLanguage();
  const other: ChallengeSide = perspective === "challenger" ? "challenged" : "challenger";
  const myScore = perspective === "challenger" ? outcome.challengerScore : outcome.challengedScore;
  const theirScore = perspective === "challenger" ? outcome.challengedScore : outcome.challengerScore;
  const headline =
    outcome.winner === "tie"
      ? t("goals_challenge_result_tie")
      : outcome.winner === perspective
        ? t("goals_challenge_result_won")
        : t("goals_challenge_result_lost");
  const headlineColor = outcome.winner === "tie" ? "#fbbf24" : outcome.winner === perspective ? "#34d399" : "#f87171";

  return (
    <div>
      <div className="text-center">
        <div className="text-[22px] font-extrabold" style={{ color: headlineColor }}>
          {outcome.winner === perspective ? "🏆 " : outcome.winner === "tie" ? "🤝 " : ""}{headline}
        </div>
        <div className="mt-1 flex items-center justify-center gap-3 text-white">
          <span className="text-[13px] text-white/60">{t("goals_challenge_you")}</span>
          <span className="text-[26px] font-black tabular-nums">{myScore} × {theirScore}</span>
          <span className="text-[13px] text-white/60 max-w-[110px] truncate">{opponentName}</span>
        </div>
      </div>

      <div className="mt-3 grid text-[10.5px] font-bold uppercase tracking-wide text-white/45" style={{ gridTemplateColumns: "minmax(0,1fr) 92px 92px" }}>
        <span>{t("goals_challenge_col_exercise")}</span>
        <span className="text-center">{t("goals_challenge_you")}</span>
        <span className="text-center truncate">{opponentName}</span>
      </div>
      <div className="mt-1 space-y-1">
        {outcome.rows.map((row) => {
          const mine = row[perspective];
          const theirs = row[other];
          const iWon = row.winner === perspective;
          const theyWon = row.winner === other;
          return (
            <div
              key={row.workoutId}
              className="grid items-center rounded-xl px-2 py-1.5"
              style={{ gridTemplateColumns: "minmax(0,1fr) 92px 92px", background: "rgba(255,255,255,.04)" }}
            >
              <span className="truncate text-[12.5px] text-white/85 pr-1">{row.name}</span>
              <span
                className="text-center text-[12px] tabular-nums rounded-lg py-0.5"
                style={{ color: iWon ? "#34d399" : "rgba(255,255,255,.7)", background: iWon ? "rgba(52,211,153,.12)" : "transparent", fontWeight: iWon ? 800 : 500 }}
              >
                {iWon && <Trophy className="inline h-3 w-3 mr-0.5 -mt-0.5" />}
                {sideValue(mine, t)}
              </span>
              <span
                className="text-center text-[12px] tabular-nums rounded-lg py-0.5"
                style={{ color: theyWon ? "#f87171" : "rgba(255,255,255,.7)", background: theyWon ? "rgba(248,113,113,.12)" : "transparent", fontWeight: theyWon ? 800 : 500 }}
              >
                {theyWon && <Trophy className="inline h-3 w-3 mr-0.5 -mt-0.5" />}
                {sideValue(theirs, t)}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-white/40 text-center leading-snug">
        {t("goals_challenge_rule_hint")}
      </p>
    </div>
  );
}

/** Resultado para QUEM DESAFIOU — aberto pelo push/notificação type 25. */
export function ChallengeResultDialog({
  challenge,
  onClose,
}: {
  challenge: WorkoutChallenge;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [outcome, setOutcome] = React.useState<ChallengeOutcome | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    getWorkoutChallengeResultsDb(challenge)
      .then((results) => {
        if (cancelled) return;
        if (!results.challenger || !results.challenged) {
          setFailed(true);
          return;
        }
        setOutcome(compareChallenge(challenge.snapshot, results.challenger, results.challenged));
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [challenge]);

  return (
    <ChallengeModalShell onDismiss={onClose} dismissLabel={t("goals_challenge_close")}>
      <div className="flex flex-col items-center text-center gap-2 pt-1 mb-3">
        <UserAvatar photo={challenge.challengedPhoto} nickname={challenge.challengedNickname} size="lg" />
        <p className="text-[15px] font-semibold text-white leading-tight px-4">
          {t("goals_challenge_result_title")
            .replace("{name}", challenge.challengedNickname)
            .replace("{routine}", challenge.routineName)}
        </p>
      </div>
      {outcome ? (
        <ChallengeComparison outcome={outcome} perspective="challenger" opponentName={challenge.challengedNickname} />
      ) : (
        <p className="py-6 text-center text-[13px] text-white/55">
          {failed ? t("goals_challenge_result_pending") : t("goals_challenge_loading")}
        </p>
      )}
    </ChallengeModalShell>
  );
}
