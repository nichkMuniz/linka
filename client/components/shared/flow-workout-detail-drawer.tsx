import * as React from "react";
import { Check, Copy, Dumbbell, Flame, Loader2, Timer, Trophy } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/language-context";
import { GLASS_SHEET_PROPS, GLASS_SHEET_STYLE } from "@/lib/glass-styles";
import {
  copyRoutineToUserDb,
  getCopiedRoutineKeysDb,
  getFlowWorkoutSessionDb,
  type StoryWorkoutSticker,
} from "@/lib/ritmofit-db";
import {
  formatStickerDate,
  formatStickerDuration,
  formatStickerVolume,
} from "@/components/shared/flow-workout-sticker";

interface FlowWorkoutDetailDrawerProps {
  /** Treino citado no flow (o sticker). null = fechado. */
  workout: StoryWorkoutSticker | null;
  /** Autor do flow — dono da rotina que será copiada. */
  authorId: string;
  authorNickname: string;
  onClose: () => void;
}

type Row = { name: string; detail: string | null };

/**
 * Detalhe do "resumo do treino" postado no flow, aberto ao tocar no sticker.
 *
 * Mostra SÓ os exercícios feitos na sessão — nunca os demais da rotina que
 * não foram executados. O sticker guarda até 8; a sessão completa vem de
 * `routines.last_summary` do autor enquanto ela ainda for a MESMA sessão
 * (`completedAt` igual). Se o autor já treinou a rotina de novo, fica a lista
 * do sticker + "+N exercícios". Rotina apagada → cópia indisponível.
 *
 * "Copiar rotina" usa `copyRoutineToUserDb` — o mesmo caminho da Busca e do
 * feed —, então a rotina chega em Metas com `follower_id` do autor e o botão
 * reconhece a cópia depois (`getCopiedRoutineKeysDb`).
 */
export function FlowWorkoutDetailDrawer({
  workout,
  authorId,
  authorNickname,
  onClose,
}: FlowWorkoutDetailDrawerProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  // null = carregando. `exercises` null = sessão completa indisponível (usa o sticker).
  const [session, setSession] = React.useState<Awaited<ReturnType<typeof getFlowWorkoutSessionDb>> | null>(null);
  const [alreadyCopied, setAlreadyCopied] = React.useState(false);
  const [copying, setCopying] = React.useState(false);

  const isOwner = !!user && user.id === authorId;

  React.useEffect(() => {
    if (!workout) return;
    let alive = true;
    setSession(null);
    setAlreadyCopied(false);
    getFlowWorkoutSessionDb(authorId, workout.name, workout.date)
      .then((res) => {
        if (!alive) return;
        setSession(res);
        // A chave de cópia usa o nome REAL da rotina (o mesmo que a cópia grava).
        if (user && !isOwner && res.found) {
          getCopiedRoutineKeysDb(user.id)
            .then((keys) => { if (alive) setAlreadyCopied(keys.has(`${authorId}::${res.routineName ?? null}`)); })
            .catch(() => {});
        }
      })
      .catch(() => { if (alive) setSession({ found: false, routineName: null, exercises: null }); });
    return () => { alive = false; };
  }, [workout, authorId, user?.id, isOwner]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatSession = (ex: StoryWorkoutSticker["exercises"][number]) =>
    ex.isCardio ? `${ex.kg} min` : ex.kg > 0 ? `${ex.sets}× ${ex.kg}kg` : `${ex.sets}×`;

  const routineAvailable = !!session?.found;
  const fullSession = session?.exercises ?? null;
  // Só o que foi FEITO: sessão completa quando disponível; senão, o sticker.
  const rows: Row[] = React.useMemo(
    () => (fullSession ?? workout?.exercises ?? []).map((ex) => ({ name: ex.name, detail: formatSession(ex) })),
    [fullSession, workout], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleCopy = async () => {
    if (!user || !workout || isOwner || !session?.found) return;
    setCopying(true);
    try {
      await copyRoutineToUserDb(authorId, user.id, 1, session.routineName);
      setAlreadyCopied(true);
      window.dispatchEvent(new Event("ritmofit-routines-changed"));
      toast({
        title: t("flow_workout_copy_success"),
        description: t("flow_workout_copy_success_desc").replace("{name}", workout.name),
      });
    } catch (err: any) {
      toast({
        title: t("flow_workout_copy_error"),
        description: err?.message || t("retry"),
        variant: "destructive",
      });
    } finally {
      setCopying(false);
    }
  };

  const dateLabel = workout
    ? formatStickerDate(workout.date, t("flow_workout_today"), t("flow_workout_yesterday"))
    : "";

  const chip = (content: React.ReactNode, accent = false) => (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{
        background: accent ? "rgba(255,196,60,.16)" : "rgba(255,255,255,.08)",
        border: `1px solid ${accent ? "rgba(255,196,60,.3)" : "rgba(255,255,255,.12)"}`,
        color: accent ? "#ffc43c" : "rgba(255,255,255,.85)",
      }}
    >
      {content}
    </span>
  );

  return (
    <Drawer open={!!workout} onOpenChange={(o) => { if (!o) onClose(); }} {...GLASS_SHEET_PROPS}>
      <DrawerContent style={GLASS_SHEET_STYLE}>
        {workout && (
          <>
            <DrawerHeader className="text-left">
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)" }}
                >
                  <Dumbbell className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <DrawerTitle className="truncate" style={{ color: "#fff" }}>{workout.name}</DrawerTitle>
                  <DrawerDescription style={{ color: "rgba(255,255,255,.5)" }}>
                    {t("flow_workout_detail_by").replace("{name}", authorNickname)}
                    {dateLabel ? ` · ${dateLabel}` : ""}
                  </DrawerDescription>
                </div>
              </div>
            </DrawerHeader>

            <div
              className="flex-1 overflow-y-auto px-4 space-y-4"
              style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
            >
              <div className="flex flex-wrap gap-2">
                {chip(`${workout.totalSeries} ${t("flow_workout_series")}`)}
                {workout.totalVolume > 0 && chip(formatStickerVolume(workout.totalVolume))}
                {workout.durationSecs > 0 && chip(<><Timer className="h-3 w-3" />{formatStickerDuration(workout.durationSecs)}</>)}
                {Number(workout.caloriesKcal ?? 0) > 0 && chip(<><Flame className="h-3 w-3" />{`${Math.round(Number(workout.caloriesKcal))} kcal`}</>)}
                {Number(workout.prCount ?? 0) > 0 && chip(<><Trophy className="h-3 w-3" />{`${workout.prCount} ${t("flow_workout_prs")}`}</>, true)}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold" style={{ color: "#fff" }}>
                  {t("flow_workout_detail_exercises")}
                </p>
                {session === null ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin" style={{ color: "rgba(255,255,255,.5)" }} />
                  </div>
                ) : (
                  rows.map((r, i) => (
                    <div
                      key={`${r.name}-${i}`}
                      className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
                      style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }}
                    >
                      <span
                        className="h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold"
                        style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.7)" }}
                      >
                        {i + 1}
                      </span>
                      <span className="flex-1 min-w-0 text-sm font-medium truncate" style={{ color: "#fff" }}>
                        {r.name}
                      </span>
                      {r.detail && (
                        <span className="shrink-0 text-xs font-semibold" style={{ color: "rgba(255,255,255,.6)" }}>
                          {r.detail}
                        </span>
                      )}
                    </div>
                  ))
                )}
                {session !== null && !fullSession && Number(workout.extraCount ?? 0) > 0 && (
                  <p className="text-xs" style={{ color: "rgba(255,255,255,.45)" }}>
                    {t("flow_workout_more_exercises").replace("{n}", String(workout.extraCount))}
                  </p>
                )}
              </div>

              {!isOwner && user && session !== null && (
                routineAvailable ? (
                  <Button
                    onClick={handleCopy}
                    disabled={copying || alreadyCopied}
                    className={`w-full rounded-full gap-2 ${alreadyCopied ? "bg-transparent border border-white/20 text-white disabled:opacity-100" : "border-0"}`}
                    style={alreadyCopied ? undefined : { background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
                  >
                    {copying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : alreadyCopied ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {alreadyCopied ? t("flow_workout_copied") : t("flow_workout_copy")}
                  </Button>
                ) : (
                  <p className="text-xs text-center" style={{ color: "rgba(255,255,255,.45)" }}>
                    {t("flow_workout_copy_unavailable")}
                  </p>
                )
              )}
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
