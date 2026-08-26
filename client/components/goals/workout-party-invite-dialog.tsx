import * as React from "react";
import { Dumbbell, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useLanguage } from "@/lib/language-context";
import type { WorkoutPartyInvite } from "@/lib/ritmofit-db";

interface WorkoutPartyInviteDialogProps {
  invite: WorkoutPartyInvite | null;
  /**
   * O usuário já tem um treino em andamento. O convite continua visível (ele
   * precisa saber que foi chamado), mas aceitar sobrescreveria a sessão dele —
   * então só resta recusar.
   */
  busyWithOtherWorkout?: boolean;
  onAccept: () => void;
  onDecline: () => void;
  /** Fechar sem responder — o convite continua pendente até expirar. */
  onDismiss: () => void;
}

/** Quantos exercícios aparecem antes do "+N". */
const PREVIEW_COUNT = 3;

/**
 * Convite recebido de "treinar junto". Aparece por cima de qualquer tela (é
 * montado no `AppLayout`) porque o convite é para AGORA — enfiá-lo só na aba de
 * notificações seria o mesmo que não avisar.
 *
 * Overlay próprio (não Radix Dialog) para poder conviver com o resumo de treino
 * e os diálogos de insígnia sem disputa de stacking context.
 */
export function WorkoutPartyInviteDialog({
  invite,
  busyWithOtherWorkout = false,
  onAccept,
  onDecline,
  onDismiss,
}: WorkoutPartyInviteDialogProps) {
  const { t } = useLanguage();
  const [responding, setResponding] = React.useState(false);

  React.useEffect(() => {
    if (invite) setResponding(false);
  }, [invite]);

  if (!invite) return null;

  const items = invite.snapshot?.items ?? [];
  const preview = items.slice(0, PREVIEW_COUNT);
  const rest = Math.max(0, items.length - preview.length);

  const respond = (accept: boolean) => {
    if (responding) return;
    setResponding(true);
    if (accept) onAccept();
    else onDecline();
  };

  return (
    <div
      // Acima de TUDO: o convite tem de aparecer mesmo por cima da sessão de
      // treino (`zIndex 9999`) e do resumo (`9500`) — é justamente quando ele
      // precisa avisar que dá para entrar (ou que não dá, no estado "já está
      // treinando"). Num z baixo ele abriria atrás dessas telas e o usuário
      // veria só o scrim comendo os toques.
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
        className="pointer-events-auto relative w-full max-w-[360px] max-h-full overflow-y-auto rounded-[28px] p-5"
        style={{
          background: "linear-gradient(rgba(34,32,46,.97),rgba(16,15,22,.99))",
          border: "1px solid rgba(255,255,255,.12)",
          boxShadow: "0 24px 60px rgba(0,0,0,.55)",
        }}
      >
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("goals_party_incoming_dismiss")}
          className="absolute right-3 top-3 h-8 w-8 rounded-full flex items-center justify-center text-white/60"
          style={{ background: "rgba(255,255,255,.08)" }}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center gap-2 pt-1">
          <UserAvatar photo={invite.hostPhoto} nickname={invite.hostNickname} size="xl" />
          <p className="text-[17px] font-semibold text-white leading-tight px-4">
            {t("goals_party_incoming_title").replace("{name}", invite.hostNickname)}
          </p>
        </div>

        <div
          className="mt-4 rounded-2xl p-3"
          style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}
        >
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-white mb-2">
            <Dumbbell className="h-3.5 w-3.5 text-white/60" />
            {invite.routineName || t("goals_rt_exercises")}
          </p>
          <ul className="space-y-1">
            {preview.map((item) => (
              <li key={item.workoutId} className="flex items-baseline gap-2 text-[13px] text-white/75">
                <span className="truncate">{item.name}</span>
                <span className="text-white/40 shrink-0 text-[12px]">
                  {item.series}×{item.reps}
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
            {t("goals_party_busy_desc").replace("{name}", invite.hostNickname)}
          </p>
        ) : (
          <p className="mt-3 text-[12px] text-white/45 text-center leading-snug">
            {t("goals_party_incoming_hint")}
          </p>
        )}

        <div className="mt-4 space-y-2">
          {!busyWithOtherWorkout && (
            <Button
              className="w-full rounded-full h-12 font-semibold"
              style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
              disabled={responding}
              onClick={() => respond(true)}
            >
              {t("goals_party_incoming_accept")}
            </Button>
          )}
          <button
            type="button"
            onClick={() => respond(false)}
            disabled={responding}
            className="w-full h-11 rounded-full text-[14px] font-medium text-white/60"
            style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}
          >
            {t("goals_party_incoming_decline")}
          </button>
        </div>
      </div>
    </div>
  );
}
