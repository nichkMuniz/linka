import * as React from "react";
import { Check, Dumbbell, Loader2 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/language-context";
import { GLASS_SHEET_STYLE, GLASS_SHEET_PROPS } from "@/lib/glass-styles";
import { hapticLight } from "@/lib/haptics";
import { reportHandledError } from "@/lib/monitoring";
import {
  linkSessionWorkoutsToRoutineDb,
  type Routine,
  type UserWorkoutWithDetails,
} from "@/lib/ritmofit-db";

/** Exercício do catálogo a ser colocado numa rotina. */
export type AddToRoutineExercise = { id: string; name: string };

interface AddToRoutineDrawerProps {
  exercise: AddToRoutineExercise | null;
  onClose: () => void;
  /** Rotinas do usuário (todas; o drawer filtra as de treino). */
  routines: Routine[];
  /** Itens de treino do usuário — dizem em quais rotinas o exercício já está. */
  userWorkouts: UserWorkoutWithDetails[];
  /** Depois de adicionar: o pai recarrega rotinas/itens. */
  onAdded?: () => void;
}

/**
 * "Colocar na rotina": escolhe em qual rotina de TREINO o exercício entra.
 *
 * O item vai para o fim da rotina (`order_index` nulo = ordem por created_at),
 * sem séries/carga pré-definidas — a sessão de treino já propõe o padrão. A
 * escrita é `linkSessionWorkoutsToRoutineDb`, que é idempotente por rotina +
 * exercício: tocar duas vezes não duplica.
 *
 * Rotina que já tem o exercício aparece marcada e desabilitada. O vínculo casa
 * por `routine_id` e, nas rotinas legadas (itens sem `routine_id`), pelo nome —
 * o mesmo critério com que a tela de Metas monta os cards.
 */
export function AddToRoutineDrawer({
  exercise,
  onClose,
  routines,
  userWorkouts,
  onAdded,
}: AddToRoutineDrawerProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [savingId, setSavingId] = React.useState<string | null>(null);

  // Linhas de `routines` com o mesmo nome viram UM card na tela de Metas
  // (`buildRoutineCards`); aqui também, senão a mesma rotina apareceria duas
  // vezes. `routines` vem da mais recente para a mais antiga — fica a primeira.
  const workoutRoutines = React.useMemo(() => {
    const seen = new Set<string>();
    return routines.filter((r) => {
      if (r.type !== 1) return false;
      const key = r.name ?? "";
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [routines]);

  // Item pertence à rotina pelo `routine_id` OU pelo nome — o nome cobre as
  // rotinas legadas (itens sem `routine_id`) e as linhas duplicadas por nome
  // que o dedupe acima juntou.
  const belongsTo = React.useCallback(
    (w: UserWorkoutWithDetails, routine: Routine) =>
      (!!w.routine_id && String(w.routine_id) === routine.id) ||
      (w.name ?? null) === (routine.name ?? null),
    [],
  );

  const containsExercise = React.useCallback(
    (routine: Routine) =>
      !!exercise &&
      userWorkouts.some((w) => String(w.workout_id) === exercise.id && belongsTo(w, routine)),
    [exercise, userWorkouts, belongsTo],
  );

  // Exercícios distintos (a mesma rotina pode ter o exercício em duas linhas).
  const exerciseCount = React.useCallback(
    (routine: Routine) =>
      new Set(userWorkouts.filter((w) => belongsTo(w, routine)).map((w) => String(w.workout_id))).size,
    [userWorkouts, belongsTo],
  );

  const handleAdd = async (routine: Routine) => {
    if (!exercise || !user?.id || savingId) return;
    hapticLight();
    setSavingId(routine.id);
    try {
      await linkSessionWorkoutsToRoutineDb(user.id, [exercise.id], {
        routine_id: routine.id,
        name: routine.name ?? null,
      });
      window.dispatchEvent(new CustomEvent("ritmofit-routines-changed"));
      onAdded?.();
      toast({
        title: t("goals_add_to_routine_success"),
        description: t("goals_add_to_routine_success_desc")
          .replace("{exercise}", exercise.name)
          .replace("{routine}", routine.name ?? t("goals_add_to_routine_unnamed")),
      });
      onClose();
    } catch (err) {
      reportHandledError(err, "goals:add-exercise-to-routine");
      toast({ title: t("goals_add_to_routine_error"), description: t("retry"), variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Drawer open={!!exercise} onOpenChange={(o) => { if (!o) onClose(); }} {...GLASS_SHEET_PROPS}>
      <DrawerContent style={GLASS_SHEET_STYLE}>
        <DrawerHeader className="text-left">
          <DrawerTitle style={{ color: "#fff" }}>{t("goals_add_to_routine_title")}</DrawerTitle>
          {exercise && (
            <DrawerDescription style={{ color: "rgba(255,255,255,.55)" }}>
              {t("goals_add_to_routine_desc").replace("{exercise}", exercise.name)}
            </DrawerDescription>
          )}
        </DrawerHeader>

        <div
          className="flex-1 overflow-y-auto px-4 space-y-2"
          style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
        >
          {workoutRoutines.length === 0 ? (
            <div className="flex flex-col items-center text-center gap-2 py-8 px-6">
              <div
                className="h-12 w-12 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)" }}
              >
                <Dumbbell className="h-5 w-5 text-white/70" />
              </div>
              <p className="text-sm font-semibold text-white">{t("goals_add_to_routine_empty")}</p>
              <p className="text-xs text-white/60">{t("goals_add_to_routine_empty_desc")}</p>
            </div>
          ) : (
            workoutRoutines.map((routine) => {
              const already = containsExercise(routine);
              const saving = savingId === routine.id;
              const count = exerciseCount(routine);
              return (
                <button
                  key={routine.id}
                  type="button"
                  disabled={already || !!savingId}
                  onClick={() => handleAdd(routine)}
                  className="w-full flex items-center gap-3 rounded-2xl p-3 text-left active:scale-[0.99] transition-transform disabled:active:scale-100"
                  style={{
                    background: "rgba(255,255,255,.05)",
                    border: "1px solid rgba(255,255,255,.1)",
                    opacity: savingId && !saving ? 0.5 : 1,
                  }}
                >
                  <div
                    className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)" }}
                  >
                    <Dumbbell className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold truncate" style={{ color: "#fff" }}>
                      {routine.name ?? t("goals_add_to_routine_unnamed")}
                    </p>
                    <p className="text-[11px]" style={{ color: "rgba(255,255,255,.5)" }}>
                      {already
                        ? t("goals_add_to_routine_already")
                        : t("goals_add_to_routine_count").replace("{n}", String(count))}
                    </p>
                  </div>
                  {saving ? (
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin" style={{ color: "rgba(255,255,255,.6)" }} />
                  ) : already ? (
                    <Check className="h-5 w-5 shrink-0 text-emerald-400" />
                  ) : (
                    <span
                      className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
                      style={{ background: "rgba(91,140,255,.2)", color: "#9db8ff", border: "1px solid rgba(91,140,255,.4)" }}
                    >
                      {t("goals_add_to_routine_add")}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
