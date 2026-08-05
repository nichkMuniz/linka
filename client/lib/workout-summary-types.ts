// Structured snapshot of a finished workout, persisted on `posts.workout_summary`
// when a "resumo do treino" is shared to the feed. Lets a workout-summary post
// be rendered as a clickable "Ver treino" pill that opens a detail modal with the
// exact exercises / loads (kg) / reps — data that was previously only baked into
// the generated canvas image and lost as structured information.
//
// Kept in its own module (no heavy imports) so it can be shared by the DB layer,
// the feed/profile/post-detail read paths and the display component alike.
// Shape mirrors RoutineLastSummary (client/lib/ritmofit-db.ts) plus per-set
// breakdown (`sets`) and the generated card URL (`imageUrl`) used as the thumbnail.

export type WorkoutSummarySet = {
  kg: number;
  reps: number;
};

export type WorkoutSummaryExercise = {
  name: string;
  muscleGroup: string | null;
  bestKg: number;
  /** Exercise photo URL — rendered as a thumbnail next to the name (may be null). */
  photo?: string | null;
  /** One entry per completed series, in order — powers the "kg × reps" chips. */
  sets: WorkoutSummarySet[];
  /**
   * Exercício de cardio (corrida, bike etc.), decidido na origem via
   * `isCardioExercise(muscleGroup, workoutId)` — inclui a exceção de cardio
   * estacionário, que NÃO é cardio. Quando `true`, cada série codifica
   * **kg = MINUTOS** e **reps = KM** (ver workout-session-dialog), então o chip
   * deve ser "{min}min × {km}km", não "{kg}kg × {reps}". Ausente em snapshots
   * anteriores a 05/08/2026 → tratado como não-cardio (mantém kg×reps).
   */
  isCardio?: boolean;
};

export type PostWorkoutSummary = {
  routineName: string;
  durationSecs: number;
  totalSeries: number;
  totalVolume: number;
  /** URL of the generated summary card (canvas) — also present in the post photos. */
  imageUrl?: string | null;
  exercises: WorkoutSummaryExercise[];
  // `kind` ausente = recorde de carga (snapshots anteriores a 05/08/2026 e
  // todo o modo simplificado). Ver `PrKind` em workout-session-dialog.tsx.
  prExercises?: Array<{
    name: string;
    previousBestKg: number;
    newBestKg: number;
    kind?: "weight" | "reps" | "e1rm";
    previousReps?: number;
    newReps?: number;
    previousE1rm?: number;
    newE1rm?: number;
  }>;
  machinedExercises?: Array<{ name: string; kg: number }>;
  badges?: string[];
};
