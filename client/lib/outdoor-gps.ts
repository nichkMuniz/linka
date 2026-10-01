// Atividades ao ar livre com GPS (modo "Strava" do treino).
//
// Só dois exercícios do catálogo ganham o painel de GPS: "Corrida ao Ar Livre"
// e "Caminhada ao Ar Livre" (2026-10-01). O `workoutName` chega localizado
// (`pickLocalized`), então a detecção casa os nomes PT e EN, normalizados.
//
// `FEATURES.gpsRun` desligada faz `outdoorGpsKind` devolver null para todo
// mundo: o painel nunca monta e o run-tracker jamais é iniciado.

import { FEATURES } from "@/lib/feature-flags";
import type { TranslationKey } from "@/lib/i18n";

export type OutdoorGpsKind = "run" | "walk";

const GPS_NAMES: Record<string, OutdoorGpsKind> = {
  "corrida ao ar livre": "run",
  "outdoor running": "run",
  "caminhada ao ar livre": "walk",
  "outdoor walking": "walk",
};

function normalizeName(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** "run" | "walk" quando o exercício usa o GPS; null nos demais. */
export function outdoorGpsKind(name?: string | null): OutdoorGpsKind | null {
  if (!FEATURES.gpsRun || !name) return null;
  return GPS_NAMES[normalizeName(name)] ?? null;
}

// Textos que dizem "corrida": a caminhada tem a própria versão. Os neutros
// (Distância, Tempo, Ritmo, Parciais por km, GPS ativo…) são compartilhados.
const WALK_KEYS: Partial<Record<TranslationKey, TranslationKey>> = {
  goals_run_start: "goals_walk_start",
  goals_run_paused_label: "goals_walk_paused_label",
  goals_run_finish: "goals_walk_finish",
  goals_run_bg_hint: "goals_walk_bg_hint",
  goals_run_bg_notif_title: "goals_walk_bg_notif_title",
  goals_run_bg_notif_body: "goals_walk_bg_notif_body",
  goals_run_view: "goals_walk_view",
  goals_run_close: "goals_walk_close",
  goals_run_done_title: "goals_walk_done_title",
  goals_run_section_title: "goals_walk_section_title",
};

/** Chave do texto para a atividade: a versão de caminhada quando existe. */
export function gpsTextKey(kind: OutdoorGpsKind | null | undefined, runKey: TranslationKey): TranslationKey {
  return kind === "walk" ? (WALK_KEYS[runKey] ?? runKey) : runKey;
}
