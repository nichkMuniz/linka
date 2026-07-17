import type { RoutineTypeCode } from "@/lib/ritmofit-db";

/**
 * Celebrações de conclusão do dia. Mesma mecânica para todas: quem conclui
 * emite, o RoutineCompletedToast (montado uma vez no AppLayout) exibe.
 */
export type RoutineCompletePayload =
  | {
      kind: "routine";
      type: RoutineTypeCode;
      /** null = unnamed group of this type; falls back to the type label in the UI */
      name: string | null;
    }
  | { kind: "water"; targetMl: number };

type Listener = (payload: RoutineCompletePayload) => void;
const listeners = new Set<Listener>();

function emit(payload: RoutineCompletePayload) {
  listeners.forEach((l) => l(payload));
}

export function showRoutineCompleteToast(payload: {
  type: RoutineTypeCode;
  name: string | null;
}) {
  emit({ kind: "routine", ...payload });
}

/** Meta de água do dia batida (emitido pelo useWaterLog, de qualquer tela). */
export function showWaterGoalToast(targetMl: number) {
  emit({ kind: "water", targetMl });
}

export function subscribeRoutineCompleteToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
