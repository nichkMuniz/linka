import * as React from "react";
import { MuscleMap, buildMuscleIntensity, type MuscleMapView } from "@/components/shared/muscle-map";
import { useLanguage } from "@/lib/language-context";
import { getWorkoutMusclesDb, type WorkoutMuscle } from "@/lib/ritmofit-db";

/**
 * Ficha de anatomia de um exercício: mapa corporal + lista dos músculos
 * recrutados com papel e ênfase.
 *
 * Responde a pergunta que o `muscle_group` sozinho nunca respondeu — não
 * "peito", mas *"peitoral superior (clavicular) 85, deltoide anterior 45"*.
 *
 * Carrega sob demanda (só quando o exercício é aberto) e **não renderiza nada**
 * quando o exercício não tem anatomia mapeada: nem título, nem estado vazio.
 * Exercício de alongamento é pulado de propósito pelo seed, e um "nenhum
 * músculo encontrado" ali seria ruído, não informação.
 */

interface ExerciseAnatomyProps {
  /** `workouts.id` — quando ausente/vazio, o componente não renderiza. */
  workoutId?: string | null;
}

/** Corte dos rótulos. Espelha os cortes de cor do `MuscleMap`. */
function roleLabelKey(m: WorkoutMuscle): "primary" | "secondary" | "stabilizer" {
  return m.role;
}

export function ExerciseAnatomy({ workoutId }: ExerciseAnatomyProps) {
  const { t } = useLanguage();
  const [muscles, setMuscles] = React.useState<WorkoutMuscle[] | null>(null);
  // Vista escolhida pelo usuário; `null` = automática (a que tem mais estímulo).
  const [pickedView, setPickedView] = React.useState<MuscleMapView | null>(null);

  React.useEffect(() => {
    let alive = true;
    setMuscles(null);
    setPickedView(null);
    if (!workoutId) return;
    getWorkoutMusclesDb(workoutId)
      .then((rows) => { if (alive) setMuscles(rows); })
      .catch(() => { if (alive) setMuscles([]); });
    return () => { alive = false; };
  }, [workoutId]);

  const intensity = React.useMemo(
    () => buildMuscleIntensity(muscles ?? []),
    [muscles],
  );

  // Vista padrão = a que concentra mais estímulo. Abrir "Puxada na frente" na
  // vista frontal (onde não acende quase nada) faria o mapa parecer quebrado.
  const autoView: MuscleMapView = React.useMemo(() => {
    let front = 0, back = 0;
    for (const m of muscles ?? []) {
      if (m.view === "back") back = Math.max(back, m.emphasis);
      else front = Math.max(front, m.emphasis);
    }
    return back > front ? "back" : "front";
  }, [muscles]);

  const view = pickedView ?? autoView;

  if (!workoutId || !muscles || muscles.length === 0) return null;

  const primary = muscles.filter((m) => m.role === "primary");
  const others = muscles.filter((m) => m.role !== "primary");

  const row = (m: WorkoutMuscle) => (
    <div key={m.id} className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium truncate" style={{ color: "rgba(255,255,255,.88)" }}>
          {m.name}
        </p>
        {/* Barra de ênfase: a leitura rápida de "quanto pega aqui". */}
        <div
          className="mt-1 h-1 rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,.08)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(4, m.emphasis)}%`,
              background: m.role === "primary" ? "#f97316" : "rgba(249,115,22,.45)",
            }}
          />
        </div>
      </div>
      <span
        className="text-[10px] font-bold uppercase tracking-wide shrink-0"
        style={{ color: m.role === "primary" ? "#fb923c" : "rgba(255,255,255,.35)" }}
      >
        {t(
          roleLabelKey(m) === "primary"
            ? "goals_muscle_role_primary"
            : roleLabelKey(m) === "secondary"
              ? "goals_muscle_role_secondary"
              : "goals_muscle_role_stabilizer",
        )}
      </span>
    </div>
  );

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{t("goals_anatomy_title")}</h3>
        {/* Alternador frente/costas — o mapa mostra uma vista por vez. */}
        <div
          className="flex gap-0.5 p-0.5 rounded-full"
          style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}
        >
          {(["front", "back"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setPickedView(v)}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
              style={view === v
                ? { background: "rgba(255,255,255,.9)", color: "#0a0b12" }
                : { color: "rgba(255,255,255,.55)" }}
            >
              {t(v === "front" ? "goals_anatomy_front" : "goals_anatomy_back")}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 items-start">
        <MuscleMap intensity={intensity} view={view} width={92} />
        <div className="flex-1 min-w-0 space-y-2.5 pt-1">
          {primary.map(row)}
          {others.length > 0 && (
            <div className="space-y-2.5 pt-0.5">{others.map(row)}</div>
          )}
        </div>
      </div>
    </div>
  );
}
