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
  return {
    ...g,
    caption: g.caption ?? "",
    imageDataUrl: image.length ? image : defaultImageForGoal(g),
    incentives: g.incentives ?? { apoio: 0, continua: 0, orgulho: 0 },
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
}): Goal {
  const state = getRitmoFitState();

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
    createdAt: new Date().toISOString(),
    completedDays: 0,
    incentives: { apoio: 0, continua: 0, orgulho: 0 },
    myIncentives: {},
    myProgressToday: "",
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
  steps: Array<{ title: string; detail: string }>;
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
