import * as React from "react";
import { toast } from "@/components/ui/use-toast";
import { useLanguage } from "@/lib/language-context";
import { showWaterGoalToast } from "@/lib/routine-complete-toast";
import {
  getNutritionGoalsDb,
  getWaterLogDb,
  setWaterLogDb,
} from "@/lib/ritmofit-db";

export const WATER_ACCENT = "#4aa8ff";
export const DEFAULT_WATER_TARGET_ML = 2000;
export const WATER_STEPS_ML = [250, 500];

interface UseWaterLogOptions {
  /** Dia a registrar (YYYY-MM-DD local). O diário navega por dias; o Hub usa hoje. */
  date: string;
  /**
   * Alvo já conhecido pelo chamador (o diário carrega as metas de nutrição
   * inteiras). Quando omitido, o hook busca sozinho — é o caso do Hub, que não
   * tem motivo para carregar o resto das metas.
   */
  targetMl?: number | null;
  /** Muda para forçar releitura (ex.: o diário mexeu na água e fechou). */
  refreshToken?: unknown;
  /** Registro concluído — usado para avaliar insígnias de hidratação. */
  onChanged?: () => void;
  /**
   * Celebra ao bater a meta. Quem chama decide, porque só faz sentido no dia
   * corrente — o diário navega por dias passados, e "meta concluída!" ao editar
   * a água de anteontem seria ruído. O Hub sempre registra hoje.
   */
  celebrateOnGoalReached?: boolean;
}

/**
 * Estado da água do dia: leitura, alvo e incremento otimista.
 *
 * Vive fora dos componentes porque o card do diário alimentar e o slide do Hub
 * do Hoje registram a MESMA água — só mudam o layout. Duplicar o
 * otimista/rollback nos dois deixaria os dois fora de sincronia na primeira
 * mudança de regra.
 */
export function useWaterLog({
  date,
  targetMl,
  refreshToken,
  onChanged,
  celebrateOnGoalReached = false,
}: UseWaterLogOptions) {
  const { t } = useLanguage();
  const [water, setWater] = React.useState(0);
  const [ownTarget, setOwnTarget] = React.useState<number | null>(null);

  // `targetMl === undefined` = o chamador não gerencia o alvo; buscamos aqui.
  const managesTarget = targetMl === undefined;

  React.useEffect(() => {
    let alive = true;
    getWaterLogDb(date).then((ml) => {
      if (alive) setWater(ml);
    });
    return () => {
      alive = false;
    };
  }, [date, refreshToken]);

  React.useEffect(() => {
    if (!managesTarget) return;
    let alive = true;
    getNutritionGoalsDb().then((g) => {
      if (alive) setOwnTarget(g?.water_target_ml ?? null);
    });
    return () => {
      alive = false;
    };
  }, [managesTarget, refreshToken]);

  const target =
    (managesTarget ? ownTarget : targetMl) ?? DEFAULT_WATER_TARGET_ML;

  const changeWater = React.useCallback(
    async (deltaMl: number) => {
      const prev = water;
      const next = Math.max(0, water + deltaMl);
      setWater(next); // otimista: o toque no copo precisa responder na hora
      try {
        await setWaterLogDb(date, next);
        // Só no CRUZAMENTO da meta: sem o `prev < target` a celebração se
        // repetiria a cada copo depois de batida.
        if (celebrateOnGoalReached && target > 0 && prev < target && next >= target) {
          showWaterGoalToast(target);
        }
        onChanged?.();
      } catch {
        setWater(prev);
        toast({ title: t("nutrition_error"), variant: "destructive" });
      }
    },
    [water, date, target, celebrateOnGoalReached, onChanged, t],
  );

  return { water, target, changeWater };
}
