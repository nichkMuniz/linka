import type { PostIncentiveType } from "@/lib/ritmofit-db";

type Listener = (type: PostIncentiveType) => void;
const listeners = new Set<Listener>();

export function showIncentiveToast(type: PostIncentiveType) {
  listeners.forEach((l) => l(type));
}

export function subscribeIncentiveToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
