import type { StorageShape } from "@/lib/ritmofit";
import { getRitmoFitStateDb } from "@/lib/ritmofit-db";

export async function getFeedState(): Promise<StorageShape> {
  return getRitmoFitStateDb();
}
