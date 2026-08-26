import * as React from "react";
import { UserPlus } from "lucide-react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { WorkoutPartyDrawer } from "@/components/goals/workout-party-drawer";
import { useLanguage } from "@/lib/language-context";
import { supabase } from "@/lib/supabase";
import {
  getWorkoutPartyMembersDb,
  updateWorkoutPartyProgressDb,
  type WorkoutPartyMember,
} from "@/lib/ritmofit-db";

interface WorkoutPartyBarProps {
  /** `null` = treino solo; o botão de chamar alguém continua ali. */
  partyId: string | null;
  currentUserId: string;
  routineName: string;
  exerciseCount: number;
  /** Exercícios que ESTE usuário já concluiu na sessão. */
  progressDone: number;
  /**
   * `false` esconde o botão de convidar. É o caso do CONVIDADO: a policy de
   * INSERT em `workout_party_members` só aceita o host, então o botão só
   * levaria a um erro de permissão.
   */
  canInvite: boolean;
  /**
   * Cria a party (quando ainda não existe) e/ou convida os ids. Implementado na
   * sessão, que é quem tem os exercícios para congelar no snapshot.
   */
  onInvite: (userIds: string[]) => Promise<void>;
}

/** Quantos avatares aparecem antes do "+N". */
const MAX_AVATARS = 4;

/**
 * Faixa de **treinar junto** no topo da sessão: quem está treinando com você,
 * em que exercício cada um está, e o botão de chamar mais gente.
 *
 * Sem party, encolhe para um único botão discreto — o treino solo (a esmagadora
 * maioria) não perde espaço de tela, mas a porta de entrada continua visível
 * para o caso mais real da academia: o amigo aparecer com o treino já começado.
 *
 * O progresso é reportado por EXERCÍCIO concluído, nunca por série: o que a
 * faixa mostra é "3/6", e escrever a cada série seriam dezenas de writes por
 * treino para um número que nem muda.
 */
export function WorkoutPartyBar({
  partyId,
  currentUserId,
  routineName,
  exerciseCount,
  progressDone,
  canInvite,
  onInvite,
}: WorkoutPartyBarProps) {
  const { t } = useLanguage();
  const [members, setMembers] = React.useState<WorkoutPartyMember[]>([]);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const reload = React.useCallback(() => {
    if (!partyId) {
      setMembers([]);
      return;
    }
    getWorkoutPartyMembersDb(partyId, { fresh: true })
      .then(setMembers)
      .catch(() => { /* faixa é informativa: falhar aqui não atrapalha o treino */ });
  }, [partyId]);

  React.useEffect(() => { reload(); }, [reload]);

  // Realtime: quem aceitou o convite e em que exercício cada um está. Nome de
  // canal único por montagem — reaproveitar o nome deixa a segunda assinatura
  // silenciosamente morta quando a tela é remontada (mesmo padrão de
  // Notifications.tsx).
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

  // Reporta o próprio progresso. Depende só de `progressDone`, que muda uma vez
  // por exercício concluído.
  React.useEffect(() => {
    if (!partyId) return;
    void updateWorkoutPartyProgressDb(partyId, progressDone, exerciseCount).catch(() => {});
  }, [partyId, progressDone, exerciseCount]);

  // Quem está treinando de fato + quem ainda não respondeu (aparece esmaecido:
  // o host precisa saber que o convite foi feito e ainda está no ar).
  const active = members.filter(
    (m) => m.status === "accepted" && m.userId !== currentUserId,
  );
  const pending = members.filter((m) => m.status === "pending");
  const shown = [...active, ...pending];

  const handleInvite = async (userIds: string[]) => {
    await onInvite(userIds);
    setDrawerOpen(false);
    reload();
  };

  const inviteButton = !canInvite ? null : (
    <button
      type="button"
      onClick={() => setDrawerOpen(true)}
      aria-label={t("goals_party_header_add")}
      style={{
        display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
        height: 28, padding: "0 10px", borderRadius: 999, cursor: "pointer",
        background: "rgba(255,255,255,.07)",
        border: "1px solid rgba(255,255,255,.14)",
        color: "rgba(255,255,255,.75)", fontSize: 12, fontWeight: 600,
      }}
    >
      <UserPlus style={{ width: 13, height: 13 }} />
      {shown.length === 0 ? t("goals_party_header_add") : null}
    </button>
  );

  // Convidado sem ninguém para mostrar ainda (o host some da lista enquanto os
  // membros não carregam): faixa vazia não ocupa espaço na tela de treino.
  if (!canInvite && shown.length === 0) return null;

  return (
    <>
      <div
        style={{
          flexShrink: 0,
          padding: "0 16px 8px",
          display: "flex", alignItems: "center", gap: 8,
          minWidth: 0,
        }}
      >
        {shown.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              {shown.slice(0, MAX_AVATARS).map((member, index) => (
                <div
                  key={member.userId}
                  style={{
                    marginLeft: index === 0 ? 0 : -8,
                    borderRadius: "50%",
                    border: "2px solid #14131a",
                    opacity: member.status === "pending" ? 0.4 : 1,
                    lineHeight: 0,
                  }}
                >
                  <UserAvatar photo={member.photo} nickname={member.nickname} size="sm" />
                </div>
              ))}
              {shown.length > MAX_AVATARS && (
                <div
                  style={{
                    marginLeft: -8, height: 32, width: 32, borderRadius: "50%",
                    border: "2px solid #14131a", background: "rgba(255,255,255,.12)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, color: "#fff",
                  }}
                >
                  +{shown.length - MAX_AVATARS}
                </div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.8)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {active.length > 0
                  ? active
                      .slice(0, 2)
                      .map((m) => `${m.nickname} ${m.progressDone}/${m.progressTotal || exerciseCount}`)
                      .join(" · ")
                  : t("goals_party_waiting")}
              </div>
            </div>
          </>
        )}

        {shown.length === 0 && <div style={{ flex: 1 }} />}
        {inviteButton}
      </div>

      <WorkoutPartyDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        routineName={routineName}
        exerciseCount={exerciseCount}
        mode="add"
        alreadyInvitedIds={members.map((m) => m.userId)}
        onConfirm={handleInvite}
        // A sessão de treino é um overlay `zIndex 9999`; sem elevar o wrapper do
        // portal, o drawer abriria atrás dela (só o scrim aparecia, engolindo os
        // toques). Mesmo mecanismo que o resumo usa com o `z-[9600]`.
        wrapperClassName="z-[10000]"
      />
    </>
  );
}
