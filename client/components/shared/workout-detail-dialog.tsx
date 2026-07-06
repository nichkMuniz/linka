import * as React from "react";
import { Dumbbell } from "lucide-react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { ExerciseImage } from "@/components/shared/exercise-image";
import { useLanguage } from "@/lib/language-context";
import { hapticMedium } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { GLASS_TOP } from "@/lib/post-visuals";
import { GLASS_SHEET_STYLE, GLASS_SHEET_PROPS } from "@/lib/glass-styles";
import type { PostWorkoutSummary } from "@/lib/workout-summary-types";

// Uma série vira um chip: "40kg × 12" (força) ou "12×" (sem carga / cardio).
function formatSet(set: { kg: number; reps: number }): string {
  if (set.kg > 0 && set.reps > 0) return `${set.kg}kg × ${set.reps}`;
  if (set.kg > 0) return `${set.kg}kg`;
  if (set.reps > 0) return `${set.reps}×`;
  return "—";
}

// Miniatura do exercício — mesmo tratamento do drawer de registrar treino
// (`workout-session-dialog.tsx`): as ilustrações do wger são linhas escuras que
// somem sobre fundo escuro, então a foto vai sobre **fundo branco** com
// `object-contain`. Sem foto (ou erro de carregamento) cai no fallback do
// `ExerciseImage` (gradiente + emoji por grupo muscular).
function ExerciseThumb({ photo, name, muscleGroup }: {
  photo: string | null; name: string; muscleGroup: string | null;
}) {
  const [err, setErr] = React.useState(false);
  React.useEffect(() => setErr(false), [photo]);
  if (photo && !err) {
    return (
      <div
        className="h-11 w-11 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
        style={{ background: "#fff" }}
      >
        <img
          src={photo}
          alt={name}
          className="w-full h-full object-contain"
          loading="lazy"
          onError={() => setErr(true)}
        />
      </div>
    );
  }
  return (
    <ExerciseImage photo={null} name={name} muscleGroup={muscleGroup} className="h-11 w-11 rounded-xl" />
  );
}

interface WorkoutDetailButtonProps {
  summary: PostWorkoutSummary;
  /** Classe extra para posicionar o pill no layout do chamador. */
  className?: string;
}

/**
 * Pill "Ver treino" + drawer simplificado de detalhe. Renderizado apenas em posts
 * que carregam um `workout_summary` (resumo de treino compartilhado no feed). Ao
 * tocar, abre um drawer glass enxuto: só a lista de exercícios com miniatura, grupo
 * muscular e as séries em chips `{kg}kg × {reps}` — sem stats/banners extras.
 *
 * Reutilizado no feed (PostCard), no viewer de post do Perfil e no PostDetail.
 */
export function WorkoutDetailButton({ summary, className }: WorkoutDetailButtonProps) {
  const { t } = useLanguage();
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => { hapticMedium(); setOpen(true); }}
        className={cn(
          "inline-flex items-center gap-1.5 text-[12px] font-semibold text-white rounded-full px-3 py-1.5 active:opacity-70 transition-opacity",
          className,
        )}
        style={GLASS_TOP}
      >
        <Dumbbell className="h-3.5 w-3.5" />
        {t("feed_workout_view")}
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent
          handleClassName={GLASS_SHEET_PROPS.handleClassName}
          className={GLASS_SHEET_PROPS.className}
          style={GLASS_SHEET_STYLE}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="overflow-y-auto px-4 pb-6 pt-2" style={{ maxHeight: "78dvh" }}>
            {/* Título compacto */}
            <div className="flex items-center gap-2 mb-4">
              <Dumbbell className="h-5 w-5 text-[#9db8ff] shrink-0" />
              <div className="min-w-0">
                <h2 className="text-base font-bold text-white leading-tight truncate">
                  {t("workout_detail_title")}
                </h2>
                {summary.routineName && (
                  <p className="text-xs text-white/45 truncate">{summary.routineName}</p>
                )}
              </div>
            </div>

            {/* Lista de exercícios: miniatura + nome/grupo + séries em chips */}
            <div className="text-[11px] font-bold text-white/40 uppercase tracking-wide mb-2">
              {t("workout_detail_exercises")}
            </div>
            <div className="space-y-2">
              {summary.exercises.map((ex, idx) => {
                const chips = (ex.sets && ex.sets.length > 0)
                  ? ex.sets.map(formatSet)
                  : ex.bestKg > 0 ? [`${ex.bestKg}kg`] : [];
                return (
                  <div
                    key={ex.name + idx}
                    className="flex items-center gap-3 rounded-2xl p-2.5"
                    style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}
                  >
                    <ExerciseThumb
                      photo={ex.photo ?? null}
                      name={ex.name}
                      muscleGroup={ex.muscleGroup}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white truncate">{ex.name}</div>
                      {ex.muscleGroup && (
                        <div className="text-[11px] text-white/40 mt-0.5 truncate">{ex.muscleGroup}</div>
                      )}
                    </div>
                    {chips.length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-end shrink-0 max-w-[52%]">
                        {chips.map((c, j) => (
                          <span
                            key={j}
                            className="text-[11px] font-medium rounded-md px-1.5 py-0.5 leading-none"
                            style={{ background: "rgba(91,140,255,.16)", color: "#9db8ff" }}
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
