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

type StorageShape = {
  goals: Goal[];
  blockedHandles: string[];
};

const STORAGE_KEY = "ritmofit:v1";

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
    commentsCount: typeof g.commentsCount === "number" ? g.commentsCount : comments.length,
    completedDays: g.completedDays ?? 0,
  };
}

export function getRitmoFitState(): StorageShape {
  const parsed = safeParse(localStorage.getItem(STORAGE_KEY));
  if (parsed?.goals?.length) {
    const normalized: StorageShape = {
      goals: parsed.goals.map(normalizeGoal),
      blockedHandles: Array.isArray((parsed as any).blockedHandles)
        ? ((parsed as any).blockedHandles as string[])
        : [],
    };
    // keep storage upgraded (so future reads are consistent)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  const seed: StorageShape = {
    blockedHandles: [],
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
        createdAt: new Date().toISOString(),
        completedDays: 6,
        incentives: { apoio: 12, continua: 8, orgulho: 5 },
        comments: [
          {
            id: uid("c"),
            authorName: "Ana",
            authorHandle: "@ana.fit",
            text: "Brabo! Continua assim 💪",
            createdAt: new Date().toISOString(),
          },
          {
            id: uid("c"),
            authorName: "Bruno",
            authorHandle: "@bruno.nutri",
            text: "Treino bem feito. Descanso também conta.",
            createdAt: new Date().toISOString(),
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
        createdAt: new Date().toISOString(),
        completedDays: 11,
        incentives: { apoio: 21, continua: 13, orgulho: 10 },
        comments: [
          {
            id: uid("c"),
            authorName: "Você",
            authorHandle: "@voce",
            text: "Isso dá uma diferença enorme no dia.",
            createdAt: new Date().toISOString(),
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
        createdAt: new Date().toISOString(),
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
