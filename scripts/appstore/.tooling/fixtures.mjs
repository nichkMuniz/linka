// Banco de dados falso servido ao navegador durante a captura.
//
// Nada aqui toca a base real: o Playwright intercepta TODA chamada ao domínio
// do Supabase e responde com estes dados. O app não sabe a diferença — ele
// renderiza as telas de verdade, com os componentes e o CSS de verdade.
//
// Todo dado é fictício por construção. Não existe caminho para dado real.

export const REF = "zymkndqpashqxcvttdlc";

export const ME = "00000000-0000-4000-8000-000000000001";
const CAMILA = "00000000-0000-4000-8000-000000000002";
const RAFAEL = "00000000-0000-4000-8000-000000000003";
const DIEGO = "00000000-0000-4000-8000-000000000004";
const LARISSA = "00000000-0000-4000-8000-000000000005";

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

/**
 * A foto de perfil aponta para `/avatar/{iniciais}/{cor}` — o `capture.mjs`
 * intercepta e devolve um PNG com as INICIAIS sobre a cor. O `UserAvatar` do
 * app só conhece URL, então renderiza como foto normal, e o feed ganha o mesmo
 * visual de iniciais do material anterior enviado à Apple.
 */
const av = (iniciais, cor) => `https://cdn.exemplo/avatar/${iniciais}/${cor}.png`;

/** Card de resumo de treino gerado — é o que o app publica como foto do post. */
const card = (slug) => `https://cdn.exemplo/card/${slug}.png`;

const PROFILES = [
  { id: 1, user_id: ME, nickname: "Marina Alves", handle: "marina.alves", photo: av("MA", "e0457b"), cover_photo: null, bio: "Treino 5x por semana. Foco em força.", is_verified: false, is_banned: false, objectives: ["fitness"], gender: "female", height: [168], weight: [62], age: [29], selected_badge_id: null, hide_follow_lists: false, hide_posts_from_non_followers: false },
  { id: 2, user_id: CAMILA, nickname: "Camila Andrade", handle: "camila.andrade", photo: av("CA", "a855f7"), cover_photo: null, bio: "Leg day é todo dia.", is_verified: false, is_banned: false, objectives: ["fitness"], gender: "female", height: [165], weight: [61], age: [27], selected_badge_id: null, hide_follow_lists: false, hide_posts_from_non_followers: false },
  { id: 3, user_id: RAFAEL, nickname: "Rafael Teixeira", handle: "rafael.teixeira", photo: av("RT", "3b82f6"), cover_photo: null, bio: "Costas e bíceps, sempre.", is_verified: false, is_banned: false, objectives: ["fitness"], gender: "male", height: [180], weight: [82], age: [31], selected_badge_id: null, hide_follow_lists: false, hide_posts_from_non_followers: false },
  { id: 4, user_id: DIEGO, nickname: "Diego Farias", handle: "diego.farias", photo: av("DF", "10b981"), cover_photo: null, bio: "Corredor e amante de leg day.", is_verified: false, is_banned: false, objectives: ["cardio"], gender: "male", height: [178], weight: [76], age: [34], selected_badge_id: null, hide_follow_lists: false, hide_posts_from_non_followers: false },
  { id: 5, user_id: LARISSA, nickname: "Larissa Pires", handle: "larissa.pires", photo: av("LP", "f97316"), cover_photo: null, bio: "Começando agora, sem pressa.", is_verified: false, is_banned: false, objectives: ["fitness"], gender: "female", height: [163], weight: [58], age: [25], selected_badge_id: null, hide_follow_lists: false, hide_posts_from_non_followers: false },
];

const resumo = (routineName, durationSecs, totalSeries, volumeKg, exercises) => ({
  routineName,
  durationSecs,
  totalSeries,
  totalVolumeKg: volumeKg,
  exercises,
  imageUrl: null,
});

/**
 * Posts de RESUMO DE TREINO. É o conteúdo que mostra ao revisor da Apple do que
 * o app trata sem ele precisar entrar em nada: carga, séries, volume e duração.
 * `photo` é o card gerado; `workout_summary` traz os mesmos dados estruturados,
 * que é o que o app de fato guarda na coluna.
 */
const POSTS = [
  {
    id: "p1",
    user_id: CAMILA,
    description: "Treino de pernas fechado! Recorde novo no leg press #treino #pernas",
    photo: card("camila-pernas"),
    photos: null,
    created_at: iso(190),
    user_goal_id: null,
    workout_summary: resumo("Pernas completo", 3960, 21, 24400, [
      { name: "Cadeira Extensora", muscleGroup: "Pernas", bestKg: 143, sets: [{ kg: 120, reps: 12 }, { kg: 132, reps: 10 }, { kg: 143, reps: 8 }] },
      { name: "Leg Press 45", muscleGroup: "Pernas", bestKg: 260, sets: [{ kg: 220, reps: 12 }, { kg: 240, reps: 10 }, { kg: 260, reps: 8 }] },
      { name: "Agachamento Livre", muscleGroup: "Pernas", bestKg: 90, sets: [{ kg: 70, reps: 10 }, { kg: 80, reps: 8 }, { kg: 90, reps: 6 }] },
    ]),
  },
  {
    id: "p2",
    user_id: RAFAEL,
    description: "Costas e bíceps concluído. Consistência é tudo #evolucao",
    photo: card("rafael-costas"),
    photos: null,
    created_at: iso(1500),
    user_goal_id: null,
    workout_summary: resumo("Costas e Bíceps", 4020, 18, 19800, [
      { name: "Remada Curvada", muscleGroup: "Costas", bestKg: 70, sets: [{ kg: 60, reps: 10 }, { kg: 65, reps: 10 }, { kg: 70, reps: 8 }] },
      { name: "Puxada Frontal", muscleGroup: "Costas", bestKg: 65, sets: [{ kg: 55, reps: 12 }, { kg: 60, reps: 10 }, { kg: 65, reps: 8 }] },
      { name: "Rosca Direta", muscleGroup: "Bíceps", bestKg: 20, sets: [{ kg: 16, reps: 12 }, { kg: 18, reps: 10 }, { kg: 20, reps: 8 }] },
    ]),
  },
  {
    id: "p0",
    user_id: ME,
    description: "Fechei a semana com 5 treinos. Bora pra próxima! #consistencia",
    photo: card("marina-ombros"),
    photos: null,
    created_at: iso(60),
    user_goal_id: null,
    workout_summary: resumo("Ombros e Core", 3120, 15, 12600, [
      { name: "Desenvolvimento Halteres", muscleGroup: "Ombros", bestKg: 22, sets: [{ kg: 16, reps: 12 }, { kg: 20, reps: 10 }, { kg: 22, reps: 8 }] },
      { name: "Elevação Lateral", muscleGroup: "Ombros", bestKg: 12, sets: [{ kg: 8, reps: 15 }, { kg: 10, reps: 12 }, { kg: 12, reps: 10 }] },
    ]),
  },
  {
    id: "p3",
    user_id: DIEGO,
    description: "Primeira semana inteira sem falhar nenhum treino.",
    photo: card("diego-peito"),
    photos: null,
    created_at: iso(2600),
    user_goal_id: null,
    workout_summary: resumo("Peito e Tríceps", 3300, 16, 15200, [
      { name: "Supino Reto com Barra", muscleGroup: "Peitoral", bestKg: 85, sets: [{ kg: 70, reps: 10 }, { kg: 80, reps: 8 }, { kg: 85, reps: 6 }] },
      { name: "Crucifixo Inclinado", muscleGroup: "Peitoral", bestKg: 24, sets: [{ kg: 20, reps: 12 }, { kg: 22, reps: 10 }, { kg: 24, reps: 8 }] },
    ]),
  },
];

/** Flows ativos (24h) — é o que preenche a barra de círculos no topo do feed. */
const FLOWS = [
  { id: 901, user_id: CAMILA, description: null, media_url: card("flow-1"), poster_url: null, duration_ms: null, background_color: null, text_position: null, text_elements: null, media_transform: null, created_at: iso(120) },
  { id: 902, user_id: RAFAEL, description: null, media_url: card("flow-2"), poster_url: null, duration_ms: null, background_color: null, text_position: null, text_elements: null, media_transform: null, created_at: iso(240) },
  { id: 903, user_id: DIEGO, description: null, media_url: card("flow-3"), poster_url: null, duration_ms: null, background_color: null, text_position: null, text_elements: null, media_transform: null, created_at: iso(400) },
  { id: 904, user_id: LARISSA, description: null, media_url: card("flow-4"), poster_url: null, duration_ms: null, background_color: null, text_position: null, text_elements: null, media_transform: null, created_at: iso(600) },
];

/** Incentivos: tipos 1–6. Volume diferente por post para o feed não ficar chapado. */
const LIKES = (() => {
  const out = [];
  const plano = { p0: [8, 6, 3, 2, 1, 1], p1: [12, 8, 5, 3, 2, 1], p2: [6, 4, 2, 1, 0, 0], p3: [9, 5, 4, 2, 1, 1] };
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
  { id: "c1", post_id: "p1", user_id: ME, text: "Monstro!", created_at: iso(100) },
  { id: "c2", post_id: "p1", user_id: RAFAEL, text: "Inspiração", created_at: iso(90) },
  { id: "c3", post_id: "p1", user_id: DIEGO, text: "Que carga!", created_at: iso(80) },
  { id: "c4", post_id: "p1", user_id: LARISSA, text: "Vamo!", created_at: iso(70) },
  { id: "c5", post_id: "p2", user_id: ME, text: "Isso aí, Rafael!", created_at: iso(300) },
];

const SEGUIDOS = [CAMILA, RAFAEL, DIEGO, LARISSA];
const FOLLOWING = SEGUIDOS.map((id, i) => ({ id: i + 1, user_id: ME, following_id: id, created_at: iso(9000) }));
const FOLLOWERS = SEGUIDOS.map((id, i) => ({ id: i + 1, user_id: ME, follower_id: id, created_at: iso(9000) }));

// ─── Metas ───────────────────────────────────────────────────────────────────

const ROUTINES = [
  { id: 11, user_id: ME, name: "Peito e Tríceps", type: 1, scheduled_time: null, scheduled_days: [1, 4], training_mode: "simple", last_summary: null, created_at: iso(20000) },
  { id: 12, user_id: ME, name: "Costas e Bíceps", type: 1, scheduled_time: null, scheduled_days: [2, 5], training_mode: "simple", last_summary: null, created_at: iso(20000) },
  { id: 13, user_id: ME, name: "Pernas completo", type: 1, scheduled_time: null, scheduled_days: [3], training_mode: "simple", last_summary: null, created_at: iso(20000) },
];

const WORKOUTS_CAT = [
  { id: 101, name: "Supino Reto com Barra", name_eng: "Barbell Bench Press", description: "Deite no banco e empurre a barra.", muscle_group: "Peitoral", type: 1, photo: null, created_by_user: false },
  { id: 102, name: "Crucifixo Inclinado", name_eng: "Incline Fly", description: "Abra os bracos com halteres.", muscle_group: "Peitoral", type: 1, photo: null, created_by_user: false },
  { id: 103, name: "Tríceps Corda", name_eng: "Rope Pushdown", description: "Estenda os cotovelos na polia.", muscle_group: "Tríceps", type: 1, photo: null, created_by_user: false },
  { id: 104, name: "Remada Curvada", name_eng: "Bent Over Row", description: "Puxe a barra com o tronco inclinado.", muscle_group: "Costas", type: 1, photo: null, created_by_user: false },
  { id: 105, name: "Agachamento Livre", name_eng: "Back Squat", description: "Agache com a barra nas costas.", muscle_group: "Pernas", type: 1, photo: null, created_by_user: false },
  { id: 106, name: "Supino Inclinado", name_eng: "Incline Press", description: "Banco a 30 graus.", muscle_group: "Peitoral", type: 1, photo: null, created_by_user: false },
  { id: 107, name: "Tríceps Francês", name_eng: "Skull Crusher", description: "Deitado, flexione os cotovelos.", muscle_group: "Tríceps", type: 1, photo: null, created_by_user: false },
  { id: 108, name: "Puxada Frontal", name_eng: "Lat Pulldown", description: "Puxe a barra ate o peito.", muscle_group: "Costas", type: 1, photo: null, created_by_user: false },
  { id: 109, name: "Rosca Direta", name_eng: "Barbell Curl", description: "Flexione os cotovelos em pe.", muscle_group: "Bíceps", type: 1, photo: null, created_by_user: false },
  { id: 110, name: "Rosca Martelo", name_eng: "Hammer Curl", description: "Halteres em pegada neutra.", muscle_group: "Bíceps", type: 1, photo: null, created_by_user: false },
  { id: 111, name: "Leg Press 45", name_eng: "Leg Press", description: "Empurre a plataforma com as pernas.", muscle_group: "Pernas", type: 1, photo: null, created_by_user: false },
  { id: 112, name: "Cadeira Extensora", name_eng: "Leg Extension", description: "Estenda os joelhos sentado.", muscle_group: "Pernas", type: 1, photo: null, created_by_user: false },
];

/**
 * `getUserWorkoutsDb` faz `select(... workouts(name, name_eng, ...))`, ou seja,
 * o catálogo vem EMBUTIDO na linha. Sem esse objeto o app mostrava "Exercício
 * desconhecido" em toda a sessão de treino. A coluna de descanso também é
 * `time_to_rest`, não `rest_time`.
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
  uw(201, 101, 11, "Peito e Tríceps", 4, 10, 80, 90, 0),
  uw(202, 102, 11, "Peito e Tríceps", 3, 12, 22, 60, 1),
  uw(203, 103, 11, "Peito e Tríceps", 4, 12, 35, 60, 2),
  uw(206, 106, 11, "Peito e Tríceps", 3, 10, 30, 60, 3),
  uw(207, 107, 11, "Peito e Tríceps", 3, 12, 20, 45, 4),
  uw(204, 104, 12, "Costas e Bíceps", 4, 10, 60, 90, 0),
  uw(208, 108, 12, "Costas e Bíceps", 4, 12, 55, 75, 1),
  uw(209, 109, 12, "Costas e Bíceps", 3, 12, 14, 45, 2),
  uw(210, 110, 12, "Costas e Bíceps", 3, 15, 25, 45, 3),
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
  const sessoes = [
    { uwIds: [201, 202, 203, 206, 207], diasAtras: 1 },
    { uwIds: [204, 208, 209, 210], diasAtras: 3 },
    { uwIds: [205, 211, 212], diasAtras: 5 },
    { uwIds: [201, 202, 203], diasAtras: 8 },
    { uwIds: [204, 208], diasAtras: 10 },
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
    out.push({ id: 300 + d, user_id: ME, check_in_date: dt.toISOString().slice(0, 10), created_at: dt.toISOString() });
  }
  return out;
})();

/**
 * `goals` vem EMBUTIDO — reproduz o `select(... goals(description))` do
 * PostgREST. É de lá que a tela tira o NOME da meta; sem isso aparecia só o
 * "4/7 dias".
 */
const USER_GOALS = [
  { id: 401, user_id: ME, goal_id: 1, perc: 80, quantity: 5, duration: 7, type_goal: 1, visibility: 1, days_completed: 4, is_completed: false, created_at: iso(30000), last_progress_date: null, goals: { description: "Treinar 5× por semana" } },
  { id: 402, user_id: ME, goal_id: 2, perc: 55, quantity: 40, duration: 30, type_goal: 2, visibility: 1, days_completed: 22, is_completed: false, created_at: iso(30000), last_progress_date: null, goals: { description: "Correr 40 km no mês" } },
];

const GOALS = [
  { id: 1, description: "Treinar 5× por semana", description_eng: "Train 5x a week", type_goal: 1 },
  { id: 2, description: "Correr 40 km no mês", description_eng: "Run 40 km a month", type_goal: 2 },
];

/**
 * Tabela → linhas. O que não estiver aqui devolve `[]`, e o app cai no estado
 * vazio daquela seção — que também é um estado real dele.
 */
export const TABLES = {
  profiles: PROFILES,
  posts: POSTS,
  flow: FLOWS,
  likes: LIKES,
  comments: COMMENTS,
  following: FOLLOWING,
  followers: FOLLOWERS,
  routines: ROUTINES,
  workouts: WORKOUTS_CAT,
  user_workouts: USER_WORKOUTS,
  user_workouts_hist: USER_WORKOUTS_HIST,
  check_ins: CHECK_INS,
  user_goals: USER_GOALS,
  goals: GOALS,
  // Vazias de propósito: recursos guardados atrás de flag no v1.
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
