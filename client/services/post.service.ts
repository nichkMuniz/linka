import { supabase, hasSupabaseConfig, getUserSafe } from "@/lib/supabase";
import {
  getPostLikesWithViewerBatchDb,
  getCommentCountsBatchDb,
  getProfilesBatchDb,
  getPostTagsBatchDb,
  togglePostIncentiveDb,
  getFollowingIdsDb,
  type PostWithLikes,
  type PostIncentiveType,
  type SearchUser,
} from "@/lib/ritmofit-db";
import type { PostWorkoutSummary } from "@/lib/workout-summary-types";

export type PostWithStats = PostWithLikes & {
  commentCount: number;
  hasActivity: boolean;
  userNickname: string;
  userPhoto: string | null;
  isVerified?: boolean;
  workoutSummary?: PostWorkoutSummary | null;
  taggedUsers?: SearchUser[];
  userGoal?: {
    id: string;
    goal_id: string;
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

  // Auth + following list em paralelo (independentes — getFollowingIdsDb usa getViewer cacheado)
  const [currentUser, followingIds] = await Promise.all([
    getUserSafe(),
    getFollowingIdsDb(),
  ]);
  if (!currentUser) throw new Error("Usuário não autenticado");

  // Include current user's own posts + posts from followed users
  const userIdsToShow = [currentUser.id, ...followingIds];

  let query = supabase
    .from("posts")
    .select("id, description, photo, photos, created_at, user_id, user_goal_id, workout_summary")
    .in("user_id", userIdsToShow)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (options.before) {
    query = query.lt("created_at", options.before);
  }
  const { data, error } = await query;

  if (error) throw error;

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const postIds = rows.map((p: any) => p.id);
  const userIds = [...new Set(rows.map((p: any) => p.user_id))];

  // Collect all unique user_goal_ids to batch-fetch in one query
  const goalIds = [...new Set(
    rows.map((p: any) => p.user_goal_id).filter(Boolean)
  )];

  // Batch-fetch ALL enrichment data in parallel (3 queries total — likes + viewer-likes merged into one round-trip)
  const [likesBundle, commentCountsMap, profilesMap, tagsMap, goalMap] = await Promise.all([
    getPostLikesWithViewerBatchDb(postIds),
    getCommentCountsBatchDb(postIds),
    getProfilesBatchDb(userIds),
    getPostTagsBatchDb(postIds),
    (async () => {
      const map = new Map<string, any>();
      if (goalIds.length > 0) {
        const { data: goalsData } = await supabase
          .from("user_goals")
          .select("id, goal_id, duration, quantity, type_goal, perc, visibility, goals(description)")
          .in("id", goalIds.map(Number));
        if (goalsData?.length) {
          goalsData.forEach((g: any) => {
            const description = Array.isArray(g.goals)
              ? (g.goals[0]?.description ?? "")
              : (g.goals?.description ?? "");
            map.set(String(g.id), {
              id: String(g.id),
              goal_id: String(g.goal_id),
              description,
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
  ]);
  const { likesMap, userLikesMap } = likesBundle;

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
      workoutSummary: (post.workout_summary as PostWorkoutSummary | null) ?? null,
      taggedUsers: tagsMap.get(post.id) ?? [],
      userGoal,
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

  const [currentUser, followingIds] = await Promise.all([
    getUserSafe(),
    getFollowingIdsDb(),
  ]);
  if (!currentUser) throw new Error("Usuário não autenticado");

  // Exclude current user and followed users
  const excludedIds = [currentUser.id, ...followingIds];

  let query = supabase
    .from("posts")
    .select("id, description, photo, photos, created_at, user_id, user_goal_id, workout_summary")
    .not("user_id", "in", `(${excludedIds.join(",")})`)
    .order("created_at", { ascending: false })
    .limit(limit);
  // Cursor de paginação (scroll infinito): busca posts mais antigos que o último já exibido.
  if (options.before) {
    query = query.lt("created_at", options.before);
  }
  const { data, error } = await query;

  if (error) throw error;

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const postIds = rows.map((p: any) => p.id);
  const userIds = [...new Set(rows.map((p: any) => p.user_id))];
  const goalIds = [...new Set(rows.map((p: any) => p.user_goal_id).filter(Boolean))];

  const [likesBundle, commentCountsMap, profilesMap, tagsMap, goalMap] = await Promise.all([
    getPostLikesWithViewerBatchDb(postIds),
    getCommentCountsBatchDb(postIds),
    getProfilesBatchDb(userIds),
    getPostTagsBatchDb(postIds),
    (async () => {
      const map = new Map<string, any>();
      if (goalIds.length > 0) {
        const { data: goalsData } = await supabase
          .from("user_goals")
          .select("id, goal_id, duration, quantity, type_goal, perc, visibility, goals(description)")
          .in("id", goalIds.map(Number));
        if (goalsData?.length) {
          goalsData.forEach((g: any) => {
            const description = Array.isArray(g.goals)
              ? (g.goals[0]?.description ?? "")
              : (g.goals?.description ?? "");
            map.set(String(g.id), {
              id: String(g.id),
              goal_id: String(g.goal_id),
              description,
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
      workoutSummary: (post.workout_summary as PostWorkoutSummary | null) ?? null,
      taggedUsers: tagsMap.get(post.id) ?? [],
      userGoal,
    };
  });

  // Ranking do Discover: entre os posts da janela recente buscada (paginada por
  // cursor de created_at), prioriza os mais ENGAJADOS. A recência entra como
  // decaimento suave (meia-vida ~36h) e é o fator dominante entre janelas — dentro
  // de uma mesma página os posts têm idades próximas, então o engajamento manda.
  // Conservador de propósito: como todos os candidatos já são recentes, conteúdo
  // novo nunca é "starvado" globalmente; só é ordenado por qualidade dentro da faixa.
  return rankDiscoverPosts(posts);
};

const DISCOVER_HALF_LIFE_HOURS = 36;

function rankDiscoverPosts(posts: PostWithStats[]): PostWithStats[] {
  const now = Date.now();
  return posts
    .map((p) => {
      const ageH = Math.max(0, (now - new Date(p.created_at).getTime()) / 3_600_000);
      const recency = Math.pow(0.5, ageH / DISCOVER_HALF_LIFE_HOURS);
      const totalLikes = (Object.values(p.likes) as number[]).reduce((a, b) => a + b, 0);
      const engagement = totalLikes + 2 * p.commentCount;
      const hasMedia = !!(p.photo || (p.photos && p.photos.length > 0));
      const score = (1 + engagement) * recency * (hasMedia ? 1.15 : 1);
      return { p, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((s) => s.p);
}

export const togglePostLike = async (
  postId: string,
  incentiveType: PostIncentiveType,
  wantActive: boolean,
): Promise<void> => {
  await togglePostIncentiveDb(postId, incentiveType, wantActive);
};
