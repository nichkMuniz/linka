export type GoalCategory = "Treino" | "Alimentação" | "Hábito";
export type GoalVisibility = "Público" | "Seguidores";

export type GoalIncentives = {
  apoio: number;
  continua: number;
  orgulho: number;
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
  commentsCount: number;
};

type StorageShape = {
  goals: Goal[];
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

function normalizeGoal(g: Goal): Goal {
  return {
    ...g,
    caption: g.caption ?? "",
    imageDataUrl: g.imageDataUrl ?? "",
    incentives: g.incentives ?? { apoio: 0, continua: 0, orgulho: 0 },
    commentsCount: g.commentsCount ?? 0,
    completedDays: g.completedDays ?? 0,
  };
}

export function getRitmoFitState(): StorageShape {
  const parsed = safeParse(localStorage.getItem(STORAGE_KEY));
  if (parsed?.goals?.length) {
    const normalized = { goals: parsed.goals.map(normalizeGoal) };
    // keep storage upgraded (so future reads are consistent)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  const seed: StorageShape = {
    goals: [
      {
        id: uid(),
        ownerName: "Nicholas",
        ownerHandle: "@nicholas",
        title: "Treinar 5x por semana (sem desistir)",
        caption: "Treino de hoje: peito + tríceps. Sem desculpas.",
        imageDataUrl: "https://images.pexels.com/photos/28427829/pexels-photo-28427829.jpeg",
        category: "Treino",
        frequency: "5x/semana",
        durationDays: 21,
        visibility: "Público",
        createdAt: new Date().toISOString(),
        completedDays: 6,
        incentives: { apoio: 12, continua: 8, orgulho: 5 },
        commentsCount: 3,
      },
      {
        id: uid(),
        ownerName: "Ana",
        ownerHandle: "@ana.fit",
        title: "Beber 2L de água todos os dias",
        caption: "Meta simples, resultado grande. 2L fechados hoje ✅",
        imageDataUrl: "https://images.pexels.com/photos/13896897/pexels-photo-13896897.jpeg",
        category: "Hábito",
        frequency: "Diário",
        durationDays: 30,
        visibility: "Público",
        createdAt: new Date().toISOString(),
        completedDays: 11,
        incentives: { apoio: 21, continua: 13, orgulho: 10 },
        commentsCount: 5,
      },
      {
        id: uid(),
        ownerName: "Bruno",
        ownerHandle: "@bruno.nutri",
        title: "Montar prato equilibrado no almoço",
        caption: "Proteína + carbo bom + salada. Constância > perfeição.",
        imageDataUrl: "https://images.pexels.com/photos/33489594/pexels-photo-33489594.jpeg",
        category: "Alimentação",
        frequency: "Seg–Sex",
        durationDays: 21,
        visibility: "Seguidores",
        createdAt: new Date().toISOString(),
        completedDays: 8,
        incentives: { apoio: 9, continua: 6, orgulho: 4 },
        commentsCount: 1,
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
    commentsCount: 0,
  };

  setRitmoFitState({ goals: [goal, ...state.goals] });
  return goal;
}

export function updateGoal(goalId: string, updater: (g: Goal) => Goal) {
  const state = getRitmoFitState();
  const next: StorageShape = {
    goals: state.goals.map((g) => (g.id === goalId ? updater(g) : g)),
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
