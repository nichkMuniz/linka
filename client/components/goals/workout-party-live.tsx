import * as React from "react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { useLanguage } from "@/lib/language-context";
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
function useNow(active: boolean): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function fmtSecs(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const LIFT = "#34d399";
const REST = "#93b4ff";
const MUTED = "rgba(255,255,255,.6)";

/**
 * Indicador de vez.
 *
 * - `mode="rest"` (eu estou descansando — modal e barra de descanso): destaca
 *   quem está fazendo a série AGORA ("💪 Vez da Ana · fazendo Supino").
 * - `mode="bar"` (faixa do topo, fora do descanso): uma linha por amigo, e
 *   "Sua vez!" quando o amigo está descansando.
 *
 * Componente pequeno de propósito: é o único que re-renderiza a cada segundo
 * (a contagem do descanso do amigo) — o diálogo de treino nunca re-renderiza
 * por causa do relógio (ver "Relógio do treino fora do contexto").
 */
export function PartyTurnStatus({
  partners,
  mode,
  compact = false,
}: {
  partners: WorkoutPartyMember[];
  mode: "rest" | "bar";
  /** Uma linha só (barra fina de descanso). */
  compact?: boolean;
}) {
  const { t } = useLanguage();
  const anyResting = partners.some((m) => {
    const end = m.restEndsAt ? Date.parse(m.restEndsAt) : NaN;
    return Number.isFinite(end) && end > Date.now();
  });
  const now = useNow(anyResting);
  if (partners.length === 0) return null;

  const rows = partners.map((m) => ({ member: m, turn: partnerTurn(m, now) }));

  const lineFor = ({ member, turn }: (typeof rows)[number]) => {
    const name = member.nickname;
    switch (turn.kind) {
      case "resting":
        return {
          color: REST,
          emoji: "⏸",
          text: t("goals_party_turn_resting").replace("{name}", name).replace("{time}", fmtSecs(turn.secsLeft)),
        };
      case "lifting":
        return {
          color: LIFT,
          emoji: "💪",
          text: turn.exercise
            ? `${t("goals_party_turn_their").replace("{name}", name)} · ${t("goals_party_turn_doing").replace("{exercise}", turn.exercise)}`
            : t("goals_party_turn_their").replace("{name}", name),
        };
      case "finished":
        return { color: MUTED, emoji: "✅", text: t("goals_party_turn_finished").replace("{name}", name) };
      default:
        return { color: MUTED, emoji: "⏳", text: t("goals_party_turn_starting").replace("{name}", name) };
    }
  };

  // Fora do descanso: se algum amigo está descansando, a vez é MINHA.
  const myTurn = mode === "bar" && rows.some((r) => r.turn.kind === "resting");

  if (compact) {
    // Prioridade: quem está fazendo a série agora > descansando > o resto.
    const order = { lifting: 0, resting: 1, starting: 2, finished: 3 } as const;
    const top = [...rows].sort((a, b) => order[a.turn.kind] - order[b.turn.kind])[0];
    const line = lineFor(top);
    return (
      <span style={{ fontSize: 12, fontWeight: 700, color: line.color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {myTurn && <span style={{ color: LIFT }}>🔥 {t("goals_party_turn_yours")} · </span>}
        {line.emoji} {line.text}
        {rows.length > 1 ? ` +${rows.length - 1}` : ""}
      </span>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
      {myTurn && (
        <div style={{ fontSize: 13, fontWeight: 800, color: LIFT }}>
          🔥 {t("goals_party_turn_yours")}
        </div>
      )}
      {rows.slice(0, 3).map((row) => {
        const line = lineFor(row);
        return (
          <div
            key={row.member.userId}
            style={{
              display: "flex", alignItems: "center", gap: 8, minWidth: 0,
              padding: mode === "rest" ? "8px 10px" : 0,
              borderRadius: 12,
              background: mode === "rest" ? `${line.color}1f` : "transparent",
              border: mode === "rest" ? `1px solid ${line.color}55` : "none",
            }}
          >
            {mode === "rest" && (
              <UserAvatar photo={row.member.photo} nickname={row.member.nickname} size="sm" className="h-7 w-7 shrink-0" />
            )}
            <span style={{
              fontSize: mode === "rest" ? 13 : 12, fontWeight: 700, color: line.color,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0,
            }}>
              {line.emoji} {line.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
