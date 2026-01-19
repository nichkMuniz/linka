export type GoalCategory = "Treino" | "Alimentação" | "Hábito";
export type GoalVisibility = "Público" | "Seguidores";

export type GoalIncentives = {
  apoio: number;
  continua: number;
  orgulho: number;
};

export type GoalIncentiveKey = keyof GoalIncentives;

export type GoalComment = {
  id: string;
  authorName: string;
  authorHandle: string;
  text: string;
  createdAt: string; // ISO
};

export type Goal = {
  id: string;
  ownerName: string;
  ownerHandle: string;
  title: string;
  caption?: string;
  imageDataUrl?: string;
  category: GoalCategory;
  frequency: string;
  durationDays: 7 | 21 | 30;
  visibility: GoalVisibility;
  createdAt: string; // ISO
  completedDays: number;
  incentives: GoalIncentives;
  /** Opcional: rotinas anexadas ao post (ex: treinos salvos). */
  attachedRoutineIds?: string[];
  attachedRoutineTitles?: string[];

  /** Legacy (MVP anterior): manter por compatibilidade. */
  attachedRoutineId?: string;
  attachedRoutineTitle?: string;
  /** MVP: incentivos que o usuário atual já deu (para manter o estado colorido). */
  myIncentives?: Partial<Record<GoalIncentiveKey, boolean>>;
  /** MVP: marca o dia em que o usuário atual atualizou o progresso (para pintar o check de verde). */
  myProgressToday?: string;
  comments?: GoalComment[];
  commentsCount: number;
};

export type StoryItem = {
  id: string;
  imageDataUrl?: string;
  text?: string;
  createdAt: string; // ISO
};

export type StoryGroup = {
  id: string;
  ownerName: string;
  ownerHandle: string;
  items: StoryItem[];
};

export type RoutineStep = {
  id: string;
  title: string;
  detail: string;
  /** Presente principalmente quando category === "Treino" e o usuário escolheu da biblioteca. */
  exerciseId?: string;
  muscleGroup?: string;
  imageUrl?: string;
};

export type Routine = {
  id: string;
  ownerName: string;
  ownerHandle: string;
  title: string;
  description: string;
  category: GoalCategory;
  visibility: GoalVisibility;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  steps: RoutineStep[];
  copiedFromRoutineId?: string;
};

type StorageShape = {
  goals: Goal[];
  blockedHandles: string[];
  stories: StoryGroup[];
  routines: Routine[];
};

const STORAGE_KEY = "ritmofit:v1";
const STORY_TTL_MS = 24 * 60 * 60 * 1000;

function safeParse(raw: string | null): StorageShape | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StorageShape;
  } catch {
    return null;
  }
}

export function uid(prefix = "g") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function defaultImageForGoal(g: Goal) {
  // lightweight deterministic defaults (royalty-free Pexels images)
  if (g.ownerHandle === "@nicholas") {
    return "https://images.pexels.com/photos/28427829/pexels-photo-28427829.jpeg";
  }
  if (g.ownerHandle === "@ana.fit") {
    return "https://images.pexels.com/photos/13896897/pexels-photo-13896897.jpeg";
  }
  if (g.ownerHandle === "@bruno.nutri") {
    return "https://images.pexels.com/photos/33489594/pexels-photo-33489594.jpeg";
  }

  if (g.category === "Treino") {
    return "https://images.pexels.com/photos/841130/pexels-photo-841130.jpeg";
  }
  if (g.category === "Alimentação") {
    return "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg";
  }
  return "https://images.pexels.com/photos/841136/pexels-photo-841136.jpeg";
}

function normalizeGoal(g: Goal): Goal {
  const image = (g.imageDataUrl ?? "").trim();
  const comments = Array.isArray((g as any).comments)
    ? ((g as any).comments as GoalComment[])
    : [];

  const legacyAttachedRoutineId =
    typeof (g as any).attachedRoutineId === "string"
      ? (((g as any).attachedRoutineId as string).trim() || undefined)
      : undefined;

  const legacyAttachedRoutineTitle =
    typeof (g as any).attachedRoutineTitle === "string"
      ? (((g as any).attachedRoutineTitle as string).trim() || undefined)
      : undefined;

  const attachedRoutineIdsRaw = (g as any).attachedRoutineIds;
  const attachedRoutineTitlesRaw = (g as any).attachedRoutineTitles;

  const attachedRoutineIds = Array.isArray(attachedRoutineIdsRaw)
    ? attachedRoutineIdsRaw
        .map((v) => String(v).trim())
        .filter(Boolean)
    : legacyAttachedRoutineId
      ? [legacyAttachedRoutineId]
      : [];

  const attachedRoutineTitles = Array.isArray(attachedRoutineTitlesRaw)
    ? attachedRoutineTitlesRaw
        .map((v) => String(v).trim())
        .filter(Boolean)
    : legacyAttachedRoutineTitle
      ? [legacyAttachedRoutineTitle]
      : [];

  return {
    ...g,
    caption: g.caption ?? "",
    imageDataUrl: image.length ? image : defaultImageForGoal(g),
    incentives: g.incentives ?? { apoio: 0, continua: 0, orgulho: 0 },

    attachedRoutineIds: attachedRoutineIds.length ? attachedRoutineIds : undefined,
    attachedRoutineTitles: attachedRoutineTitles.length ? attachedRoutineTitles : undefined,

    // keep legacy fields populated for older UI paths
    attachedRoutineId: legacyAttachedRoutineId,
    attachedRoutineTitle: legacyAttachedRoutineTitle,

    myIncentives: g.myIncentives ?? {},
    myProgressToday: g.myProgressToday ?? "",
    comments,
    commentsCount:
      typeof g.commentsCount === "number" ? g.commentsCount : comments.length,
    completedDays: g.completedDays ?? 0,
  };
}

function normalizeStoryGroup(raw: StoryGroup): StoryGroup {
  const items = Array.isArray((raw as any).items)
    ? (((raw as any).items as StoryItem[]).filter(Boolean) ?? [])
    : [];

  return {
    id: raw.id ?? uid("sg"),
    ownerName: raw.ownerName ?? "",
    ownerHandle: raw.ownerHandle ?? "",
    items: items.map((it) => ({
      id: it.id ?? uid("s"),
      imageDataUrl: (it.imageDataUrl ?? "").trim() || undefined,
      text: (it.text ?? "").trim() || undefined,
      createdAt: it.createdAt ?? new Date().toISOString(),
    })),
  };
}

function normalizeRoutine(raw: Routine): Routine {
  const steps = Array.isArray((raw as any).steps)
    ? (((raw as any).steps as RoutineStep[]).filter(Boolean) ?? [])
    : [];

  return {
    id: raw.id ?? uid("r"),
    ownerName: raw.ownerName ?? "",
    ownerHandle: raw.ownerHandle ?? "",
    title: raw.title ?? "",
    description: raw.description ?? "",
    category: (raw.category ?? "Treino") as GoalCategory,
    visibility: (raw.visibility ?? "Público") as GoalVisibility,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? raw.createdAt ?? new Date().toISOString(),
    steps: steps.map((s) => ({
      id: s.id ?? uid("rs"),
      title: s.title ?? "",
      detail: s.detail ?? "",
      exerciseId:
        typeof (s as any).exerciseId === "string"
          ? ((s as any).exerciseId as string)
          : undefined,
      muscleGroup:
        typeof (s as any).muscleGroup === "string"
          ? ((s as any).muscleGroup as string)
          : undefined,
      imageUrl:
        typeof (s as any).imageUrl === "string"
          ? ((s as any).imageUrl as string)
          : undefined,
    })),
    copiedFromRoutineId: raw.copiedFromRoutineId,
  };
}

function pruneStories(stories: StoryGroup[]) {
  const now = Date.now();

  const pruned = stories
    .map((g) => {
      const items = (g.items ?? []).filter((it) => {
        const ts = new Date(it.createdAt).getTime();
        if (!Number.isFinite(ts)) return true;
        return now - ts <= STORY_TTL_MS;
      });
      return { ...g, items };
    })
    .filter((g) => g.items.length > 0);

  return pruned;
}

export function getRitmoFitState(): StorageShape {
  const parsed = safeParse(localStorage.getItem(STORAGE_KEY));

  if (parsed) {
    const normalized: StorageShape = {
      goals: Array.isArray((parsed as any).goals)
        ? ((parsed as any).goals as Goal[]).map(normalizeGoal)
        : [],
      blockedHandles: Array.isArray((parsed as any).blockedHandles)
        ? ((parsed as any).blockedHandles as string[])
        : [],
      stories: pruneStories(
        Array.isArray((parsed as any).stories)
          ? ((parsed as any).stories as StoryGroup[]).map(normalizeStoryGroup)
          : [],
      ),
      routines: Array.isArray((parsed as any).routines)
        ? ((parsed as any).routines as Routine[]).map(normalizeRoutine)
        : [],
    };

    // keep storage upgraded (so future reads are consistent)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  const now = new Date();
  const seed: StorageShape = {
    blockedHandles: [],
    stories: [
      {
        id: uid("sg"),
        ownerName: "Nicholas",
        ownerHandle: "@nicholas",
        items: [
          {
            id: uid("s"),
            imageDataUrl:
              "https://images.pexels.com/photos/414029/pexels-photo-414029.jpeg",
            text: "Cardio feito. Sem drama.",
            createdAt: new Date(now.getTime() - 1000 * 60 * 22).toISOString(),
          },
        ],
      },
      {
        id: uid("sg"),
        ownerName: "Ana",
        ownerHandle: "@ana.fit",
        items: [
          {
            id: uid("s"),
            imageDataUrl:
              "https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg",
            text: "Alongamento + mobilidade hoje.",
            createdAt: new Date(now.getTime() - 1000 * 60 * 50).toISOString(),
          },
        ],
      },
      {
        id: uid("sg"),
        ownerName: "Bruno",
        ownerHandle: "@bruno.nutri",
        items: [
          {
            id: uid("s"),
            imageDataUrl:
              "https://images.pexels.com/photos/1640774/pexels-photo-1640774.jpeg",
            text: "Prato de verdade hoje. Simples e consistente.",
            createdAt: new Date(now.getTime() - 1000 * 60 * 90).toISOString(),
          },
        ],
      },
    ],
    routines: [
      {
        id: uid("r"),
        ownerName: "Nicholas",
        ownerHandle: "@nicholas",
        title: "Treino 3x/semana (iniciante)",
        description: "Rotina simples pra ganhar consistência. 45–60 min.",
        category: "Treino",
        visibility: "Público",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        steps: [
          {
            id: uid("rs"),
            title: "Aquecimento (5–8 min)",
            detail: "Caminhada/esteira + mobilidade leve.",
          },
          {
            id: uid("rs"),
            title: "Treino A (superior)",
            detail: "Supino/press + remada + desenvolvimento + tríceps.",
          },
          {
            id: uid("rs"),
            title: "Treino B (inferior)",
            detail: "Agachamento + leg press + stiff + panturrilha.",
          },
        ],
      },
      {
        id: uid("r"),
        ownerName: "Ana",
        ownerHandle: "@ana.fit",
        title: "Hábito: 10k passos", 
        description: "Rotina diária pra manter gasto calórico sem neura.",
        category: "Hábito",
        visibility: "Público",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        steps: [
          {
            id: uid("rs"),
            title: "Manhã (15 min)",
            detail: "Caminhada rápida após o café.",
          },
          {
            id: uid("rs"),
            title: "Tarde (15 min)",
            detail: "Pausa do trabalho: caminhada/escadas.",
          },
          {
            id: uid("rs"),
            title: "Noite (20 min)",
            detail: "Fechar passos com caminhada leve.",
          },
        ],
      },
      {
        id: uid("r"),
        ownerName: "Bruno",
        ownerHandle: "@bruno.nutri",
        title: "Prato equilibrado (almoço)",
        description: "Estrutura simples: proteína + carbo + fibra.",
        category: "Alimentação",
        visibility: "Público",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        steps: [
          {
            id: uid("rs"),
            title: "Proteína", 
            detail: "Frango, ovos, peixe ou carne magra.",
          },
          {
            id: uid("rs"),
            title: "Carbo bom",
            detail: "Arroz, batata, feijão, mandioca ou massa.",
          },
          {
            id: uid("rs"),
            title: "Fibra + água",
            detail: "Salada/legumes e um copo d’água.",
          },
        ],
      },
    ],
    goals: [
      {
        id: uid(),
        ownerName: "Nicholas",
        ownerHandle: "@nicholas",
        title: "Treinar 5x por semana (sem desistir)",
        caption: "Treino de hoje: peito + tríceps. Sem desculpas.",
        imageDataUrl:
          "https://images.pexels.com/photos/28427829/pexels-photo-28427829.jpeg",
        category: "Treino",
        frequency: "5x/semana",
        durationDays: 21,
        visibility: "Público",
        createdAt: now.toISOString(),
        completedDays: 6,
        incentives: { apoio: 12, continua: 8, orgulho: 5 },
        comments: [
          {
            id: uid("c"),
            authorName: "Ana",
            authorHandle: "@ana.fit",
            text: "Brabo! Continua assim 💪",
            createdAt: now.toISOString(),
          },
          {
            id: uid("c"),
            authorName: "Bruno",
            authorHandle: "@bruno.nutri",
            text: "Treino bem feito. Descanso também conta.",
            createdAt: now.toISOString(),
          },
        ],
        commentsCount: 2,
      },
      {
        id: uid(),
        ownerName: "Ana",
        ownerHandle: "@ana.fit",
        title: "Beber 2L de água todos os dias",
        caption: "Meta simples, resultado grande. 2L fechados hoje ✅",
        imageDataUrl:
          "https://images.pexels.com/photos/13896897/pexels-photo-13896897.jpeg",
        category: "Hábito",
        frequency: "Diário",
        durationDays: 30,
        visibility: "Público",
        createdAt: now.toISOString(),
        completedDays: 11,
        incentives: { apoio: 21, continua: 13, orgulho: 10 },
        comments: [
          {
            id: uid("c"),
            authorName: "Você",
            authorHandle: "@voce",
            text: "Isso dá uma diferença enorme no dia.",
            createdAt: now.toISOString(),
          },
        ],
        commentsCount: 1,
      },
      {
        id: uid(),
        ownerName: "Bruno",
        ownerHandle: "@bruno.nutri",
        title: "Montar prato equilibrado no almoço",
        caption: "Proteína + carbo bom + salada. Constância > perfeição.",
        imageDataUrl:
          "https://images.pexels.com/photos/33489594/pexels-photo-33489594.jpeg",
        category: "Alimentação",
        frequency: "Seg–Sex",
        durationDays: 21,
        visibility: "Seguidores",
        createdAt: now.toISOString(),
        completedDays: 8,
        incentives: { apoio: 9, continua: 6, orgulho: 4 },
        comments: [],
        commentsCount: 0,
      },
    ],
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return seed;
}

export function setRitmoFitState(next: StorageShape) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function createGoal(input: {
  ownerName?: string;
  ownerHandle?: string;
  title: string;
  caption?: string;
  imageDataUrl?: string;
  category: GoalCategory;
  frequency: string;
  durationDays: 7 | 21 | 30;
  visibility: GoalVisibility;
  attachedRoutineIds?: string[];
  attachedRoutineTitles?: string[];

  /** Legacy (MVP anterior): manter compatibilidade */
  attachedRoutineId?: string;
  attachedRoutineTitle?: string;
}): Goal {
  const state = getRitmoFitState();

  const createdAt = new Date().toISOString();
  const hasPhoto = Boolean((input.imageDataUrl ?? "").trim());

  const attachedRoutineIds = Array.isArray(input.attachedRoutineIds)
    ? input.attachedRoutineIds.map((v) => String(v).trim()).filter(Boolean)
    : [];

  const attachedRoutineTitles = Array.isArray(input.attachedRoutineTitles)
    ? input.attachedRoutineTitles.map((v) => String(v).trim()).filter(Boolean)
    : [];

  const legacyAttachedRoutineId = (input.attachedRoutineId ?? "").trim() || undefined;
  const legacyAttachedRoutineTitle =
    (input.attachedRoutineTitle ?? "").trim() || undefined;

  const goal: Goal = {
    id: uid(),
    ownerName: input.ownerName ?? "Você",
    ownerHandle: input.ownerHandle ?? "@voce",
    title: input.title,
    caption: input.caption ?? "",
    imageDataUrl: input.imageDataUrl ?? "",
    category: input.category,
    frequency: input.frequency,
    durationDays: input.durationDays,
    visibility: input.visibility,
    createdAt,
    completedDays: hasPhoto ? 1 : 0,
    incentives: { apoio: 0, continua: 0, orgulho: 0 },

    attachedRoutineIds: attachedRoutineIds.length ? attachedRoutineIds : undefined,
    attachedRoutineTitles: attachedRoutineTitles.length ? attachedRoutineTitles : undefined,

    attachedRoutineId: legacyAttachedRoutineId,
    attachedRoutineTitle: legacyAttachedRoutineTitle,

    myIncentives: {},
    myProgressToday: hasPhoto ? todayKey(new Date(createdAt)) : "",
    comments: [],
    commentsCount: 0,
  };

  setRitmoFitState({ ...state, goals: [goal, ...state.goals] });
  return goal;
}

export function updateGoal(goalId: string, updater: (g: Goal) => Goal) {
  const state = getRitmoFitState();
  const next: StorageShape = {
    ...state,
    goals: state.goals.map((g) => (g.id === goalId ? updater(g) : g)),
  };
  setRitmoFitState(next);
  return next;
}

export function addComment(
  goalId: string,
  input: { text: string; authorName?: string; authorHandle?: string },
) {
  const trimmed = input.text.trim();
  if (!trimmed) return getRitmoFitState();

  return updateGoal(goalId, (g) => {
    const nextComment: GoalComment = {
      id: uid("c"),
      authorName: input.authorName ?? "Você",
      authorHandle: input.authorHandle ?? "@voce",
      text: trimmed,
      createdAt: new Date().toISOString(),
    };

    const nextComments = [...(g.comments ?? []), nextComment];

    return {
      ...g,
      comments: nextComments,
      commentsCount: (g.commentsCount ?? 0) + 1,
    };
  });
}

export function isBlocked(ownerHandle: string) {
  const state = getRitmoFitState();
  return state.blockedHandles.includes(ownerHandle);
}

export function blockUser(ownerHandle: string) {
  const state = getRitmoFitState();
  if (state.blockedHandles.includes(ownerHandle)) return state;
  const next: StorageShape = {
    ...state,
    blockedHandles: [...state.blockedHandles, ownerHandle],
  };
  setRitmoFitState(next);
  return next;
}

export function unblockUser(ownerHandle: string) {
  const state = getRitmoFitState();
  if (!state.blockedHandles.includes(ownerHandle)) return state;
  const next: StorageShape = {
    ...state,
    blockedHandles: state.blockedHandles.filter((h) => h !== ownerHandle),
  };
  setRitmoFitState(next);
  return next;
}

export function goalProgressPercent(goal: Goal) {
  const pct = (goal.completedDays / goal.durationDays) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export function dayLabel(n: number) {
  return n === 1 ? "dia" : "dias";
}

function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} d`;
}

export function getStories() {
  const state = getRitmoFitState();
  return state.stories;
}

export function addStoryItem(input: {
  ownerName?: string;
  ownerHandle?: string;
  imageDataUrl?: string;
  text?: string;
}) {
  const state = getRitmoFitState();

  const ownerName = input.ownerName ?? "Você";
  const ownerHandle = input.ownerHandle ?? "@voce";
  const imageDataUrl = (input.imageDataUrl ?? "").trim();
  const text = (input.text ?? "").trim();

  if (!imageDataUrl && !text) return state;

  const nextItem: StoryItem = {
    id: uid("s"),
    imageDataUrl: imageDataUrl || undefined,
    text: text || undefined,
    createdAt: new Date().toISOString(),
  };

  const existing = state.stories.find((g) => g.ownerHandle === ownerHandle);

  let nextStories: StoryGroup[];
  if (existing) {
    nextStories = state.stories.map((g) =>
      g.ownerHandle === ownerHandle
        ? {
            ...g,
            ownerName,
            items: [nextItem, ...g.items],
          }
        : g,
    );
  } else {
    nextStories = [
      {
        id: uid("sg"),
        ownerName,
        ownerHandle,
        items: [nextItem],
      },
      ...state.stories,
    ];
  }

  nextStories = pruneStories(nextStories);

  const next: StorageShape = {
    ...state,
    stories: nextStories,
  };

  setRitmoFitState(next);
  return next;
}

export function deleteStoryItem(ownerHandle: string, storyItemId: string) {
  const state = getRitmoFitState();

  const nextStories = state.stories
    .map((g) =>
      g.ownerHandle !== ownerHandle
        ? g
        : { ...g, items: g.items.filter((it) => it.id !== storyItemId) },
    )
    .filter((g) => g.items.length > 0);

  const next: StorageShape = { ...state, stories: nextStories };
  setRitmoFitState(next);
  return next;
}

export function getRoutines() {
  const state = getRitmoFitState();
  return state.routines;
}

export function createRoutine(input: {
  ownerName?: string;
  ownerHandle?: string;
  title: string;
  description?: string;
  category: GoalCategory;
  visibility: GoalVisibility;
  steps: Array<{
    title: string;
    detail: string;
    exerciseId?: string;
    muscleGroup?: string;
    imageUrl?: string;
  }>;
}): Routine {
  const state = getRitmoFitState();

  const now = new Date().toISOString();

  const routine: Routine = {
    id: uid("r"),
    ownerName: input.ownerName ?? "Você",
    ownerHandle: input.ownerHandle ?? "@voce",
    title: input.title.trim(),
    description: (input.description ?? "").trim(),
    category: input.category,
    visibility: input.visibility,
    createdAt: now,
    updatedAt: now,
    steps: input.steps
      .map((s) => ({
        id: uid("rs"),
        title: s.title.trim(),
        detail: s.detail.trim(),
        exerciseId: s.exerciseId,
        muscleGroup: s.muscleGroup,
        imageUrl: s.imageUrl,
      }))
      .filter((s) => s.title.length || s.detail.length),
  };

  const next: StorageShape = {
    ...state,
    routines: [routine, ...state.routines],
  };

  setRitmoFitState(next);
  return routine;
}

export function updateRoutine(routineId: string, updater: (r: Routine) => Routine) {
  const state = getRitmoFitState();

  const next: StorageShape = {
    ...state,
    routines: state.routines.map((r) => {
      if (r.id !== routineId) return r;
      const updated = updater(r);
      return normalizeRoutine({
        ...updated,
        updatedAt: new Date().toISOString(),
      });
    }),
  };

  setRitmoFitState(next);
  return next;
}

export function deleteRoutine(routineId: string) {
  const state = getRitmoFitState();
  const next: StorageShape = {
    ...state,
    routines: state.routines.filter((r) => r.id !== routineId),
  };
  setRitmoFitState(next);
  return next;
}

export function copyRoutine(
  routineId: string,
  input?: { ownerName?: string; ownerHandle?: string },
) {
  const state = getRitmoFitState();
  const original = state.routines.find((r) => r.id === routineId);
  if (!original) return state;

  const now = new Date().toISOString();

  const copy: Routine = {
    ...original,
    id: uid("r"),
    ownerName: input?.ownerName ?? "Você",
    ownerHandle: input?.ownerHandle ?? "@voce",
    title: `${original.title} (copiada)`,
    createdAt: now,
    updatedAt: now,
    copiedFromRoutineId: original.id,
    steps: original.steps.map((s) => ({ ...s, id: uid("rs") })),
  };

  const next: StorageShape = {
    ...state,
    routines: [copy, ...state.routines],
  };

  setRitmoFitState(next);
  return next;
}

export type MuscleGroup =
  | "Peito"
  | "Costas"
  | "Ombros"
  | "Bíceps"
  | "Tríceps"
  | "Pernas"
  | "Glúteos"
  | "Core"
  | "Cardio";

export type WorkoutExercise = {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  /** URL externa (royalty-free Pexels). */
  imageUrl: string;
  /** Passo a passo simples (MVP). */
  howTo: string[];
  /** Dicas curtas para executar melhor. */
  tips: string[];
  /** Erros comuns para evitar. */
  mistakes: string[];
};

function pexels(url: string, width = 640) {
  const base = url.split("?")[0];
  return `${base}?auto=compress&cs=tinysrgb&w=${width}`;
}

export const WORKOUT_MUSCLE_GROUPS: MuscleGroup[] = [
  "Peito",
  "Costas",
  "Ombros",
  "Bíceps",
  "Tríceps",
  "Pernas",
  "Glúteos",
  "Core",
  "Cardio",
];

export const WORKOUT_EXERCISES: WorkoutExercise[] = [
  {
    id: "supino-reto",
    name: "Supino reto",
    muscleGroup: "Peito",
    imageUrl: pexels(
      "https://images.pexels.com/photos/10518845/pexels-photo-10518845.jpeg",
    ),
    howTo: [
      "Deite no banco com os pés firmes no chão.",
      "Pegue a barra com mãos um pouco mais abertas que os ombros.",
      "Desça a barra controlando até perto do meio do peito.",
      "Empurre para cima mantendo o tronco firme e as escápulas ‘presas’ no banco.",
    ],
    tips: [
      "Pense em ‘peito alto’ e ombros para trás.",
      "Use amplitude controlada: descer com controle vale mais que peso alto.",
    ],
    mistakes: [
      "Quicar a barra no peito.",
      "Deixar o punho dobrar para trás (perde força e sobrecarrega).",
    ],
  },
  {
    id: "supino-inclinado",
    name: "Supino inclinado",
    muscleGroup: "Peito",
    imageUrl: pexels(
      "https://images.pexels.com/photos/10518845/pexels-photo-10518845.jpeg",
    ),
    howTo: [
      "Ajuste o banco em inclinação moderada (não muito alto).",
      "Pés no chão e escápulas encaixadas no banco.",
      "Desça a barra/halteres na linha do alto do peito.",
      "Suba sem perder o controle e sem ‘jogar’ o ombro pra frente.",
    ],
    tips: ["Inclinação exagerada vira ombro.", "Cotovelos levemente fechados ajudam."],
    mistakes: ["Abrir demais os cotovelos.", "Perder a posição das escápulas."],
  },
  {
    id: "crucifixo",
    name: "Crucifixo",
    muscleGroup: "Peito",
    imageUrl: pexels(
      "https://images.pexels.com/photos/11433027/pexels-photo-11433027.jpeg",
    ),
    howTo: [
      "Deite no banco e leve os halteres acima do peito.",
      "Com cotovelos levemente flexionados, abra os braços em arco.",
      "Desça até sentir alongar o peito sem perder o controle.",
      "Feche os braços de volta em arco, espremendo o peito.",
    ],
    tips: ["Cotovelos ‘moles’, não travados.", "Movimento em arco, não reto."],
    mistakes: ["Descer demais e forçar o ombro.", "Transformar em supino (dobrar o braço demais)."],
  },
  {
    id: "flexao",
    name: "Flexão",
    muscleGroup: "Peito",
    imageUrl: pexels(
      "https://images.pexels.com/photos/10360933/pexels-photo-10360933.jpeg",
    ),
    howTo: [
      "Mãos no chão na linha do peito, corpo em prancha.",
      "Desça mantendo barriga firme e cotovelos levemente para trás.",
      "Toque próximo do chão e suba empurrando.",
    ],
    tips: ["Corpo reto (não deixa o quadril cair).", "Comece no joelho se precisar."],
    mistakes: ["Deixar o quadril despencar.", "Abrir cotovelos para os lados demais."],
  },
  {
    id: "crossover",
    name: "Crossover (polia)",
    muscleGroup: "Peito",
    imageUrl: pexels(
      "https://images.pexels.com/photos/11433027/pexels-photo-11433027.jpeg",
    ),
    howTo: [
      "Ajuste as polias e fique com um pé à frente para estabilidade.",
      "Leve as mãos para frente e ‘junte’ na frente do peito.",
      "Volte controlando até sentir alongar o peito.",
    ],
    tips: ["Foco em controle e contração no final.", "Evite balançar o tronco."],
    mistakes: ["Usar impulso do corpo.", "Perder a postura e fechar ombros."],
  },
  {
    id: "puxada-barra",
    name: "Puxada na barra",
    muscleGroup: "Costas",
    imageUrl: pexels(
      "https://images.pexels.com/photos/10518848/pexels-photo-10518848.jpeg",
    ),
    howTo: [
      "Segure a barra e fique com o peito ‘aberto’.",
      "Puxe levando o peito em direção à barra.",
      "Desça controlando até estender os braços.",
    ],
    tips: ["Pense em ‘cotovelo para baixo’.", "Comece com elástico/assistido se necessário."],
    mistakes: ["Balançar o corpo.", "Encolher os ombros durante a puxada."],
  },
  {
    id: "pulldown",
    name: "Puxada na polia (pulldown)",
    muscleGroup: "Costas",
    imageUrl: pexels(
      "https://images.pexels.com/photos/10551484/pexels-photo-10551484.jpeg",
    ),
    howTo: [
      "Sente e ajuste o apoio da coxa.",
      "Puxe a barra até a altura do peito mantendo o tronco firme.",
      "Suba a barra controlando sem ‘soltar’ o peso de uma vez.",
    ],
    tips: ["Comece puxando com as costas, não com o bíceps.", "Peito para cima."],
    mistakes: ["Jogar o corpo para trás.", "Puxar atrás da nuca (desconfortável para muitos)."],
  },
  {
    id: "remada-curvada",
    name: "Remada curvada",
    muscleGroup: "Costas",
    imageUrl: pexels(
      "https://images.pexels.com/photos/9479153/pexels-photo-9479153.jpeg",
    ),
    howTo: [
      "Incline o tronco com a coluna neutra.",
      "Puxe a barra em direção ao abdômen.",
      "Desça controlando sem perder a postura.",
    ],
    tips: ["Barriga firme e costas ‘travadas’.", "Cotovelos perto do corpo."],
    mistakes: ["Arredondar a lombar.", "Usar impulso do quadril."],
  },
  {
    id: "remada-unilateral",
    name: "Remada unilateral (halter)",
    muscleGroup: "Costas",
    imageUrl: pexels(
      "https://images.pexels.com/photos/11433027/pexels-photo-11433027.jpeg",
    ),
    howTo: [
      "Apoie uma mão e um joelho no banco.",
      "Puxe o halter para o quadril.",
      "Desça controlando, mantendo o ombro longe da orelha.",
    ],
    tips: ["Pense em ‘cotovelo para trás’.", "Não gire o tronco."],
    mistakes: ["Rodar o corpo para ajudar.", "Subir o ombro durante a puxada."],
  },
  {
    id: "pullover",
    name: "Pullover",
    muscleGroup: "Costas",
    imageUrl: pexels(
      "https://images.pexels.com/photos/11433027/pexels-photo-11433027.jpeg",
    ),
    howTo: [
      "Deite no banco e segure um halter acima do peito.",
      "Leve o halter para trás com leve flexão de cotovelo.",
      "Volte controlando até acima do peito.",
    ],
    tips: ["Amplitude confortável (sem forçar ombro).", "Costas e core firmes."],
    mistakes: ["Arquear demais a lombar.", "Descer rápido demais."],
  },
  {
    id: "desenvolvimento",
    name: "Desenvolvimento (halteres)",
    muscleGroup: "Ombros",
    imageUrl: pexels(
      "https://images.pexels.com/photos/11433027/pexels-photo-11433027.jpeg",
    ),
    howTo: [
      "Sente com postura alta e core firme.",
      "Suba os halteres acima da cabeça.",
      "Desça controlando até a linha do queixo/orelha.",
    ],
    tips: ["Não deixe as costelas ‘abrirem’.", "Controle na descida faz diferença."],
    mistakes: ["Arquear a lombar para compensar.", "Descer muito abaixo e perder controle."],
  },
  {
    id: "elevacao-lateral",
    name: "Elevação lateral",
    muscleGroup: "Ombros",
    imageUrl: pexels(
      "https://images.pexels.com/photos/11433027/pexels-photo-11433027.jpeg",
    ),
    howTo: [
      "Com cotovelos levemente flexionados, eleve os halteres para o lado.",
      "Suba até a linha do ombro (aprox.).",
      "Desça devagar.",
    ],
    tips: ["Pense em ‘empurrar o chão’ com os pés (estabilidade).", "Carga leve e controle."],
    mistakes: ["Balançar o corpo.", "Subir com trapézio (ombros nas orelhas)."],
  },
  {
    id: "elevacao-frontal",
    name: "Elevação frontal",
    muscleGroup: "Ombros",
    imageUrl: pexels(
      "https://images.pexels.com/photos/11433027/pexels-photo-11433027.jpeg",
    ),
    howTo: [
      "Segure halteres à frente das coxas.",
      "Eleve até a linha do ombro.",
      "Desça controlando.",
    ],
    tips: ["Evite subir acima do ombro.", "Braços com leve flexão."],
    mistakes: ["Usar impulso do tronco.", "Subir demais e irritar o ombro."],
  },
  {
    id: "remada-alta",
    name: "Remada alta",
    muscleGroup: "Ombros",
    imageUrl: pexels(
      "https://images.pexels.com/photos/9479153/pexels-photo-9479153.jpeg",
    ),
    howTo: [
      "Segure a barra/cabo à frente do corpo.",
      "Puxe para cima mantendo a barra perto do corpo.",
      "Desça controlando.",
    ],
    tips: ["Amplitude confortável.", "Cotovelos guiam o movimento."],
    mistakes: ["Abrir demais os cotovelos e sentir dor.", "Fazer rápido e sem controle."],
  },
  {
    id: "rosca-direta",
    name: "Rosca direta",
    muscleGroup: "Bíceps",
    imageUrl: pexels(
      "https://images.pexels.com/photos/9073246/pexels-photo-9073246.jpeg",
    ),
    howTo: [
      "Cotovelos colados ao corpo.",
      "Suba a barra/halter sem balançar.",
      "Desça controlando.",
    ],
    tips: ["Punhos neutros e firmes.", "Controle na descida é metade do bíceps."],
    mistakes: ["Balançar o tronco.", "Deixar cotovelos fugirem para frente."],
  },
  {
    id: "rosca-martelo",
    name: "Rosca martelo",
    muscleGroup: "Bíceps",
    imageUrl: pexels(
      "https://images.pexels.com/photos/9073246/pexels-photo-9073246.jpeg",
    ),
    howTo: [
      "Pegada neutra (polegares para cima).",
      "Suba os halteres sem mexer o cotovelo.",
      "Desça controlando.",
    ],
    tips: ["Ótimo para antebraço também.", "Cotovelos perto do corpo."],
    mistakes: ["Girar o punho demais.", "Usar impulso."],
  },
  {
    id: "rosca-alternada",
    name: "Rosca alternada",
    muscleGroup: "Bíceps",
    imageUrl: pexels(
      "https://images.pexels.com/photos/9073246/pexels-photo-9073246.jpeg",
    ),
    howTo: [
      "Segure dois halteres ao lado do corpo.",
      "Suba um braço de cada vez.",
      "Desça controlando e repita do outro lado.",
    ],
    tips: ["Não ‘roube’ com o ombro.", "Movimento limpo e constante."],
    mistakes: ["Balançar o corpo.", "Subir o cotovelo junto."],
  },
  {
    id: "triceps-corda",
    name: "Tríceps corda",
    muscleGroup: "Tríceps",
    imageUrl: pexels(
      "https://images.pexels.com/photos/4218662/pexels-photo-4218662.jpeg",
    ),
    howTo: [
      "Cotovelos colados ao corpo.",
      "Empurre a corda para baixo até estender.",
      "Volte devagar até perto de 90°.",
    ],
    tips: ["No final, ‘abra’ levemente a corda.", "Tronco firme."],
    mistakes: ["Abrir cotovelos.", "Usar o corpo para empurrar."],
  },
  {
    id: "triceps-testa",
    name: "Tríceps testa",
    muscleGroup: "Tríceps",
    imageUrl: pexels(
      "https://images.pexels.com/photos/4218662/pexels-photo-4218662.jpeg",
    ),
    howTo: [
      "Deite no banco com halteres ou barra.",
      "Flexione o cotovelo levando o peso em direção à testa.",
      "Estenda o cotovelo para voltar.",
    ],
    tips: ["Cotovelos apontando para cima.", "Controle para não forçar o cotovelo."],
    mistakes: ["Abrir cotovelos demais.", "Descer rápido e perder estabilidade."],
  },
  {
    id: "mergulho",
    name: "Mergulho (paralelas)",
    muscleGroup: "Tríceps",
    imageUrl: pexels(
      "https://images.pexels.com/photos/10518845/pexels-photo-10518845.jpeg",
    ),
    howTo: [
      "Apoie as mãos nas barras paralelas.",
      "Desça controlando até o cotovelo dobrar.",
      "Suba empurrando até estender.",
    ],
    tips: ["Tronco mais reto = mais tríceps.", "Se doer ombro, reduza amplitude."],
    mistakes: ["Descer demais e ‘travando’ ombro.", "Balançar o corpo."],
  },
  {
    id: "agachamento",
    name: "Agachamento",
    muscleGroup: "Pernas",
    imageUrl: pexels(
      "https://images.pexels.com/photos/5209197/pexels-photo-5209197.jpeg",
    ),
    howTo: [
      "Pés na largura confortável e tronco firme.",
      "Desça empurrando o quadril para trás e joelhos acompanhando o pé.",
      "Suba empurrando o chão.",
    ],
    tips: ["Comece leve e priorize técnica.", "Olhar no horizonte ajuda postura."],
    mistakes: ["Deixar joelhos ‘cair’ para dentro.", "Arredondar a lombar."],
  },
  {
    id: "leg-press",
    name: "Leg press",
    muscleGroup: "Pernas",
    imageUrl: pexels(
      "https://images.pexels.com/photos/10518845/pexels-photo-10518845.jpeg",
    ),
    howTo: [
      "Posicione os pés na plataforma.",
      "Desça controlando até onde conseguir sem tirar o quadril do assento.",
      "Empurre de volta sem travar os joelhos.",
    ],
    tips: ["Amplitude confortável > peso.", "Não deixe o joelho colapsar."],
    mistakes: ["Tirar o quadril do banco.", "Travar joelhos no topo."],
  },
  {
    id: "cadeira-extensora",
    name: "Cadeira extensora",
    muscleGroup: "Pernas",
    imageUrl: pexels(
      "https://images.pexels.com/photos/10518845/pexels-photo-10518845.jpeg",
    ),
    howTo: [
      "Ajuste o banco e o rolo na canela.",
      "Estenda o joelho até quase travar.",
      "Desça devagar.",
    ],
    tips: ["Segure 1s no topo.", "Movimento controlado."],
    mistakes: ["Chutar (sem controle).", "Peso demais e amplitude curta."],
  },
  {
    id: "cadeira-flexora",
    name: "Cadeira flexora",
    muscleGroup: "Pernas",
    imageUrl: pexels(
      "https://images.pexels.com/photos/10518845/pexels-photo-10518845.jpeg",
    ),
    howTo: [
      "Ajuste o rolo atrás do tornozelo.",
      "Flexione o joelho puxando o rolo.",
      "Volte controlando.",
    ],
    tips: ["Contraia no final.", "Não levante o quadril do banco."],
    mistakes: ["Roubar com quadril.", "Descer rápido demais."],
  },
  {
    id: "stiff",
    name: "Stiff (terra romeno)",
    muscleGroup: "Pernas",
    imageUrl: pexels(
      "https://images.pexels.com/photos/9479153/pexels-photo-9479153.jpeg",
    ),
    howTo: [
      "Segure a barra/halteres e mantenha coluna neutra.",
      "Desça com o quadril para trás, joelhos levemente flexionados.",
      "Suba contraindo posterior e glúteo.",
    ],
    tips: ["Peso perto da perna o tempo todo.", "Amplitude até onde mantém a lombar neutra."],
    mistakes: ["Arredondar as costas.", "Descer só dobrando joelho (vira agachamento)."],
  },
  {
    id: "hip-thrust",
    name: "Hip thrust",
    muscleGroup: "Glúteos",
    imageUrl: pexels(
      "https://images.pexels.com/photos/10518845/pexels-photo-10518845.jpeg",
    ),
    howTo: [
      "Costas altas apoiadas no banco.",
      "Empurre o quadril para cima até alinhar tronco e coxa.",
      "Desça controlando.",
    ],
    tips: ["Queixo levemente recolhido.", "Pausa 1s no topo ajuda."],
    mistakes: ["Subir arqueando lombar.", "Pés longe demais e perder glúteo."],
  },
  {
    id: "afundo",
    name: "Afundo (avanço)",
    muscleGroup: "Glúteos",
    imageUrl: pexels(
      "https://images.pexels.com/photos/5209197/pexels-photo-5209197.jpeg",
    ),
    howTo: [
      "Dê um passo à frente.",
      "Desça até ambos joelhos dobrarem controlando.",
      "Suba empurrando o chão.",
    ],
    tips: ["Tronco firme e joelho alinhado.", "Comece sem peso."],
    mistakes: ["Joelho da frente entrando para dentro.", "Passo curto demais."],
  },
  {
    id: "panturrilha",
    name: "Panturrilha (em pé)",
    muscleGroup: "Pernas",
    imageUrl: pexels(
      "https://images.pexels.com/photos/11241448/pexels-photo-11241448.jpeg",
    ),
    howTo: [
      "Apoie a ponta do pé em um degrau/plataforma.",
      "Suba o calcanhar o máximo que conseguir.",
      "Desça controlando alongando.",
    ],
    tips: ["Pausa 1s em cima e 1s embaixo.", "Não faça ‘pulinhos’."],
    mistakes: ["Amplitude curtinha.", "Subir rápido e sem controle."],
  },
  {
    id: "prancha",
    name: "Prancha",
    muscleGroup: "Core",
    imageUrl: pexels(
      "https://images.pexels.com/photos/28970125/pexels-photo-28970125.jpeg",
    ),
    howTo: [
      "Antebraços no chão e corpo alinhado.",
      "Contraia abdômen e glúteos.",
      "Respire mantendo postura.",
    ],
    tips: ["Pense em ‘encaixar’ o quadril.", "Melhor 20s perfeito do que 1min torto."],
    mistakes: ["Quadril caindo.", "Prender a respiração."],
  },
  {
    id: "abdominal-crunch",
    name: "Abdominal (crunch)",
    muscleGroup: "Core",
    imageUrl: pexels(
      "https://images.pexels.com/photos/16216727/pexels-photo-16216727.jpeg",
    ),
    howTo: [
      "Deite com joelhos flexionados.",
      "Suba o tronco pequeno, tirando as escápulas do chão.",
      "Desça controlando.",
    ],
    tips: ["Olhar para o teto, queixo neutro.", "Movimento curto e controlado."],
    mistakes: ["Puxar o pescoço.", "Subir demais e perder a contração."],
  },
  {
    id: "elevacao-pernas",
    name: "Elevação de pernas",
    muscleGroup: "Core",
    imageUrl: pexels(
      "https://images.pexels.com/photos/16216727/pexels-photo-16216727.jpeg",
    ),
    howTo: [
      "Deite e mantenha a lombar encostada no chão.",
      "Suba e desça as pernas sem perder o controle.",
      "Se precisar, dobre os joelhos.",
    ],
    tips: ["A lombar é a regra: se descolou, reduza amplitude.", "Faça devagar."],
    mistakes: ["Arqueiar a lombar.", "Descer rápido e ‘bater’ no chão."],
  },
  {
    id: "corrida",
    name: "Corrida",
    muscleGroup: "Cardio",
    imageUrl: pexels(
      "https://images.pexels.com/photos/10518848/pexels-photo-10518848.jpeg",
    ),
    howTo: [
      "Comece com aquecimento leve (3–5 min).",
      "Mantenha ritmo em que dá para falar frases curtas.",
      "Finalize com desaceleração e hidratação.",
    ],
    tips: ["Aumente volume aos poucos semana a semana.", "Tênis confortável faz diferença."],
    mistakes: ["Começar rápido demais e morrer no meio.", "Ignorar dor persistente."],
  },
  {
    id: "bicicleta",
    name: "Bicicleta",
    muscleGroup: "Cardio",
    imageUrl: pexels(
      "https://images.pexels.com/photos/10518848/pexels-photo-10518848.jpeg",
    ),
    howTo: [
      "Ajuste o banco para não travar o joelho.",
      "Mantenha cadência estável e postura confortável.",
      "Controle a resistência sem ‘se matar’ no começo.",
    ],
    tips: ["Uma cadência mais alta costuma poupar o joelho.", "Use respiração regular."],
    mistakes: ["Banco muito baixo (sobrecarrega joelho).", "Resistência alta com técnica ruim."],
  },
];

export function findWorkoutExerciseById(exerciseId: string) {
  return WORKOUT_EXERCISES.find((ex) => ex.id === exerciseId) ?? null;
}

export function getWorkoutExercisesByGroup(group: MuscleGroup) {
  return WORKOUT_EXERCISES.filter((ex) => ex.muscleGroup === group);
}
