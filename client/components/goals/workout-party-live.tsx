import * as React from "react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { useLanguage } from "@/lib/language-context";
import type { TranslationKey } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { getWorkoutPartyMembersDb, type WorkoutPartyMember } from "@/lib/ritmofit-db";

/**
 * Treinar junto ao vivo (2026-10-02): de quem é a VEZ.
 *
 * Cada participante publica, a cada série concluída, até quando vai o
 * descanso dele (`rest_ends_at`) e qual exercício fez (`current_exercise`) —
 * ver `updateWorkoutPartyLiveDb`. Daqui sai o estado de cada amigo:
 *
 *  - descanso no futuro → **descansando** (com a contagem);
 *  - sem descanso em curso → **é a vez dele** ("fazendo Supino");
 *  - `finished_at` → **terminou**;
 *  - nenhuma série ainda → **se preparando**.
 *
 * O relógio é o de cada aparelho: uma diferença de poucos segundos entre os
 * dois celulares só adianta/atrasa a contagem, nunca troca de quem é a vez.
 */

export type PartnerTurn =
  | { kind: "resting"; secsLeft: number }
  | { kind: "lifting"; exercise: string | null }
  | { kind: "finished" }
  | { kind: "starting" };

export function partnerTurn(member: WorkoutPartyMember, nowMs: number): PartnerTurn {
  if (member.finishedAt || member.status === "left") return { kind: "finished" };
  const restEnd = member.restEndsAt ? Date.parse(member.restEndsAt) : NaN;
  if (Number.isFinite(restEnd) && restEnd > nowMs) {
    return { kind: "resting", secsLeft: Math.ceil((restEnd - nowMs) / 1000) };
  }
  if (!member.lastSetAt) return { kind: "starting" };
  return { kind: "lifting", exercise: member.currentExercise };
}

/**
 * Participantes da party com realtime — fonte ÚNICA da sessão (a faixa do topo,
 * o modal e a barra de descanso leem daqui; antes a faixa tinha a própria
 * assinatura). Nome de canal único por montagem — reaproveitar o nome deixa a
 * segunda assinatura morta em silêncio quando a tela remonta (padrão de
 * Notifications.tsx).
 */
export function useWorkoutPartyMembers(partyId: string | null) {
  const [members, setMembers] = React.useState<WorkoutPartyMember[]>([]);

  const reload = React.useCallback(() => {
    if (!partyId) {
      setMembers([]);
      return;
    }
    getWorkoutPartyMembersDb(partyId, { fresh: true })
      .then(setMembers)
      .catch(() => { /* informativo: falhar aqui não atrapalha o treino */ });
  }, [partyId]);

  React.useEffect(() => { reload(); }, [reload]);

  React.useEffect(() => {
    if (!partyId || !supabase) return;
    const channel = supabase
      .channel(`workout-party-${partyId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workout_party_members", filter: `party_id=eq.${partyId}` },
        () => reload(),
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [partyId, reload]);

  return { members, reload };
}

/** Agora, re-renderizando a cada segundo só enquanto `active` (contagem visível). */
export function useNow(active: boolean): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export function fmtSecs(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Cor de cada estado — anel do avatar, ponto e texto (pílula, folha e descanso). */
export const TURN_COLORS = {
  lifting: "#34d399",
  resting: "#93b4ff",
  finished: "rgba(255,255,255,.45)",
  starting: "#fbbf24",
} as const;

/** Fundo e borda translúcidos de cada estado (sem `color-mix`: o WebView do iOS 15 não tem). */
export const TURN_TINTS = {
  lifting: { bg: "rgba(52,211,153,.12)", border: "rgba(52,211,153,.40)" },
  resting: { bg: "rgba(147,180,255,.12)", border: "rgba(147,180,255,.40)" },
  finished: { bg: "rgba(255,255,255,.05)", border: "rgba(255,255,255,.14)" },
  starting: { bg: "rgba(251,191,36,.10)", border: "rgba(251,191,36,.38)" },
} as const;

/** Está descansando AGORA (descanso publicado no futuro)? */
export function isRestingNow(member: WorkoutPartyMember, nowMs = Date.now()): boolean {
  const end = member.restEndsAt ? Date.parse(member.restEndsAt) : NaN;
  return Number.isFinite(end) && end > nowMs;
}

/** Texto do estado de um amigo: "Vez de Ana · fazendo Supino", "Ana descansando · 0:42"… */
export function turnText(
  name: string,
  turn: PartnerTurn,
  t: (key: TranslationKey) => string,
): string {
  switch (turn.kind) {
    case "resting":
      return t("goals_party_turn_resting").replace("{name}", name).replace("{time}", fmtSecs(turn.secsLeft));
    case "lifting":
      return turn.exercise
        ? `${t("goals_party_turn_their").replace("{name}", name)} · ${t("goals_party_turn_doing").replace("{exercise}", turn.exercise)}`
        : t("goals_party_turn_their").replace("{name}", name);
    case "finished":
      return t("goals_party_turn_finished").replace("{name}", name);
    default:
      return t("goals_party_turn_starting").replace("{name}", name);
  }
}

/**
 * De quem é a vez, enquanto EU descanso — uma linha por amigo, com avatar, no
 * modal de descanso ("Vez de Ana · fazendo Supino" / "Ana descansando 0:42").
 * Fora do descanso, a vez mora na pílula do topo da sessão
 * (`WorkoutSessionContextPill`), que é o único outro lugar onde ela aparece.
 *
 * Componente pequeno de propósito: é o único que re-renderiza a cada segundo
 * (a contagem do descanso do amigo) — o diálogo de treino nunca re-renderiza
 * por causa do relógio (ver "Relógio do treino fora do contexto").
 */
export function PartyTurnStatus({ partners }: { partners: WorkoutPartyMember[] }) {
  const { t } = useLanguage();
  const now = useNow(partners.some((m) => isRestingNow(m)));
  if (partners.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
      {partners.slice(0, 3).map((member) => {
        const turn = partnerTurn(member, now);
        const color = TURN_COLORS[turn.kind];
        return (
          <div
            key={member.userId}
            style={{
              display: "flex", alignItems: "center", gap: 8, minWidth: 0,
              padding: "8px 10px", borderRadius: 12,
              background: TURN_TINTS[turn.kind].bg,
              border: `1px solid ${TURN_TINTS[turn.kind].border}`,
            }}
          >
            <UserAvatar photo={member.photo} nickname={member.nickname} size="sm" className="h-7 w-7 shrink-0" />
            <span style={{
              fontSize: 13, fontWeight: 700, color,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0,
            }}>
              {turnText(member.nickname, turn, t)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
