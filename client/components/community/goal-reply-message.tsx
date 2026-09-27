import * as React from "react";
import { Target } from "lucide-react";
import { getUserGoalByIdDb, type UserGoal } from "@/lib/ritmofit-db";
import { useLanguage } from "@/lib/language-context";

interface GoalReplyMessageProps {
  goalId: string;
  /** Texto digitado na resposta (já sem o prefixo do protocolo). */
  text: string;
  /** A bolha é do próprio usuário? Muda o rótulo ("você respondeu" x "respondeu à sua"). */
  isOwn: boolean;
}

/**
 * Memo de sessão por id de meta — responder a mesma meta várias vezes não
 * repete a consulta para pintar o mesmo card.
 */
const goalPreviewCache = new Map<string, Promise<UserGoal | null>>();

function fetchGoalCached(goalId: string) {
  const hit = goalPreviewCache.get(goalId);
  if (hit) return hit;
  const promise = getUserGoalByIdDb(goalId).catch((err) => {
    goalPreviewCache.delete(goalId);
    throw err;
  });
  goalPreviewCache.set(goalId, promise);
  return promise;
}

/**
 * Bolha de **resposta privada a uma meta** (mensagens `[goalreply]:<id>|<texto>`).
 * Card da meta (🎯 descrição + progresso) com o rótulo de contexto acima e o
 * texto abaixo. O **texto é sempre renderizado**, mesmo se a meta foi apagada
 * ou ficou privada — a resposta é uma mensagem e não some com ela.
 */
export function GoalReplyMessage({ goalId, text, isOwn }: GoalReplyMessageProps) {
  const { t } = useLanguage();
  const [goal, setGoal] = React.useState<UserGoal | null | undefined>(undefined);

  React.useEffect(() => {
    let cancelled = false;
    setGoal(undefined);
    fetchGoalCached(goalId)
      .then((g) => { if (!cancelled) setGoal(g); })
      .catch(() => { if (!cancelled) setGoal(null); });
    return () => { cancelled = true; };
  }, [goalId]);

  const perc = Math.max(0, Math.min(100, Math.round(goal?.perc ?? 0)));

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,.6)" }}>
        {isOwn ? t("community_goal_reply_outgoing") : t("community_goal_reply_incoming")}
      </p>

      <div
        className="rounded-xl px-3 py-2.5 min-w-[180px]"
        style={{ background: "rgba(0,0,0,.22)", border: "1px solid rgba(255,255,255,.14)" }}
      >
        {goal === undefined ? (
          <div className="h-9 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,.12)" }} />
        ) : goal === null ? (
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 shrink-0" style={{ color: "rgba(255,255,255,.4)" }} />
            <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
              {t("community_goal_reply_unavailable")}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 shrink-0" style={{ color: "#9db8ff" }} />
              <p className="text-[13px] font-semibold leading-snug line-clamp-2">{goal.description}</p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.12)" }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(3, perc)}%`, background: perc >= 100 ? "#22c55e" : "#9db8ff" }}
                />
              </div>
              <span className="text-[10.5px] font-bold" style={{ color: "rgba(255,255,255,.7)" }}>{perc}%</span>
            </div>
          </>
        )}
      </div>

      {text.trim() && <p className="text-sm">{text}</p>}
    </div>
  );
}
