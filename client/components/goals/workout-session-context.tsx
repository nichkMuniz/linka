import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Flame, Lock, Swords, Users } from "lucide-react";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useLanguage } from "@/lib/language-context";
import { GLASS_SHEET_PROPS, GLASS_SHEET_STYLE } from "@/lib/glass-styles";
import { hapticMedium } from "@/lib/haptics";
import type { WorkoutPartyMember } from "@/lib/ritmofit-db";
import type { ActiveWorkoutChallenge } from "@/lib/workout-context";
import {
  TURN_COLORS,
  TURN_TINTS,
  fmtSecs,
  isRestingNow,
  partnerTurn,
  turnText,
  useNow,
  type PartnerTurn,
} from "@/components/goals/workout-party-live";

/**
 * Contexto social da sessão de treino (02/10/2026) — **uma pílula** embaixo do
 * título, no lugar das faixas que empilhavam no topo (treinar junto + desafio).
 *
 * A pílula diz só o que importa AGORA:
 *  - desafio → "Desafio de Ana 🔒";
 *  - treinar junto → "Sua vez! · Ana descansando 0:42" (o amigo descansa e eu
 *    não), "Vez de Ana · fazendo Supino", "Esperando Ana aceitar"…
 *
 * O toque abre a folha com tudo (cada pessoa, o que está fazendo e quanto
 * falta; ou as regras e os exercícios do desafio). Assim a sessão não ganha
 * linha fixa nova e a "vez" aparece num lugar só fora do descanso (no descanso,
 * o modal de descanso também mostra — é para onde a pessoa está olhando).
 *
 * Re-renderiza a cada segundo só enquanto alguém descansa (a contagem), sem
 * tocar no diálogo de treino.
 */

type Tone = "challenge" | "yours" | "lifting" | "resting" | "finished" | "together" | "waiting";

const TONE_STYLE: Record<Tone, { bg: string; border: string; fg: string }> = {
  challenge: { bg: "rgba(244,63,94,.14)", border: "rgba(244,63,94,.45)", fg: "#fda4af" },
  yours: { bg: "#34d399", border: "#34d399", fg: "#06281c" },
  lifting: { bg: TURN_TINTS.lifting.bg, border: TURN_TINTS.lifting.border, fg: "#6ee7b7" },
  resting: { bg: TURN_TINTS.resting.bg, border: TURN_TINTS.resting.border, fg: "#b4c9ff" },
  finished: { bg: TURN_TINTS.finished.bg, border: TURN_TINTS.finished.border, fg: "rgba(255,255,255,.75)" },
  together: { bg: TURN_TINTS.starting.bg, border: TURN_TINTS.starting.border, fg: "#fcd34d" },
  waiting: { bg: "rgba(255,255,255,.06)", border: "rgba(255,255,255,.16)", fg: "rgba(255,255,255,.75)" },
};

interface WorkoutSessionContextPillProps {
  /** Participantes (com realtime) — a mesma fonte da sessão. */
  members: WorkoutPartyMember[];
  currentUserId: string;
  /** Estou descansando? Decide entre "Sua vez!" e "Vez de Ana". */
  selfResting: boolean;
  /** Exercícios que EU já concluí / total — minha linha na folha. */
  progressDone: number;
  progressTotal: number;
  /** Desafio sendo cumprido nesta sessão (tem prioridade sobre o treinar junto). */
  challenge: ActiveWorkoutChallenge | null;
  routineName: string;
}

export function WorkoutSessionContextPill({
  members,
  currentUserId,
  selfResting,
  progressDone,
  progressTotal,
  challenge,
  routineName,
}: WorkoutSessionContextPillProps) {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const others = members.filter((m) => m.userId !== currentUserId);
  // Treinando de fato (ou que terminou depois de treinar) vs convite no ar.
  const partners = others.filter(
    (m) => m.status === "accepted" || (m.status === "left" && !!m.finishedAt),
  );
  const pending = others.filter((m) => m.status === "pending");
  const now = useNow(partners.some((m) => isRestingNow(m)));
  const turns = partners.map((m) => ({ member: m, turn: partnerTurn(m, now) }));

  // ── O que a pílula diz ────────────────────────────────────────────────────
  let tone: Tone | null = null;
  let text = "";
  let avatars: Array<{ id: string; photo: string | null; nickname: string; ring: string; dashed?: boolean }> = [];

  if (challenge) {
    tone = "challenge";
    text = t("goals_challenge_session_title").replace("{name}", challenge.challengerNickname);
    avatars = [{
      id: challenge.challengerId ?? "challenger",
      photo: challenge.challengerPhoto ?? null,
      nickname: challenge.challengerNickname,
      ring: "#f43f5e",
    }];
  } else if (turns.length > 0) {
    const resting = turns.find((r) => r.turn.kind === "resting");
    const lifting = turns.find((r) => r.turn.kind === "lifting");
    if (!selfResting && resting) {
      // O amigo descansa e eu não: a série é minha.
      tone = "yours";
      text = `${t("goals_party_turn_yours")} · ${turnText(resting.member.nickname, resting.turn, t)}`;
    } else if (lifting) {
      tone = "lifting";
      text = turnText(lifting.member.nickname, lifting.turn, t);
    } else if (resting) {
      tone = "resting";
      text = turnText(resting.member.nickname, resting.turn, t);
    } else if (turns.every((r) => r.turn.kind === "finished")) {
      tone = "finished";
      text = turnText(turns[0].member.nickname, turns[0].turn, t);
    } else {
      tone = "together";
      text = t("goals_party_pill_with").replace(
        "{names}",
        turns.map((r) => r.member.nickname).join(", "),
      );
    }
    avatars = turns.map((r) => ({
      id: r.member.userId,
      photo: r.member.photo,
      nickname: r.member.nickname,
      ring: TURN_COLORS[r.turn.kind],
    }));
  } else if (pending.length > 0) {
    tone = "waiting";
    text = pending.length === 1
      ? t("goals_party_pill_waiting_one").replace("{name}", pending[0].nickname)
      : t("goals_party_pill_waiting_many").replace("{n}", String(pending.length));
    avatars = pending.map((m) => ({
      id: m.userId, photo: m.photo, nickname: m.nickname,
      ring: "rgba(255,255,255,.4)", dashed: true,
    }));
  }

  // "Sua vez!" chega com um toque no celular e um pulso — uma vez por virada,
  // nunca a cada segundo da contagem.
  const prevToneRef = React.useRef<Tone | null>(null);
  const [pulseKey, setPulseKey] = React.useState(0);
  React.useEffect(() => {
    if (tone === "yours" && prevToneRef.current !== "yours") {
      void hapticMedium();
      setPulseKey((k) => k + 1);
    }
    prevToneRef.current = tone;
  }, [tone]);

  if (!tone) return null;
  const style = TONE_STYLE[tone];

  return (
    <>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        aria-label={challenge ? t("goals_challenge_sheet_open") : t("goals_party_sheet_open")}
        // 26px visíveis; o padding + margem negativa levam a área de toque a
        // 44px sem empurrar o layout do cabeçalho.
        style={{
          padding: "9px 0", margin: "-9px 0", maxWidth: "100%", minWidth: 0,
          background: "none", border: "none", cursor: "pointer", display: "flex",
        }}
      >
        <motion.span
          key={pulseKey}
          initial={false}
          animate={pulseKey > 0 && !reduceMotion ? { scale: [1, 1.08, 1] } : undefined}
          transition={{ duration: 0.45, ease: "easeOut" }}
          style={{
            height: 26, maxWidth: "100%", minWidth: 0, boxSizing: "border-box",
            display: "flex", alignItems: "center", gap: 6,
            padding: tone === "yours" ? "0 9px 0 7px" : "0 9px 0 3px",
            borderRadius: 999,
            background: style.bg,
            border: `1px solid ${style.border}`,
            boxShadow: tone === "yours" ? "0 0 0 4px rgba(52,211,153,.18)" : undefined,
          }}
        >
          {tone === "yours" ? (
            <Flame style={{ width: 14, height: 14, color: style.fg, flexShrink: 0 }} strokeWidth={2.4} />
          ) : (
            <span style={{ display: "flex", flexShrink: 0 }}>
              {avatars.slice(0, 3).map((a, i) => (
                <span
                  key={a.id}
                  style={{
                    marginLeft: i === 0 ? 0 : -6, borderRadius: "50%", lineHeight: 0,
                    border: `2px ${a.dashed ? "dashed" : "solid"} ${a.ring}`,
                    opacity: a.dashed ? 0.6 : 1,
                  }}
                >
                  <UserAvatar photo={a.photo} nickname={a.nickname} size="sm" className="h-4 w-4" />
                </span>
              ))}
            </span>
          )}
          <span style={{
            fontSize: 12, fontWeight: tone === "yours" ? 800 : 700, color: style.fg,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0,
            fontVariantNumeric: "tabular-nums",
          }}>
            {text}
          </span>
          {tone === "challenge" ? (
            <Lock style={{ width: 12, height: 12, color: style.fg, flexShrink: 0 }} strokeWidth={2.4} />
          ) : (
            <ChevronDown style={{ width: 12, height: 12, color: style.fg, flexShrink: 0 }} strokeWidth={2.6} />
          )}
        </motion.span>
      </button>

      <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
        <DrawerContent
          {...GLASS_SHEET_PROPS}
          // A sessão é um overlay `zIndex 9999`: sem elevar o wrapper do portal a
          // folha abriria atrás dela (mesmo mecanismo do WorkoutPartyDrawer).
          wrapperClassName="z-[10000]"
          style={{ ...GLASS_SHEET_STYLE, maxHeight: "85dvh" }}
        >
          {challenge ? (
            <ChallengeSheetBody challenge={challenge} />
          ) : (
            <PartySheetBody
              selfPhoto={members.find((m) => m.userId === currentUserId)?.photo ?? null}
              turns={turns}
              pending={pending}
              selfResting={selfResting}
              progressDone={progressDone}
              progressTotal={progressTotal}
              routineName={routineName}
            />
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}

// ── Folha: treinando junto ─────────────────────────────────────────────────

function PersonRow({
  photo, nickname, ring, dashed, title, status, statusColor, done, total, highlight,
}: {
  photo: string | null;
  nickname: string;
  ring: string;
  dashed?: boolean;
  title: string;
  status: string;
  statusColor: string;
  done?: number;
  total?: number;
  highlight?: { bg: string; border: string };
}) {
  const pct = total && total > 0 ? Math.min(100, Math.round(((done ?? 0) / total) * 100)) : 0;
  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
      style={{
        background: highlight?.bg ?? "rgba(255,255,255,.04)",
        border: `1px ${dashed ? "dashed" : "solid"} ${highlight?.border ?? "rgba(255,255,255,.08)"}`,
        opacity: dashed ? 0.65 : 1,
      }}
    >
      <span
        className="shrink-0 rounded-full"
        style={{ border: `2.5px ${dashed ? "dashed" : "solid"} ${ring}`, lineHeight: 0 }}
      >
        <UserAvatar photo={photo} nickname={nickname} size="md" className="h-9 w-9" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-white truncate">{title}</p>
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold mt-0.5 min-w-0" style={{ color: statusColor }}>
          {!dashed && <span className="h-[7px] w-[7px] rounded-full shrink-0" style={{ background: statusColor }} />}
          <span className="truncate tabular-nums">{status}</span>
        </p>
      </div>
      {total !== undefined && total > 0 && (
        <div className="w-16 shrink-0 text-right">
          <p className="text-[13px] font-extrabold text-white tabular-nums">{done ?? 0}/{total}</p>
          <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.1)" }}>
            <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: ring }} />
          </div>
        </div>
      )}
    </div>
  );
}

function PartySheetBody({
  selfPhoto, turns, pending, selfResting, progressDone, progressTotal, routineName,
}: {
  selfPhoto: string | null;
  turns: Array<{ member: WorkoutPartyMember; turn: PartnerTurn }>;
  pending: WorkoutPartyMember[];
  selfResting: boolean;
  progressDone: number;
  progressTotal: number;
  routineName: string;
}) {
  const { t } = useLanguage();
  const myColor = selfResting ? TURN_COLORS.resting : TURN_COLORS.lifting;
  return (
    <>
      <DrawerHeader className="pb-2">
        <DrawerTitle className="text-base font-semibold text-white flex items-center gap-2">
          <Users className="h-4 w-4 text-amber-300" />
          {t("goals_party_sheet_title")}
        </DrawerTitle>
        <p className="text-[13px] text-white/55 text-left">
          {routineName} · {t("goals_party_exercise_count").replace("{n}", String(progressTotal))}
        </p>
      </DrawerHeader>
      <div
        className="flex-1 min-h-0 overflow-y-auto px-4 space-y-2"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        {turns.map(({ member, turn }) => (
          <PersonRow
            key={member.userId}
            photo={member.photo}
            nickname={member.nickname}
            ring={TURN_COLORS[turn.kind]}
            title={member.nickname}
            status={turnStatus(turn, t)}
            statusColor={TURN_COLORS[turn.kind]}
            done={member.progressDone}
            total={member.progressTotal || progressTotal}
            highlight={turn.kind === "lifting" ? TURN_TINTS.lifting : undefined}
          />
        ))}
        <PersonRow
          photo={selfPhoto}
          nickname={t("goals_challenge_you")}
          ring={myColor}
          title={t("goals_challenge_you")}
          status={selfResting ? t("goals_party_sheet_you_resting") : t("goals_party_sheet_you_lifting")}
          statusColor={myColor}
          done={progressDone}
          total={progressTotal}
        />
        {pending.map((member) => (
          <PersonRow
            key={member.userId}
            photo={member.photo}
            nickname={member.nickname}
            ring="rgba(255,255,255,.4)"
            dashed
            title={member.nickname}
            status={t("goals_party_sheet_pending")}
            statusColor="rgba(255,255,255,.7)"
          />
        ))}
      </div>
    </>
  );
}

/** Estado do amigo na folha (o nome já está no título da linha). */
function turnStatus(turn: PartnerTurn, t: ReturnType<typeof useLanguage>["t"]): string {
  switch (turn.kind) {
    case "resting":
      return t("goals_party_sheet_resting").replace("{time}", fmtSecs(turn.secsLeft));
    case "lifting":
      return turn.exercise
        ? t("goals_party_sheet_lifting").replace("{exercise}", turn.exercise)
        : t("goals_party_sheet_lifting_now");
    case "finished":
      return t("goals_party_sheet_finished");
    default:
      return t("goals_party_sheet_starting");
  }
}

// ── Folha: desafio ─────────────────────────────────────────────────────────

function ChallengeSheetBody({ challenge }: { challenge: ActiveWorkoutChallenge }) {
  const { t } = useLanguage();
  const items = challenge.snapshot.items;
  return (
    <>
      <DrawerHeader className="pb-2">
        <div className="flex items-center gap-3">
          <span className="shrink-0 rounded-full" style={{ border: "2.5px solid #f43f5e", lineHeight: 0 }}>
            <UserAvatar photo={challenge.challengerPhoto ?? null} nickname={challenge.challengerNickname} size="md" className="h-9 w-9" />
          </span>
          <div className="min-w-0 text-left">
            <DrawerTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Swords className="h-4 w-4 text-rose-300" />
              <span className="truncate">{t("goals_challenge_session_title").replace("{name}", challenge.challengerNickname)}</span>
            </DrawerTitle>
            <p className="text-[13px] text-white/55 truncate">
              {(challenge.snapshot.routineName || t("goals_rt_exercises"))} · {t("goals_party_exercise_count").replace("{n}", String(items.length))}
            </p>
          </div>
        </div>
      </DrawerHeader>
      <div
        className="flex-1 min-h-0 overflow-y-auto px-4"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <div
          className="flex items-start gap-2.5 rounded-2xl px-3.5 py-3"
          style={{ background: "rgba(244,63,94,.10)", border: "1px solid rgba(244,63,94,.32)" }}
        >
          <Lock className="h-4 w-4 text-rose-300 shrink-0 mt-0.5" />
          <p className="text-[13px] leading-snug text-white/85">
            {t("goals_challenge_hidden_hint").replace("{name}", challenge.challengerNickname)}
          </p>
        </div>

        <p className="mt-4 mb-1.5 text-[11px] font-bold uppercase tracking-wide text-white/55">
          {t("goals_challenge_sheet_rules")}
        </p>
        <p className="text-[13px] leading-relaxed text-white/80">{t("goals_challenge_rule_hint")}</p>

        <p className="mt-4 mb-1 text-[11px] font-bold uppercase tracking-wide text-white/55">
          {t("goals_rt_exercises")}
        </p>
        <ul>
          {items.map((item, i) => (
            <li
              key={item.workoutId}
              className="flex items-baseline justify-between gap-3 py-2.5 text-[14px] text-white"
              style={{ borderBottom: i < items.length - 1 ? "1px solid rgba(255,255,255,.08)" : "none" }}
            >
              <span className="truncate">{item.name}</span>
              <span className="shrink-0 text-[13px] text-white/55">
                {t("goals_challenge_sets").replace("{n}", String(item.series))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
