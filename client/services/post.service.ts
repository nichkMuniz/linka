import { supabase, hasSupabaseConfig, getUserSafe } from "@/lib/supabase";
import {
  getPostLikesWithViewerBatchDb,
  getCommentCountsBatchDb,
  getProfilesBatchDb,
  getPostTagsBatchDb,
  getPostRepostersBatchDb,
  getRepostedPostIdsByUsersDb,
  pickReposters,
  selectPostRows,
  togglePostIncentiveDb,
  getFollowingIdsDb,
  getBlockedIdsDb,
  resolveUserGoalRef,
  USER_GOAL_REF_COLUMNS,
  type PostWithLikes,
  type PostWithUser,
  type PostIncentiveType,
  type SearchUser,
} from "@/lib/ritmofit-db";
import type { PostWorkoutSummary } from "@/lib/workout-summary-types";
import type { VerifiedTier } from "@/lib/verified-tier";

export type PostWithStats = PostWithLikes & {
  commentCount: number;
  hasActivity: boolean;
  userNickname: string;
  userPhoto: string | null;
  isVerified?: boolean;
  verifiedTier?: VerifiedTier | null;
  /** Quem repostou (adicionou ao próprio perfil) — ver `getPostRepostersBatchDb`. */
  repostedBy?: SearchUser[];
  workoutSummary?: PostWorkoutSummary | null;
  taggedUsers?: SearchUser[];
  userGoal?: {
    id: string;
    goal_id: string;
    is_custom?: boolean;
    description: string;
    perc: number;
    duration: number;
    quantity: number;
    type_goal: number;
    actual_progress: number;
    visibility: number;
  };
};

export const FEED_PAGE_SIZE = 20;
export const DISCOVER_PAGE_SIZE = 20;

export const getFeedPosts = async (
  options: { limit?: number; before?: string } = {},
): Promise<PostWithStats[]> => {
  if (!hasSupabaseConfig || !supabase)
    throw new Error("Supabase não configurado");

  const limit = options.limit ?? FEED_PAGE_SIZE;

  // Auth + following + bloqueios em paralelo (independentes — todos usam o
  // getViewer cacheado)
  const [currentUser, followingIds, blockedIds] = await Promise.all([
    getUserSafe(),
    getFollowingIdsDb(),
    getBlockedIdsDb(),
  ]);
  if (!currentUser) throw new Error("Usuário não autenticado");

  // Include current user's own posts + posts from followed users
  //
  // Bloquear desfaz o follow pelo trigger da migração, o que já cobriria a
  // direção "eu bloqueei". A direção inversa não: se ELE me bloqueou, o follow
  // some do lado dele, mas a linha que ESTE cliente lê continua listando o
  // usuário — sem este filtro o feed seguiria mostrando quem me bloqueou.
  const blocked = new Set(blockedIds);
  const userIdsToShow = [
    currentUser.id,
    ...followingIds.filter((id) => !blocked.has(id)),
  ];

  const query = selectPostRows((cols) => {
    let q = supabase!
      .from("posts")
      .select(cols)
      .in("user_id", userIdsToShow)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (options.before) q = q.lt("created_at", options.before);
    return q;
  });
  // Repost é o MESMO post (estilo Instagram): o que alguém que eu sigo repostou
  // entra no meu feed uma vez só, mesmo que eu siga o autor e mais de um
  // marcado. As duas fontes paginam pela data do post (`post_created_at` é a
  // cópia dela), então o mesmo cursor `before` vale para as duas.
  const [{ data, error }, repostedIds] = await Promise.all([
    query,
    getRepostedPostIdsByUsersDb(userIdsToShow, { limit, before: options.before }),
  ]);

  if (error) throw error;

  const authored = data ?? [];
  const seen = new Set(authored.map((p: any) => String(p.id)));
  const missingIds = repostedIds.filter((id) => !seen.has(id));
  let reposted: any[] = [];
  if (missingIds.length > 0) {
    const { data: repostedData } = await selectPostRows((cols) =>
      supabase!.from("posts").select(cols).in("id", missingIds),
    );
    // A RLS de posts já tira autor que esconde os posts; bloqueio sai à mão.
    reposted = (repostedData ?? []).filter((p: any) => !blocked.has(String(p.user_id)));
  }

  // Junta, ordena e corta na página: o que sobrar volta na próxima (o cursor é
  // o created_at do último exibido).
  const rows = [...authored, ...reposted]
    .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, limit);
  if (rows.length === 0) return [];

  const postIds = rows.map((p: any) => p.id);
  const userIds = [...new Set(rows.map((p: any) => p.user_id))];

  // Collect all unique user_goal_ids to batch-fetch in one query
  const goalIds = [...new Set(
    rows.map((p: any) => p.user_goal_id).filter(Boolean)
  )];

  // Batch-fetch ALL enrichment data in parallel (3 queries total — likes + viewer-likes merged into one round-trip)
  const [likesBundle, commentCountsMap, profilesMap, tagsMap, goalMap, repostersMap] = await Promise.all([
    getPostLikesWithViewerBatchDb(postIds),
    getCommentCountsBatchDb(postIds),
    getProfilesBatchDb(userIds),
    getPostTagsBatchDb(postIds),
    (async () => {
      const map = new Map<string, any>();
      if (goalIds.length > 0) {
        const { data: goalsData } = await supabase
          .from("user_goals")
          .select(`id, duration, quantity, type_goal, perc, visibility, ${USER_GOAL_REF_COLUMNS}`)
          .in("id", goalIds.map(Number));
        if (goalsData?.length) {
          goalsData.forEach((g: any) => {
            const ref = resolveUserGoalRef(g);
            map.set(String(g.id), {
              id: String(g.id),
              goal_id: ref.goal_id,
              is_custom: ref.is_custom,
              description: ref.description,
              perc: Number(g.perc ?? 0),
              duration: Number(g.duration ?? 0),
              quantity: Number(g.quantity ?? 0),
              type_goal: Number(g.type_goal ?? 0),
              actual_progress: Math.round((Number(g.perc ?? 0) / 100) * Number(g.quantity ?? 0)),
              visibility: Number(g.visibility ?? 1),
            });
          });
        }
      }
      return map;
    })(),
    getPostRepostersBatchDb(postIds),
  ]);
  const { likesMap, userLikesMap } = likesBundle;

  const followedOrMe = new Set(userIdsToShow);

  // Assemble posts synchronously — no more per-post queries
  const posts: PostWithStats[] = rows.map((post: any) => {
    const likes = likesMap.get(post.id) ?? { apoio: 0, continua: 0, ganhador: 0, consegueMais: 0, limiteMaior: 0, maisAlgum: 0 };
    const userLikes = userLikesMap.get(post.id) ?? [];
    const commentCount = commentCountsMap.get(post.id) ?? 0;
    const profile = profilesMap.get(post.user_id);
    const totalLikes = (Object.values(likes) as number[]).reduce((a, b) => a + b, 0);
    const goalData = post.user_goal_id ? goalMap.get(String(post.user_goal_id)) : undefined;
    const userGoal = goalData?.visibility === 1 ? goalData : undefined;

    return {
      ...post,
      likes,
      userLikes,
      commentCount,
      hasActivity: totalLikes > 0 || commentCount > 0,
      userNickname: profile?.nickname || "Usuário",
      userPhoto: profile?.photo || null,
      isVerified: profile?.is_verified === true,
      verifiedTier: profile?.verified_tier ?? null,
      workoutSummary: (post.workout_summary as PostWorkoutSummary | null) ?? null,
      taggedUsers: tagsMap.get(post.id) ?? [],
      userGoal,
      // Quem eu sigo (ou eu) vem primeiro: foi por essa pessoa que o post chegou.
      repostedBy: pickReposters(tagsMap.get(post.id), repostersMap.get(String(post.id)), followedOrMe),
    };
  });

  return posts;
};

export const getDiscoverPosts = async (
  options: { limit?: number; before?: string } = {},
): Promise<PostWithStats[]> => {
  if (!hasSupabaseConfig || !supabase)
    throw new Error("Supabase não configurado");

  const limit = options.limit ?? DISCOVER_PAGE_SIZE;

  const [currentUser, followingIds, blockedIds] = await Promise.all([
    getUserSafe(),
    getFollowingIdsDb(),
    getBlockedIdsDb(),
  ]);
  if (!currentUser) throw new Error("Usuário não autenticado");

  // Exclude current user, followed users and quem está bloqueado nos dois
  // sentidos. Aqui o filtro é indispensável: Descobrir mostra justamente quem
  // você NÃO segue — é a superfície por onde um usuário bloqueado voltaria a
  // aparecer.
  const excludedIds = [
    ...new Set([currentUser.id, ...followingIds, ...blockedIds]),
  ];

  const { data, error } = await selectPostRows((cols) => {
    let q = supabase!
      .from("posts")
      .select(cols)
      .not("user_id", "in", `(${excludedIds.join(",")})`)
      // Linhas de repost do modelo antigo (cópia do post, 20260928) ficam fora:
      // a migração 20261005 as converte em `post_reposts`, mas o filtro protege
      // até ela rodar.
      .is("reposted_from", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    // Cursor de paginação (scroll infinito): busca posts mais antigos que o último já exibido.
    if (options.before) q = q.lt("created_at", options.before);
    return q;
  });

  if (error) throw error;

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const postIds = rows.map((p: any) => p.id);
  const userIds = [...new Set(rows.map((p: any) => p.user_id))];
  const goalIds = [...new Set(rows.map((p: any) => p.user_goal_id).filter(Boolean))];

  const [likesBundle, commentCountsMap, profilesMap, tagsMap, goalMap, repostersMap] = await Promise.all([
    getPostLikesWithViewerBatchDb(postIds),
    getCommentCountsBatchDb(postIds),
    getProfilesBatchDb(userIds),
    getPostTagsBatchDb(postIds),
    (async () => {
      const map = new Map<string, any>();
      if (goalIds.length > 0) {
        const { data: goalsData } = await supabase
          .from("user_goals")
          .select(`id, duration, quantity, type_goal, perc, visibility, ${USER_GOAL_REF_COLUMNS}`)
          .in("id", goalIds.map(Number));
        if (goalsData?.length) {
          goalsData.forEach((g: any) => {
            const ref = resolveUserGoalRef(g);
            map.set(String(g.id), {
              id: String(g.id),
              goal_id: ref.goal_id,
              is_custom: ref.is_custom,
              description: ref.description,
              perc: Number(g.perc ?? 0),
              duration: Number(g.duration ?? 0),
              quantity: Number(g.quantity ?? 0),
              type_goal: Number(g.type_goal ?? 0),
              actual_progress: Math.round((Number(g.perc ?? 0) / 100) * Number(g.quantity ?? 0)),
              visibility: Number(g.visibility ?? 1),
            });
          });
        }
      }
      return map;
    })(),
    getPostRepostersBatchDb(postIds),
  ]);
  const { likesMap, userLikesMap } = likesBundle;

  const posts: PostWithStats[] = rows.map((post: any) => {
    const likes = likesMap.get(post.id) ?? { apoio: 0, continua: 0, ganhador: 0, consegueMais: 0, limiteMaior: 0, maisAlgum: 0 };
    const userLikes = userLikesMap.get(post.id) ?? [];
    const commentCount = commentCountsMap.get(post.id) ?? 0;
    const profile = profilesMap.get(post.user_id);
    const totalLikes = (Object.values(likes) as number[]).reduce((a, b) => a + b, 0);
    const goalData = post.user_goal_id ? goalMap.get(String(post.user_goal_id)) : undefined;
    const userGoal = goalData?.visibility === 1 ? goalData : undefined;

    return {
      ...post,
      likes,
      userLikes,
      commentCount,
      hasActivity: totalLikes > 0 || commentCount > 0,
      userNickname: profile?.nickname || "Usuário",
      userPhoto: profile?.photo || null,
      isVerified: profile?.is_verified === true,
      verifiedTier: profile?.verified_tier ?? null,
      workoutSummary: (post.workout_summary as PostWorkoutSummary | null) ?? null,
      taggedUsers: tagsMap.get(post.id) ?? [],
      userGoal,
      repostedBy: pickReposters(tagsMap.get(post.id), repostersMap.get(String(post.id))),
    };
  });

  // Ordem PURAMENTE cronológica: do mais recente para o mais antigo, seja quem
  // for o autor. `posts` preserva a ordem do `.order("created_at", desc)` da
  // query, então basta devolver.
  //
  // Havia aqui um `rankDiscoverPosts` que reordenava por engajamento
  // (curtidas + 2×comentários) com decaimento de recência de 36h. A intenção
  // era boa e o efeito foi ruim: com base pequena, o engajamento se concentra
  // em poucas pessoas, então o score agrupava vários posts do mesmo autor em
  // sequência — inclusive posts antigos passando à frente de recentes. O
  // usuário via "o feed de uma pessoa só". Ranking por engajamento precisa de
  // volume para não virar isso; até lá, cronológico é mais honesto e mais
  // previsível. Removido de propósito — não é uma flag de v1.
  return posts;
};

/**
 * Completa posts que já vieram do Perfil (`PostWithUser`: autor, meta, marcações,
 * resumo de treino e repost EMBUTIDOS) com o que o `PostCard` precisa a mais —
 * incentivos, os do próprio viewer e a contagem de comentários — em 2 consultas
 * em lote, as mesmas do feed. Os dados embutidos são mantidos como vieram (não
 * refaz a leitura que o Perfil já fez).
 */
export const withPostStats = async (posts: PostWithUser[]): Promise<PostWithStats[]> => {
  if (posts.length === 0) return [];
  const ids = posts.map((p) => p.id);
  const [{ likesMap, userLikesMap }, commentCountsMap] = await Promise.all([
    getPostLikesWithViewerBatchDb(ids),
    getCommentCountsBatchDb(ids),
  ]);
  return posts.map((post) => {
    const likes = likesMap.get(post.id) ?? { apoio: 0, continua: 0, ganhador: 0, consegueMais: 0, limiteMaior: 0, maisAlgum: 0 };
    const commentCount = commentCountsMap.get(post.id) ?? 0;
    const totalLikes = (Object.values(likes) as number[]).reduce((a, b) => a + b, 0);
    return {
      ...post,
      likes,
      userLikes: userLikesMap.get(post.id) ?? [],
      commentCount,
      hasActivity: totalLikes > 0 || commentCount > 0,
      userNickname: post.userNickname || "Usuário",
      userPhoto: post.userPhoto ?? null,
    };
  });
};

export const togglePostLike = async (
  postId: string,
  incentiveType: PostIncentiveType,
  wantActive: boolean,
): Promise<void> => {
  await togglePostIncentiveDb(postId, incentiveType, wantActive);
};
