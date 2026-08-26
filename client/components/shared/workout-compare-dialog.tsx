import * as React from "react";
import { Trophy, Minus, HelpCircle, Loader2 } from "lucide-react";
import { ExerciseImage } from "@/components/shared/exercise-image";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useLanguage } from "@/lib/language-context";
import { useAuthContext } from "@/lib/auth-context";
import { formatTimeAgo } from "@/lib/utils";
import { GLASS_PANEL_STYLE } from "@/lib/glass-styles";
import { formatCardioKm, formatCardioMinutes } from "@/lib/cardio-exercises";
import {
  getLastExerciseSessionsDb,
  getUserProfileDb,
  getWorkoutNameIdIndexDb,
} from "@/lib/ritmofit-db";
import { reportHandledError } from "@/lib/monitoring";
import {
  buildNormalizedNameIndex,
  buildWorkoutComparison,
  resolveExerciseWorkoutId,
  type CompareResult,
  type CompareRow,
  type CompareSideStats,
} from "@/lib/workout-compare";
import type { PostWorkoutSummary } from "@/lib/workout-summary-types";

// Cores dos dois lados do confronto. O "eu" herda o azul do app; o adversário
// usa o roxo do mesmo gradiente, para que as duas colunas sejam distinguíveis
// sem depender de ler o nome.
const ME_COLOR = "#9db8ff";
const THEM_COLOR = "#c9a4ff";
const WIN_BG = "rgba(74,222,128,.14)";
const WIN_BORDER = "rgba(74,222,128,.4)";
const WIN_COLOR = "#7ee2a8";

/** "12kg × 10" (força) ou "5,2km" (cardio) — o número grande de cada coluna. */
function headlineOf(stats: CompareSideStats, isCardio: boolean): string {
  if (isCardio) {
    if (stats.km > 0) return `${formatCardioKm(stats.km)}km`;
    if (stats.minutes > 0) return formatCardioMinutes(stats.minutes);
    return "—";
  }
  const best = stats.bestSet;
  if (!best) return "—";
  if (best.kg > 0 && best.reps > 0) return `${best.kg}kg × ${best.reps}`;
  if (best.kg > 0) return `${best.kg}kg`;
  if (best.reps > 0) return `${best.reps}×`;
  return "—";
}

/** Linha pequena embaixo do número grande: séries + volume (ou tempo, no cardio). */
function subtitleOf(stats: CompareSideStats, isCardio: boolean, seriesLabel: string): string {
  if (isCardio) {
    return stats.minutes > 0 ? formatCardioMinutes(stats.minutes) : "—";
  }
  const parts = [`${stats.sets} ${seriesLabel}`];
  if (stats.volume > 0) parts.push(`${Math.round(stats.volume).toLocaleString()}kg`);
  return parts.join(" · ");
}

/** Miniatura do exercício — mesmo tratamento do drawer de detalhe do treino. */
function ExerciseThumb({ photo, name, muscleGroup }: {
  photo: string | null; name: string; muscleGroup: string | null;
}) {
  const [err, setErr] = React.useState(false);
  React.useEffect(() => setErr(false), [photo]);
  if (photo && !err) {
    return (
      <div
        className="h-9 w-9 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
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
    <ExerciseImage photo={null} name={name} muscleGroup={muscleGroup} className="h-9 w-9 rounded-lg" />
  );
}

/** Uma das duas colunas do confronto. Vence = fundo verde + borda. */
function CompareColumn({
  stats,
  isCardio,
  isWinner,
  color,
  seriesLabel,
}: {
  stats: CompareSideStats;
  isCardio: boolean;
  isWinner: boolean;
  color: string;
  seriesLabel: string;
}) {
  return (
    <div
      className="flex-1 min-w-0 rounded-xl px-2.5 py-2 text-center"
      style={
        isWinner
          ? { background: WIN_BG, border: `1px solid ${WIN_BORDER}` }
          : { background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }
      }
    >
      <div
        className="text-[15px] font-bold leading-tight truncate"
        style={{ color: isWinner ? WIN_COLOR : color }}
      >
        {headlineOf(stats, isCardio)}
      </div>
      <div className="text-[10.5px] text-white/45 mt-0.5 truncate">
        {subtitleOf(stats, isCardio, seriesLabel)}
      </div>
    </div>
  );
}

/** Um exercício = cabeçalho (miniatura + nome + veredito) e as duas colunas. */
function CompareExerciseCard({ row, themLabel }: { row: CompareRow; themLabel: string }) {
  const { t } = useLanguage();
  const seriesLabel = t("compare_series_short");

  const verdict = (() => {
    if (!row.me) return null;
    if (row.winner === "tie") {
      return { icon: <Minus className="h-3 w-3" />, label: t("compare_tie"), color: "#ffd479", bg: "rgba(255,212,121,.14)" };
    }
    const won = row.winner === "me";
    // `delta` só vem preenchido quando a CARGA (ou a distância) decidiu — num
    // desempate por volume o chip vira só "venceu", sem número enganoso.
    const unit = row.isCardio ? "km" : "kg";
    const deltaLabel = row.delta > 0
      ? `+${row.isCardio ? formatCardioKm(row.delta) : row.delta}${unit}`
      : t("compare_won");
    return {
      icon: <Trophy className="h-3 w-3" />,
      label: `${won ? t("compare_you") : themLabel} ${deltaLabel}`,
      color: won ? WIN_COLOR : THEM_COLOR,
      bg: won ? WIN_BG : "rgba(201,164,255,.14)",
    };
  })();

  return (
    <div className="rounded-2xl p-2.5" style={GLASS_PANEL_STYLE}>
      <div className="flex items-center gap-2.5 mb-2">
        <ExerciseThumb photo={row.photo} name={row.name} muscleGroup={row.muscleGroup} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-white truncate">{row.name}</div>
          {row.muscleGroup && (
            <div className="text-[10.5px] text-white/40 truncate">{row.muscleGroup}</div>
          )}
        </div>
        {verdict && (
          <span
            className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10.5px] font-bold"
            style={{ background: verdict.bg, color: verdict.color }}
          >
            {verdict.icon}
            {verdict.label}
          </span>
        )}
      </div>

      {row.me ? (
        <div className="flex items-stretch gap-2">
          <CompareColumn
            stats={row.them}
            isCardio={row.isCardio}
            isWinner={row.winner === "them"}
            color={THEM_COLOR}
            seriesLabel={seriesLabel}
          />
          <CompareColumn
            stats={row.me}
            isCardio={row.isCardio}
            isWinner={row.winner === "me"}
            color={ME_COLOR}
            seriesLabel={seriesLabel}
          />
        </div>
      ) : (
        // Exercício que eu nunca registrei: mostra só o lado dele, com o convite
        // implícito de experimentar. Um "0kg" no meu lado seria uma derrota
        // falsa — nunca fiz, não é o mesmo que fiz mal.
        <div className="flex items-stretch gap-2">
          <CompareColumn
            stats={row.them}
            isCardio={row.isCardio}
            isWinner={false}
            color={THEM_COLOR}
            seriesLabel={seriesLabel}
          />
          <div
            className="flex-1 min-w-0 rounded-xl px-2.5 py-2 text-center flex flex-col items-center justify-center"
            style={{ background: "rgba(255,255,255,.04)", border: "1px dashed rgba(255,255,255,.14)" }}
          >
            <span className="text-[10.5px] text-white/40 leading-tight">
              {t("compare_never_done")}
            </span>
          </div>
        </div>
      )}

      {/* Quando foi a MINHA sessão — deixa claro que o meu lado é a última vez
          que registrei o exercício, não um recorde de sempre. */}
      {row.myDate && (
        <div className="text-[10px] text-white/30 text-right mt-1.5">
          {t("compare_my_last").replace("{when}", formatTimeAgo(row.myDate))}
        </div>
      )}
    </div>
  );
}

/**
 * Um post é comparável quando carrega exercícios, quem olha está logado e o
 * autor é OUTRA pessoa — comparar comigo mesmo não faz sentido. Exportado para
 * que o drawer "Ver treino" decida se mostra o botão sem duplicar a regra.
 */
export function canCompareWorkout(
  summary: PostWorkoutSummary,
  authorId: string | null | undefined,
  viewerId: string | null | undefined,
): boolean {
  if (!viewerId || !authorId || authorId === viewerId) return false;
  return (summary.exercises?.length ?? 0) > 0;
}

interface WorkoutCompareContentProps {
  /**
   * `true` quando a comparação está VISÍVEL. A leitura de banco só dispara aqui
   * (e uma vez só): o componente é montado junto com o drawer "Ver treino", que
   * abre muito mais vezes do que alguém pede a comparação.
   */
  active: boolean;
  summary: PostWorkoutSummary;
  /** Autor do post — o lado esquerdo do confronto. */
  authorNickname: string | null;
  authorPhoto: string | null;
}

/**
 * Corpo do confronto exercício ↔ exercício entre o treino publicado no post e a
 * última vez que EU fiz cada um daqueles exercícios.
 *
 * O casamento é estrito (mesmo `workout_id` do catálogo, ver
 * `@/lib/workout-compare`): supino reto só compara com supino reto. Exercício
 * que eu nunca registrei não vira derrota — cai na seção "sem comparação".
 *
 * Renderizado DENTRO do drawer "Ver treino" (`workout-detail-dialog`), que
 * troca a lista de exercícios por esta view quando a pessoa toca em "Comparar".
 * Ficar no mesmo sheet evita empilhar dois drawers do vaul — o cabeçalho e a
 * alça de arrastar continuam sendo os do drawer de fora.
 */
export function WorkoutCompareContent({
  active,
  summary,
  authorNickname,
  authorPhoto,
}: WorkoutCompareContentProps) {
  const { t } = useLanguage();
  const { user } = useAuthContext();
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<CompareResult | null>(null);
  const [myPhoto, setMyPhoto] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);
  const loadedRef = React.useRef(false);

  React.useEffect(() => {
    if (!active || loadedRef.current || !user?.id) return;
    loadedRef.current = true;
    let alive = true;

    (async () => {
      setLoading(true);
      setFailed(false);
      try {
        // O índice de nomes só é necessário quando algum exercício do resumo não
        // carrega `workoutId` (posts anteriores a 26/08/2026). Evita baixar o
        // catálogo inteiro no caminho comum.
        const needsNameIndex = (summary.exercises ?? []).some((ex) => !ex.workoutId);
        const nameIndex = needsNameIndex
          ? buildNormalizedNameIndex(await getWorkoutNameIdIndexDb())
          : new Map<string, string>();

        const ids = Array.from(
          new Set(
            (summary.exercises ?? [])
              .map((ex) => resolveExerciseWorkoutId(ex, nameIndex))
              .filter((id): id is string => !!id),
          ),
        );

        const mySessions = ids.length > 0 ? await getLastExerciseSessionsDb(user.id, ids) : {};
        if (!alive) return;
        setResult(buildWorkoutComparison(summary, nameIndex, mySessions));
      } catch (err) {
        if (!alive) return;
        reportHandledError(err, "workout-compare:load");
        setFailed(true);
        loadedRef.current = false; // permite tentar de novo ao reabrir
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [active, user?.id, summary]);

  // Meu avatar para o placar — leitura cacheada do próprio perfil.
  React.useEffect(() => {
    if (!active || !user?.id || myPhoto) return;
    let alive = true;
    getUserProfileDb(user.id)
      .then((p) => { if (alive) setMyPhoto(p?.photo ?? null); })
      .catch(() => { /* avatar é decorativo: sem ele o fallback neutro serve */ });
    return () => { alive = false; };
  }, [active, user?.id, myPhoto]);

  const hasAny = !!result && (result.rows.length > 0 || result.unmatched.length > 0);
  /** Como chamar o outro lado nos chips de veredito. */
  const themLabel = authorNickname ?? t("compare_them");

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-white/50 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("compare_loading")}
      </div>
    );
  }

  if (failed) {
    return <p className="text-center text-sm text-white/50 py-10">{t("compare_error")}</p>;
  }

  if (!result) return null;

  return (
    <>
      {/* Placar: avatar + nome de cada lado e o número de vitórias */}
      <div className="flex items-center gap-3 rounded-2xl px-3 py-3 mb-4" style={GLASS_PANEL_STYLE}>
        <div className="flex flex-col items-center gap-1 w-[34%] min-w-0">
          <UserAvatar photo={authorPhoto} nickname={authorNickname} size="sm" />
          <span className="text-[11px] text-white/60 truncate max-w-full">
            {authorNickname ?? t("compare_them")}
          </span>
        </div>

        <div className="flex-1 text-center">
          <div className="text-[22px] font-extrabold text-white leading-none tracking-tight">
            <span style={{ color: THEM_COLOR }}>{result.theirWins}</span>
            <span className="text-white/30 mx-1.5">×</span>
            <span style={{ color: ME_COLOR }}>{result.myWins}</span>
          </div>
          <div className="text-[10.5px] text-white/40 mt-1">
            {result.ties > 0
              ? t("compare_score_with_ties").replace("{n}", String(result.ties))
              : t("compare_score_label")}
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 w-[34%] min-w-0">
          <UserAvatar photo={myPhoto} nickname={t("compare_you")} size="sm" />
          <span className="text-[11px] text-white/60 truncate max-w-full">{t("compare_you")}</span>
        </div>
      </div>

      {/* Confrontos */}
      {result.rows.length > 0 && (
        <div className="space-y-2 mb-4">
          {result.rows.map((row) => (
            <CompareExerciseCard key={row.workoutId} row={row} themLabel={themLabel} />
          ))}
        </div>
      )}

      {/* Exercícios que eu nunca registrei */}
      {result.unmatched.length > 0 && (
        <>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-white/40 uppercase tracking-wide mb-2">
            <HelpCircle className="h-3.5 w-3.5" />
            {t("compare_no_match_title")}
          </div>
          <div className="space-y-2">
            {result.unmatched.map((row) => (
              <CompareExerciseCard key={row.workoutId} row={row} themLabel={themLabel} />
            ))}
          </div>
        </>
      )}

      {!hasAny && (
        <p className="text-center text-sm text-white/50 py-10 px-6 leading-relaxed">
          {t("compare_empty")}
        </p>
      )}
    </>
  );
}
