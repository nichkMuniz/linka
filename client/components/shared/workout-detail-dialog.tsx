import * as React from "react";
import { Dumbbell, Flame, Swords, ChevronLeft } from "lucide-react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { ExerciseImage } from "@/components/shared/exercise-image";
import { useLanguage } from "@/lib/language-context";
import { useAuthContext } from "@/lib/auth-context";
import { hapticMedium } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { GLASS_TOP } from "@/lib/post-visuals";
import { GLASS_SHEET_STYLE, GLASS_SHEET_PROPS } from "@/lib/glass-styles";
import {
  WorkoutCompareContent,
  canCompareWorkout,
} from "@/components/shared/workout-compare-dialog";
import type { PostWorkoutSummary, WorkoutSummarySet } from "@/lib/workout-summary-types";
import {
  cardioMinutesFromInput,
  formatCardioKm,
  formatCardioMinutes,
  formatElevationPct,
} from "@/lib/cardio-exercises";

// Uma série vira um chip. Força: "40kg × 12" ou "12×" (sem carga). Cardio
// (corrida/bike): a série codifica kg = MINUTOS e reps = KM, então o chip vira
// "15min × 3km" — nunca "kg × reps" (ver isCardio em WorkoutSummaryExercise).
// O minuto passa por `cardioMinutesFromInput`: quem treinou 1h30 digitou "1,30"
// no campo MIN, e sem a conversão o chip saía "1.3min".
//
// Esteira com inclinação anotada ganha um sufixo "⛰ 6%" no próprio chip — a
// elevação é uma coluna da série (como MIN e KM), então pertence à série que a
// registrou, e não ao exercício.
function formatSet(set: WorkoutSummarySet, isCardio: boolean): string {
  if (isCardio) {
    const min = cardioMinutesFromInput(set.kg); // cardio: kg encoda MIN
    const km = set.reps; // cardio: reps encoda KM
    const incline = set.elev ? ` · ⛰ ${formatElevationPct(set.elev)}` : "";
    if (min > 0 && km > 0) return `${formatCardioMinutes(min)} × ${formatCardioKm(km)}km${incline}`;
    if (min > 0) return `${formatCardioMinutes(min)}${incline}`;
    if (km > 0) return `${formatCardioKm(km)}km${incline}`;
    return incline ? incline.replace(" · ", "") : "—";
  }
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
  /**
   * Autor do post. Habilita o botão "Comparar" DENTRO do drawer — o confronto
   * exercício a exercício com o meu próprio histórico. Omitido (ou igual ao
   * usuário logado) → o drawer é só a lista de exercícios, como antes.
   */
  authorId?: string | null;
  authorNickname?: string | null;
  authorPhoto?: string | null;
}

/**
 * Pill "Ver treino" + drawer simplificado de detalhe. Renderizado apenas em posts
 * que carregam um `workout_summary` (resumo de treino compartilhado no feed). Ao
 * tocar, abre um drawer glass enxuto: só a lista de exercícios com miniatura, grupo
 * muscular e as séries em chips `{kg}kg × {reps}` — sem stats/banners extras.
 *
 * Reutilizado no feed (PostCard), no viewer de post do Perfil e no PostDetail.
 */
export function WorkoutDetailButton({
  summary,
  className,
  authorId,
  authorNickname = null,
  authorPhoto = null,
}: WorkoutDetailButtonProps) {
  const { t } = useLanguage();
  const { user } = useAuthContext();
  const [open, setOpen] = React.useState(false);
  // O mesmo sheet serve duas telas: a lista de exercícios e o confronto com o
  // meu histórico. Empilhar um segundo drawer do vaul por cima deste era a
  // alternativa, mas dois sheets sobrepostos brigam pelo scroll-lock do body no
  // iOS — trocar a view mantém uma alça, um scroll e um caminho de volta.
  const [view, setView] = React.useState<"detail" | "compare">("detail");
  const canCompare = canCompareWorkout(summary, authorId, user?.id);

  // Fechar sempre volta para a lista: reabrir o post deve mostrar o treino, não
  // a comparação da última vez.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setView("detail");
  };

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

      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent
          handleClassName={GLASS_SHEET_PROPS.handleClassName}
          className={GLASS_SHEET_PROPS.className}
          style={GLASS_SHEET_STYLE}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="overflow-y-auto px-4 pb-6 pt-2" style={{ maxHeight: "78dvh" }}>
            {/* Título compacto. Na comparação, o ícone vira o botão de VOLTAR —
                é o único caminho de retorno sem fechar o sheet. */}
            <div className="flex items-center gap-2 mb-4">
              {view === "compare" ? (
                <button
                  type="button"
                  onClick={() => { hapticMedium(); setView("detail"); }}
                  aria-label={t("compare_back")}
                  className="shrink-0 -ml-1 p-1 rounded-full active:opacity-60 transition-opacity"
                >
                  <ChevronLeft className="h-5 w-5 text-[#9db8ff]" />
                </button>
              ) : (
                <Dumbbell className="h-5 w-5 text-[#9db8ff] shrink-0" />
              )}
              <div className="min-w-0">
                <h2 className="text-base font-bold text-white leading-tight truncate">
                  {view === "compare" ? t("compare_title") : t("workout_detail_title")}
                </h2>
                {view === "compare" ? (
                  <p className="text-xs text-white/45 truncate">{t("compare_subtitle")}</p>
                ) : (
                  summary.routineName && (
                    <p className="text-xs text-white/45 truncate">{summary.routineName}</p>
                  )
                )}
              </div>
              {/* Calorias da sessão (21/08/2026) — o ÚNICO stat que este drawer
                  mostra. Duração/séries/volume seguem de fora pela decisão de
                  06/07/2026 (o drawer é a lista de exercícios; os totais estão
                  no card gerado que acompanha o post). O chip é a exceção
                  pedida: o gasto calórico é o número que as pessoas comparam, e
                  vale ter em texto além de queimado na imagem do card. */}
              {view === "detail" && (summary.caloriesKcal ?? 0) > 0 && (
                <span
                  className="ml-auto shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ background: "rgba(255,140,60,.16)", color: "#ffa15c" }}
                >
                  <Flame className="h-3 w-3" />
                  {`${Math.round(summary.caloriesKcal!)} ${t("goals_calories_unit")}`}
                </span>
              )}
            </div>

            {/* Comparação: o mesmo sheet troca de conteúdo (ver `view`). */}
            {view === "compare" && (
              <WorkoutCompareContent
                active
                summary={summary}
                authorNickname={authorNickname}
                authorPhoto={authorPhoto}
              />
            )}

            {view === "detail" && (
              <>
                {/* Chamada para a comparação — fica acima da lista porque é o que a
                    pessoa quer fazer JUSTAMENTE enquanto olha o treino do outro.
                    Some no meu próprio post e para quem não está logado. */}
                {canCompare && (
                  <button
                    type="button"
                    onClick={() => { hapticMedium(); setView("compare"); }}
                    className="w-full mb-4 inline-flex items-center justify-center gap-2 rounded-2xl py-2.5 text-[13px] font-semibold text-white active:opacity-70 transition-opacity"
                    style={{
                      background: "linear-gradient(135deg,rgba(91,140,255,.32),rgba(157,107,255,.32))",
                      border: "1px solid rgba(255,255,255,.16)",
                    }}
                  >
                    <Swords className="h-4 w-4" />
                    {t("compare_cta")}
                  </button>
                )}

                {/* Lista de exercícios: miniatura + nome/grupo + séries em chips */}
                <div className="text-[11px] font-bold text-white/40 uppercase tracking-wide mb-2">
                  {t("workout_detail_exercises")}
                </div>
                <div className="space-y-2">
                  {summary.exercises.map((ex, idx) => {
                    const chips = (ex.sets && ex.sets.length > 0)
                      ? ex.sets.map((s) => formatSet(s, !!ex.isCardio))
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
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
