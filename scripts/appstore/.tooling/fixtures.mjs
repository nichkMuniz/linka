// Banco de dados falso servido ao navegador durante a captura.
//
// Nada aqui toca a base real: o Playwright intercepta TODA chamada ao domínio
// do Supabase e responde com estes dados. O app não sabe a diferença — ele
// renderiza as telas de verdade, com os componentes e o CSS de verdade.
//
// Todo dado é fictício por construção. Não existe caminho para dado real.

export const REF = "zymkndqpashqxcvttdlc";

export const ME = "00000000-0000-4000-8000-000000000001";
const DIEGO = "00000000-0000-4000-8000-000000000002";
const CAROL = "00000000-0000-4000-8000-000000000003";

const iso = (minutosAtras) =>
  new Date(Date.now() - minutosAtras * 60000).toISOString();

export const SESSION = (() => {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: "fake.fake.fake",
    refresh_token: "fake",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    user: {
      id: ME,
      aud: "authenticated",
      role: "authenticated",
      email: "marina@exemplo.com",
      email_confirmed_at: "2026-01-01T00:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
      identities: [],
    },
  };
})();

const PROFILES = [
  { id: 1, user_id: ME,    nickname: "Marina Alves", handle: "marina.alves", photo: "https://cdn.exemplo/av1.jpg", cover_photo: null, bio: "Treino 5x por semana. Foco em força.", is_verified: false, is_banned: false, objectives: ["fitness"], gender: "female", height: [168], weight: [62], age: [29], selected_badge_id: null, hide_follow_lists: false, hide_posts_from_non_followers: false },
  { id: 2, user_id: DIEGO, nickname: "Diego Ramos",  handle: "diego.ramos",  photo: "https://cdn.exemplo/av2.jpg", cover_photo: null, bio: "Corredor e amante de leg day.", is_verified: false, is_banned: false, objectives: ["cardio"], gender: "male", height: [180], weight: [78], age: [34], selected_badge_id: null, hide_follow_lists: false, hide_posts_from_non_followers: false },
  { id: 3, user_id: CAROL, nickname: "Carol Nunes",  handle: "carol.nunes",  photo: "https://cdn.exemplo/av3.jpg", cover_photo: null, bio: "Começando agora, sem pressa.", is_verified: false, is_banned: false, objectives: ["fitness"], gender: "female", height: [165], weight: [59], age: [26], selected_badge_id: null, hide_follow_lists: false, hide_posts_from_non_followers: false },
];

const POSTS = [
  {
    id: "p1", user_id: DIEGO, description: "Última série saiu no grito. Semana fechada! 💪",
    photo: "https://cdn.exemplo/post1.jpg", photos: null,
    created_at: iso(125), user_goal_id: null, workout_summary: null,
  },
  {
    id: "p2", user_id: CAROL, description: "Primeiro treino de pernas sem parar no meio. Pequenas vitórias.",
    photo: "https://cdn.exemplo/post2.jpg", photos: null,
    created_at: iso(320), user_goal_id: null, workout_summary: null,
  },
  {
    id: "p3", user_id: ME, description: "Peito e tríceps fechado. Recorde no supino!",
    photo: "https://cdn.exemplo/post3.jpg", photos: null,
    created_at: iso(1400), user_goal_id: null, workout_summary: null,
  },
];

/** Incentivos: tipos 1–6. Volume diferente por post para o feed não ficar chapado. */
const LIKES = (() => {
  const out = [];
  const plano = { p1: [12, 8, 5, 3, 2, 1], p2: [6, 4, 2, 1, 0, 0], p3: [9, 5, 4, 2, 1, 1] };
  let id = 1;
  for (const [postId, contagens] of Object.entries(plano)) {
    contagens.forEach((n, i) => {
      for (let k = 0; k < n; k++) {
        out.push({ id: id++, post_id: postId, type: i + 1, user_id: `u${id}`, created_at: iso(60) });
      }
    });
  }
  return out;
})();

const COMMENTS = [
  { id: "c1", post_id: "p1", user_id: ME,    text: "Monstro!", created_at: iso(100) },
  { id: "c2", post_id: "p1", user_id: CAROL, text: "Inspiração 🔥", created_at: iso(90) },
  { id: "c3", post_id: "p2", user_id: ME,    text: "Isso aí, Carol!", created_at: iso(300) },
];

const FOLLOWING = [
  { id: 1, user_id: ME, following_id: DIEGO, created_at: iso(9000) },
  { id: 2, user_id: ME, following_id: CAROL, created_at: iso(9000) },
];

const FOLLOWERS = [
  { id: 1, user_id: ME, follower_id: DIEGO, created_at: iso(9000) },
  { id: 2, user_id: ME, follower_id: CAROL, created_at: iso(9000) },
];

// ─── Metas ───────────────────────────────────────────────────────────────────

const ROUTINES = [
  { id: 11, user_id: ME, name: "Peito e Tríceps", type: 1, scheduled_time: null, scheduled_days: [1, 4], training_mode: "simple", last_summary: null, created_at: iso(20000) },
  { id: 12, user_id: ME, name: "Costas e Bíceps", type: 1, scheduled_time: null, scheduled_days: [2, 5], training_mode: "simple", last_summary: null, created_at: iso(20000) },
  { id: 13, user_id: ME, name: "Pernas completo", type: 1, scheduled_time: null, scheduled_days: [3], training_mode: "simple", last_summary: null, created_at: iso(20000) },
];

const WORKOUTS_CAT = [
  { id: 101, name: "Supino Reto com Barra", name_eng: "Barbell Bench Press", description: "Deite no banco...", muscle_group: "Peitoral", type: 1, photo: null, created_by_user: false },
  { id: 102, name: "Crucifixo Inclinado",   name_eng: "Incline Fly",        description: "Com halteres...", muscle_group: "Peitoral", type: 1, photo: null, created_by_user: false },
  { id: 103, name: "Tríceps Corda",         name_eng: "Rope Pushdown",      description: "Na polia alta...", muscle_group: "Tríceps", type: 1, photo: null, created_by_user: false },
  { id: 104, name: "Remada Curvada",        name_eng: "Bent Over Row",      description: "Tronco inclinado...", muscle_group: "Costas", type: 1, photo: null, created_by_user: false },
  { id: 105, name: "Agachamento Livre",     name_eng: "Back Squat",         description: "Barra nas costas...", muscle_group: "Pernas", type: 1, photo: null, created_by_user: false },
  { id: 106, name: "Supino Inclinado",      name_eng: "Incline Press",      description: "Banco a 30°...",     muscle_group: "Peitoral", type: 1, photo: null, created_by_user: false },
  { id: 107, name: "Tríceps Francês",       name_eng: "Skull Crusher",      description: "Deitado no banco...", muscle_group: "Tríceps", type: 1, photo: null, created_by_user: false },
  { id: 108, name: "Puxada Frontal",        name_eng: "Lat Pulldown",       description: "Na polia alta...",    muscle_group: "Costas", type: 1, photo: null, created_by_user: false },
  { id: 109, name: "Rosca Direta",          name_eng: "Barbell Curl",       description: "Em pé, barra...",     muscle_group: "Bíceps", type: 1, photo: null, created_by_user: false },
  { id: 110, name: "Rosca Martelo",         name_eng: "Hammer Curl",        description: "Halteres neutros...", muscle_group: "Bíceps", type: 1, photo: null, created_by_user: false },
  { id: 111, name: "Leg Press 45°",         name_eng: "Leg Press",          description: "Pés na plataforma...", muscle_group: "Pernas", type: 1, photo: null, created_by_user: false },
  { id: 112, name: "Cadeira Extensora",     name_eng: "Leg Extension",      description: "Sentado, estenda...", muscle_group: "Pernas", type: 1, photo: null, created_by_user: false },
];

/**
 * `getUserWorkoutsDb` faz
 *   select(... workouts(name, name_eng, photo, description, muscle_group ...))
 * ou seja, o catálogo vem EMBUTIDO na linha. Sem esse objeto o app mostrava
 * "Exercício desconhecido" em toda a sessão de treino.
 *
 * A coluna de descanso também é `time_to_rest`, não `rest_time`.
 */
const uw = (id, workout_id, routine_id, name, series, reps, weight, rest, order_index) => {
  const cat = WORKOUTS_CAT.find((w) => w.id === workout_id);
  return {
    id, user_id: ME, workout_id, routine_id, name,
    series, repetitions: reps, weight,
    time_to_rest: rest,
    order_index,
    scheduled_time: null, scheduled_days: null,
    technique: null, technique_group: null,
    notes: null, is_completed: false, created_at: iso(20000 - order_index),
    workouts: {
      name: cat?.name ?? "Exercício",
      name_eng: cat?.name_eng ?? null,
      photo: null,
      description: cat?.description ?? null,
      description_eng: null,
      muscle_group: cat?.muscle_group ?? null,
      wger_id: null,
      created_by_user: false,
      created_by: null,
    },
  };
};

const USER_WORKOUTS = [
  // Peito e Tríceps
  uw(201, 101, 11, "Peito e Tríceps", 4, 10, 80, 90, 0),
  uw(202, 102, 11, "Peito e Tríceps", 3, 12, 22, 60, 1),
  uw(203, 103, 11, "Peito e Tríceps", 4, 12, 35, 60, 2),
  uw(206, 106, 11, "Peito e Tríceps", 3, 10, 30, 60, 3),
  uw(207, 107, 11, "Peito e Tríceps", 3, 12, 20, 45, 4),
  // Costas e Bíceps
  uw(204, 104, 12, "Costas e Bíceps", 4, 10, 60, 90, 0),
  uw(208, 108, 12, "Costas e Bíceps", 4, 12, 55, 75, 1),
  uw(209, 109, 12, "Costas e Bíceps", 3, 12, 14, 45, 2),
  uw(210, 110, 12, "Costas e Bíceps", 3, 15, 25, 45, 3),
  // Pernas
  uw(205, 105, 13, "Pernas completo", 4, 8, 100, 120, 0),
  uw(211, 111, 13, "Pernas completo", 4, 12, 90, 90, 1),
  uw(212, 112, 13, "Pernas completo", 3, 15, 40, 60, 2),
];

/**
 * Histórico: alimenta "último treino", o progresso semanal do card de rotina e
 * o gráfico de carga. Sem ele a tela mostrava "0 de 3 treinos na semana".
 */
const USER_WORKOUTS_HIST = (() => {
  const out = [];
  let id = 500;
  // Três sessões nesta semana: uma por rotina.
  const sessoes = [
    { uwIds: [201, 202, 203, 206, 207], diasAtras: 1 },
    { uwIds: [204, 208, 209, 210],      diasAtras: 3 },
    { uwIds: [205, 211, 212],           diasAtras: 5 },
    // Semana passada, para o gráfico ter série histórica.
    { uwIds: [201, 202, 203],           diasAtras: 8 },
    { uwIds: [204, 208],                diasAtras: 10 },
  ];
  for (const { uwIds, diasAtras } of sessoes) {
    const d = new Date(Date.now() - diasAtras * 86400000).toISOString();
    for (const uwId of uwIds) {
      out.push({
        id: id++, user_id: ME, user_workout_id: uwId,
        workout_id: 100 + (uwId % 20), date_completed: d,
        series: 4, repetitions: 10, weight: 60 + (uwId % 5) * 8,
        set_kind: "work", created_at: d,
      });
    }
  }
  return out;
})();

/** Check-ins dos últimos 12 dias — alimenta a sequência e o calendário. */
const CHECK_INS = (() => {
  const out = [];
  for (let d = 0; d < 12; d++) {
    const dt = new Date(Date.now() - d * 86400000);
    out.push({
      id: 300 + d,
      user_id: ME,
      check_in_date: dt.toISOString().slice(0, 10),
      created_at: dt.toISOString(),
    });
  }
  return out;
})();

const USER_GOALS = [
  // `goals` embutido reproduz o `select(...goals(description))` do PostgREST —
  // é de lá que a tela tira o NOME da meta.
  { id: 401, user_id: ME, goal_id: 1, perc: 80, quantity: 5,  duration: 7,  type_goal: 1, visibility: 1, days_completed: 4,  is_completed: false, created_at: iso(30000), last_progress_date: null, goals: { description: "Treinar 5× por semana" } },
  { id: 402, user_id: ME, goal_id: 2, perc: 55, quantity: 40, duration: 30, type_goal: 2, visibility: 1, days_completed: 22, is_completed: false, created_at: iso(30000), last_progress_date: null, goals: { description: "Correr 40 km no mês" } },
];

const GOALS = [
  { id: 1, description: "Treinar 5× por semana", description_eng: "Train 5× a week", type_goal: 1 },
  { id: 2, description: "Correr 40 km no mês",   description_eng: "Run 40 km a month", type_goal: 2 },
];

/**
 * Tabela → linhas. O que não estiver aqui devolve `[]`, e o app cai no estado
 * vazio daquela seção — que também é um estado real dele.
 */
export const TABLES = {
  profiles: PROFILES,
  posts: POSTS,
  likes: LIKES,
  comments: COMMENTS,
  following: FOLLOWING,
  followers: FOLLOWERS,
  routines: ROUTINES,
  workouts: WORKOUTS_CAT,
  user_workouts: USER_WORKOUTS,
  check_ins: CHECK_INS,
  user_goals: USER_GOALS,
  user_workouts_hist: USER_WORKOUTS_HIST,
  goals: GOALS,
  // Vazias de propósito: recursos guardados atrás de flag no v1.
  flow: [],
  shots: [],
  promotions: [],
  duel_groups: [],
  user_badges: [],
  badges: [],
  weight_logs: [],
  user_diets: [],
  user_habits: [],
  messages: [],
  notifications: [],
  user_blocks: [],
  post_tags: [],
};
