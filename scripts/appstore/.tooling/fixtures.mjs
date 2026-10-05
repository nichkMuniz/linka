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
  // Fora das rotinas: só aparecem no histórico, para a cobertura muscular ter
  // ombro/abdômen na semana e panturrilha/posterior como lacuna antiga.
  { id: 113, name: "Elevação Lateral", name_eng: "Lateral Raise", description: "Eleve os halteres até a linha do ombro.", muscle_group: "Ombros", type: 1, photo: null, created_by_user: false },
  { id: 114, name: "Abdominal Supra", name_eng: "Crunch", description: "Flexione o tronco deitado.", muscle_group: "Abdômen", type: 1, photo: null, created_by_user: false },
  { id: 115, name: "Panturrilha em Pé", name_eng: "Standing Calf Raise", description: "Suba na ponta dos pés.", muscle_group: "Panturrilha", type: 1, photo: null, created_by_user: false },
  { id: 116, name: "Stiff", name_eng: "Stiff-Leg Deadlift", description: "Desça a barra com as pernas quase estendidas.", muscle_group: "Pernas", type: 1, photo: null, created_by_user: false },
];

// ─── Anatomia (cobertura muscular) ───────────────────────────────────────────

/** Mesmo catálogo de `docs/migrations/20260805-muscle-anatomy.sql`. */
const MUSCLES = [
  ["peitoral_clavicular", "Peito", "Peitoral superior (clavicular)", "Upper chest (clavicular)", "chest", "front", 10],
  ["peitoral_esternal", "Peito", "Peitoral médio (esternal)", "Mid chest (sternal)", "chest", "front", 20],
  ["peitoral_abdominal", "Peito", "Peitoral inferior (abdominal)", "Lower chest (abdominal)", "chest", "front", 30],
  ["serratil_anterior", "Peito", "Serrátil anterior", "Serratus anterior", "chest", "front", 40],
  ["latissimo_dorsal", "Costas", "Grande dorsal (latíssimo)", "Latissimus dorsi", "lats", "back", 10],
  ["redondo_maior", "Costas", "Redondo maior", "Teres major", "lats", "back", 20],
  ["trapezio_superior", "Costas", "Trapézio superior", "Upper trapezius", "traps", "back", 30],
  ["trapezio_medio", "Costas", "Trapézio médio", "Mid trapezius", "traps", "back", 40],
  ["trapezio_inferior", "Costas", "Trapézio inferior", "Lower trapezius", "traps", "back", 50],
  ["romboides", "Costas", "Romboides", "Rhomboids", "traps", "back", 60],
  ["eretores_espinha", "Costas", "Eretores da espinha (lombar)", "Erector spinae", "lower_back", "back", 70],
  ["deltoide_anterior", "Ombros", "Deltoide anterior", "Front delt", "shoulders_front", "front", 10],
  ["deltoide_lateral", "Ombros", "Deltoide lateral", "Side delt", "shoulders_front", "front", 20],
  ["deltoide_posterior", "Ombros", "Deltoide posterior", "Rear delt", "shoulders_rear", "back", 30],
  ["manguito_rotador", "Ombros", "Manguito rotador", "Rotator cuff", "shoulders_rear", "back", 40],
  ["biceps_cabeca_longa", "Bíceps", "Bíceps — cabeça longa", "Biceps long head", "biceps", "front", 10],
  ["biceps_cabeca_curta", "Bíceps", "Bíceps — cabeça curta", "Biceps short head", "biceps", "front", 20],
  ["braquial", "Bíceps", "Braquial", "Brachialis", "biceps", "front", 30],
  ["triceps_cabeca_longa", "Tríceps", "Tríceps — cabeça longa", "Triceps long head", "triceps", "back", 10],
  ["triceps_cabeca_lateral", "Tríceps", "Tríceps — cabeça lateral", "Triceps lateral head", "triceps", "back", 20],
  ["triceps_cabeca_medial", "Tríceps", "Tríceps — cabeça medial", "Triceps medial head", "triceps", "back", 30],
  ["flexores_antebraco", "Antebraço", "Flexores do antebraço", "Forearm flexors", "forearms", "front", 10],
  ["braquiorradial", "Antebraço", "Braquiorradial", "Brachioradialis", "forearms", "front", 30],
  ["quadriceps_reto_femoral", "Pernas", "Quadríceps — reto femoral", "Rectus femoris", "quads", "front", 10],
  ["quadriceps_vasto_lateral", "Pernas", "Quadríceps — vasto lateral", "Vastus lateralis", "quads", "front", 20],
  ["quadriceps_vasto_medial", "Pernas", "Quadríceps — vasto medial", "Vastus medialis", "quads", "front", 30],
  ["isquiotibiais", "Pernas", "Isquiotibiais", "Hamstrings", "hamstrings", "back", 40],
  ["gluteo_maximo", "Pernas", "Glúteo máximo", "Gluteus maximus", "glutes", "back", 50],
  ["adutores", "Pernas", "Adutores", "Adductors", "adductors", "front", 70],
  ["gastrocnemio", "Panturrilha", "Gastrocnêmio", "Gastrocnemius", "calves", "back", 10],
  ["soleo", "Panturrilha", "Sóleo", "Soleus", "calves", "back", 20],
  ["reto_abdominal_superior", "Abdômen", "Reto abdominal superior", "Upper abs", "abs", "front", 10],
  ["reto_abdominal_inferior", "Abdômen", "Reto abdominal inferior", "Lower abs", "abs", "front", 20],
  ["obliquos", "Abdômen", "Oblíquos", "Obliques", "obliques", "front", 30],
].map(([id, group_name, name, name_eng, body_part, view, sort_order]) => ({
  id, group_name, name, name_eng, region: null, body_part, view, sort_order,
}));

/** Exercício → músculos com ênfase (0–100), como o seed da anatomia grava. */
const WORKOUT_MUSCLES = Object.entries({
  101: { peitoral_esternal: 100, peitoral_clavicular: 60, deltoide_anterior: 50, triceps_cabeca_lateral: 50, triceps_cabeca_medial: 40 },
  102: { peitoral_clavicular: 100, peitoral_esternal: 60, deltoide_anterior: 40 },
  103: { triceps_cabeca_lateral: 100, triceps_cabeca_medial: 80, triceps_cabeca_longa: 60 },
  104: { latissimo_dorsal: 100, romboides: 80, trapezio_medio: 70, deltoide_posterior: 50, biceps_cabeca_longa: 40 },
  105: { quadriceps_reto_femoral: 100, quadriceps_vasto_lateral: 90, quadriceps_vasto_medial: 90, gluteo_maximo: 80, adutores: 50, eretores_espinha: 40 },
  106: { peitoral_clavicular: 100, deltoide_anterior: 60, triceps_cabeca_lateral: 40 },
  107: { triceps_cabeca_longa: 100, triceps_cabeca_medial: 70 },
  108: { latissimo_dorsal: 100, redondo_maior: 70, biceps_cabeca_curta: 50, trapezio_inferior: 40 },
  109: { biceps_cabeca_curta: 100, biceps_cabeca_longa: 90, braquial: 60, flexores_antebraco: 30 },
  110: { braquial: 100, braquiorradial: 80, biceps_cabeca_longa: 60 },
  111: { quadriceps_vasto_lateral: 100, quadriceps_vasto_medial: 90, gluteo_maximo: 60, isquiotibiais: 30 },
  112: { quadriceps_reto_femoral: 100, quadriceps_vasto_lateral: 90, quadriceps_vasto_medial: 90 },
  113: { deltoide_lateral: 100, trapezio_superior: 40 },
  114: { reto_abdominal_superior: 100, reto_abdominal_inferior: 60, obliquos: 40 },
  115: { gastrocnemio: 100, soleo: 70 },
  116: { isquiotibiais: 100, gluteo_maximo: 70, eretores_espinha: 50 },
}).flatMap(([workout_id, musculos]) =>
  Object.entries(musculos).map(([muscle_id, emphasis]) => ({
    workout_id: Number(workout_id),
    muscle_id,
    role: emphasis >= 60 ? "primary" : "secondary",
    emphasis,
  })),
);

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
 * Histórico: alimenta "último treino", o progresso semanal do card de rotina,
 * o gráfico de carga e a cobertura muscular. Sem ele a tela mostrava "0 de 3
 * treinos na semana".
 *
 * UMA LINHA POR SÉRIE, como o app grava: a cobertura muscular conta séries
 * efetivas (linhas × ênfase) e lê a carga de `kilos` e as reps de `volume`.
 * `uwId: null` = exercício fora das rotinas (só no histórico).
 */
const USER_WORKOUTS_HIST = (() => {
  const out = [];
  let id = 500;
  const sessoes = [
    // [workout_id, user_workout_id, séries, kg, reps]
    { diasAtras: 1, ex: [[101, 201, 4, 80, 8], [102, 202, 3, 22, 12], [103, 203, 4, 35, 12], [106, 206, 3, 30, 10], [107, 207, 3, 20, 12]] },
    { diasAtras: 2, ex: [[113, null, 4, 10, 15], [114, null, 3, 0, 20]] },
    { diasAtras: 3, ex: [[104, 204, 4, 60, 10], [108, 208, 4, 55, 12], [109, 209, 3, 14, 12], [110, 210, 3, 25, 12]] },
    { diasAtras: 5, ex: [[105, 205, 4, 100, 8], [111, 211, 4, 90, 12], [112, 212, 3, 40, 15]] },
    { diasAtras: 6, ex: [[101, 201, 4, 77.5, 8], [102, 202, 3, 20, 12], [103, 203, 4, 32.5, 12]] },
    { diasAtras: 10, ex: [[104, 204, 4, 57.5, 10], [108, 208, 4, 52.5, 12]] },
    { diasAtras: 12, ex: [[116, null, 4, 60, 10]] },
    { diasAtras: 16, ex: [[115, null, 4, 40, 15]] },
  ];
  for (const { diasAtras, ex } of sessoes) {
    const d = new Date(Date.now() - diasAtras * 86400000).toISOString();
    for (const [workoutId, uwId, series, kg, reps] of ex) {
      for (let s = 0; s < series; s++) {
        out.push({
          id: id++, user_id: ME, user_workout_id: uwId,
          workout_id: workoutId, date_completed: d,
          series: s + 1, repetitions: reps, weight: kg,
          kilos: kg, volume: String(reps),
          set_kind: null, created_at: d,
        });
      }
    }
  }
  return out;
})();

// ─── Desafio de treino ───────────────────────────────────────────────────────

/**
 * Camila desafiou a Marina com o treino de pernas dela. O snapshot leva só a
 * LISTA (sem carga nem reps) — é o que o desafiado vê no modal.
 */
const desafioItem = (workoutId, series) => {
  const cat = WORKOUTS_CAT.find((w) => w.id === workoutId);
  return { workoutId: String(workoutId), name: cat.name, muscleGroup: cat.muscle_group, photo: null, series, isCardio: false };
};
const WORKOUT_CHALLENGES = [
  {
    id: "ch1",
    challenger_id: CAMILA,
    challenged_id: ME,
    routine_name: "Pernas completo",
    snapshot: {
      routineName: "Pernas completo",
      items: [desafioItem(105, 4), desafioItem(111, 4), desafioItem(112, 3), desafioItem(116, 3), desafioItem(115, 4)],
    },
    status: "pending",
    winner: null,
    challenger_score: null,
    challenged_score: null,
    created_at: iso(45),
    expires_at: new Date(Date.now() + 2 * 86400000).toISOString(),
  },
];

// ─── Treinar junto ───────────────────────────────────────────────────────────

/**
 * A party da sessão restaurada em `capture.mjs` (`SEED_PARTY`). Camila acabou
 * de fechar uma série (é a vez dela) e o Rafael está no descanso — é o que a
 * faixa do topo da sessão mostra.
 */
export const PARTY_ID = "party-1";
const emSegundos = (s) => new Date(Date.now() + s * 1000).toISOString();
const WORKOUT_PARTIES = [
  { id: PARTY_ID, host_id: ME, routine_name: "Peito e Tríceps", status: "active", created_at: iso(30) },
];
const WORKOUT_PARTY_MEMBERS = [
  { party_id: PARTY_ID, user_id: ME, role: "host", status: "accepted", progress_done: 1, progress_total: 5, sets_done: 6, volume_kg: 2840, best_kg: 80, current_exercise: "Crucifixo Inclinado", last_set_at: iso(2), rest_ends_at: null, finished_at: null, exercise_stats: null },
  { party_id: PARTY_ID, user_id: CAMILA, role: "guest", status: "accepted", progress_done: 2, progress_total: 5, sets_done: 8, volume_kg: 2410, best_kg: 60, current_exercise: "Crucifixo Inclinado", last_set_at: iso(1), rest_ends_at: null, finished_at: null, exercise_stats: null },
  { party_id: PARTY_ID, user_id: RAFAEL, role: "guest", status: "accepted", progress_done: 1, progress_total: 5, sets_done: 5, volume_kg: 2950, best_kg: 90, current_exercise: "Supino Reto com Barra", last_set_at: iso(1), rest_ends_at: emSegundos(140), finished_at: null, exercise_stats: null },
];

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
const TABLES_PT = {
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
  muscles: MUSCLES,
  workout_muscles: WORKOUT_MUSCLES,
  workout_challenges: WORKOUT_CHALLENGES,
  workout_challenge_results: [],
  workout_parties: WORKOUT_PARTIES,
  workout_party_members: WORKOUT_PARTY_MEMBERS,
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

/**
 * Versão em inglês (`LK_LANG=en`) — para a ficha da loja fora do Brasil.
 * Troca só o CONTEÚDO fictício (legendas, nomes de rotina, bios); a interface
 * sai em inglês sozinha, porque o app roda com o idioma em "en".
 */
const EN_TEXT = {
  "Treino 5x por semana. Foco em força.": "Training 5x a week. Strength first.",
  "Leg day é todo dia.": "Every day is leg day.",
  "Costas e bíceps, sempre.": "Back and biceps, always.",
  "Corredor e amante de leg day.": "Runner and leg day lover.",
  "Começando agora, sem pressa.": "Just getting started, no rush.",
  "Treino de pernas fechado! Recorde novo no leg press #treino #pernas": "Leg day done! New leg press PR #workout #legday",
  "Costas e bíceps concluído. Consistência é tudo #evolucao": "Back and biceps done. Consistency is everything #progress",
  "Fechei a semana com 5 treinos. Bora pra próxima! #consistencia": "Closed the week with 5 workouts. On to the next! #consistency",
  "Primeira semana inteira sem falhar nenhum treino.": "First full week without missing a single workout.",
  "Pernas completo": "Full Legs",
  "Costas e Bíceps": "Back & Biceps",
  "Ombros e Core": "Shoulders & Core",
  "Peito e Tríceps": "Chest & Triceps",
  "Monstro!": "Beast!",
  "Inspiração": "So inspiring",
  "Que carga!": "What a lift!",
  "Vamo!": "Let's go!",
  "Isso aí, Rafael!": "That's it, Rafael!",
  "Treinar 5× por semana": "Train 5x a week",
  "Correr 40 km no mês": "Run 40 km a month",
  "Pernas": "Legs", "Costas": "Back", "Bíceps": "Biceps", "Ombros": "Shoulders",
  "Peitoral": "Chest", "Tríceps": "Triceps",
  "Abdômen": "Abs", "Panturrilha": "Calves",
  // `current_exercise` da party não passa pela chave `name` — vai por aqui.
  "Crucifixo Inclinado": "Incline Fly",
  "Supino Reto com Barra": "Barbell Bench Press",
};
const NOMES_EN = Object.fromEntries(WORKOUTS_CAT.map((w) => [w.name, w.name_eng]));
Object.assign(NOMES_EN, {
  "Desenvolvimento Halteres": "Dumbbell Shoulder Press",
  "Elevação Lateral": "Lateral Raise",
});

function traduz(v, chave) {
  if (typeof v === "string") {
    if (chave === "name" && NOMES_EN[v]) return NOMES_EN[v];
    return EN_TEXT[v] ?? v;
  }
  if (Array.isArray(v)) return v.map((x) => traduz(x, chave));
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, traduz(x, k)]));
  }
  return v;
}

export const LANG = process.env.LK_LANG === "en" ? "en" : "pt";
export const TABLES = LANG === "en" ? traduz(TABLES_PT) : TABLES_PT;
