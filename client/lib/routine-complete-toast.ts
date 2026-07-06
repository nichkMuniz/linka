import type { RoutineTypeCode } from "@/lib/ritmofit-db";

export type RoutineCompletePayload = {
  type: RoutineTypeCode;
  /** null = unnamed group of this type; falls back to the type label in the UI */
  name: string | null;
};

type Listener = (payload: RoutineCompletePayload) => void;
const listeners = new Set<Listener>();

export function showRoutineCompleteToast(payload: RoutineCompletePayload) {
  listeners.forEach((l) => l(payload));
}

export function subscribeRoutineCompleteToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
