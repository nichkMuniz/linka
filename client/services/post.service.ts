import { supabase, hasSupabaseConfig, getUserSafe } from "@/lib/supabase";
import {
  getPostLikesBatchDb,
  getUserPostLikesBatchDb,
  getCommentCountsBatchDb,
  getProfilesBatchDb,
  togglePostIncentiveDb,
  getFollowingIdsDb,
  type PostWithLikes,
  type PostIncentiveType,
} from "@/lib/ritmofit-db";

export type PostWithStats = PostWithLikes & {
  commentCount: number;
  hasActivity: boolean;
  userNickname: string;
  userPhoto: string | null;
  userGoal?: {
    id: string;
    goal_id: string;
    description: string;
    perc: number;
    duration: number;
    quantity: number;
    type_goal: number;
    actual_progress: number;
  };
};

export const getFeedPosts = async (): Promise<PostWithStats[]> => {
  if (!hasSupabaseConfig || !supabase)
    throw new Error("Supabase não configurado");

  // Get the current user
  const currentUser = await getUserSafe();
  if (!currentUser) throw new Error("Usuário não autenticado");

  // Get the list of users the current user follows
  const followingIds = await getFollowingIdsDb();

  // Include current user's own posts + posts from followed users
  const userIdsToShow = [currentUser.id, ...followingIds];

  const { data, error } = await supabase
    .from("posts")
    .select("id, description, photo, photos, created_at, user_id, user_goal_id")
    .in("user_id", userIdsToShow)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const postIds = rows.map((p: any) => p.id);
  const userIds = [...new Set(rows.map((p: any) => p.user_id))];

  // Collect all unique user_goal_ids to batch-fetch in one query
  const goalIds = [...new Set(
    rows.map((p: any) => p.user_goal_id).filter(Boolean)
  )];

  // Batch-fetch ALL enrichment data in parallel (4 queries total instead of N*8)
  const [likesMap, userLikesMap, commentCountsMap, profilesMap, goalMap] = await Promise.all([
    getPostLikesBatchDb(postIds),
    getUserPostLikesBatchDb(postIds),
    getCommentCountsBatchDb(postIds),
    getProfilesBatchDb(userIds),
    (async () => {
      const map = new Map<string, any>();
      if (goalIds.length > 0) {
        const { data: goalsData } = await supabase
          .rpc("get_user_goals_by_ids", { goal_ids: goalIds.map(Number) });
        if (goalsData?.length) {
          goalsData.forEach((g: any) => {
            map.set(String(g.id), {
              id: String(g.id),
              goal_id: String(g.goal_id),
              description: g.description ?? "",
              perc: Number(g.perc ?? 0),
              duration: Number(g.duration ?? 0),
              quantity: Number(g.quantity ?? 0),
              type_goal: Number(g.type_goal ?? 0),
              actual_progress: Math.round((Number(g.perc ?? 0) / 100) * Number(g.quantity ?? 0)),
            });
          });
        }
      }
      return map;
    })(),
  ]);

  // Assemble posts synchronously — no more per-post queries
  const posts: PostWithStats[] = rows.map((post: any) => {
    const likes = likesMap.get(post.id) ?? { apoio: 0, continua: 0, ganhador: 0, consegueMais: 0, limiteMaior: 0, maisAlgum: 0 };
    const userLikes = userLikesMap.get(post.id) ?? [];
    const commentCount = commentCountsMap.get(post.id) ?? 0;
    const profile = profilesMap.get(post.user_id);
    const totalLikes = Object.values(likes).reduce((a: number, b: number) => a + b, 0);
    const userGoal = post.user_goal_id ? goalMap.get(String(post.user_goal_id)) : undefined;

    return {
      ...post,
      likes,
      userLikes,
      commentCount,
      hasActivity: totalLikes > 0 || commentCount > 0,
      userNickname: profile?.nickname || "Usuário",
      userPhoto: profile?.photo || null,
      userGoal,
    };
  });

  return posts;
};

export const getDiscoverPosts = async (): Promise<PostWithStats[]> => {
  if (!hasSupabaseConfig || !supabase)
    throw new Error("Supabase não configurado");

  const currentUser = await getUserSafe();
  if (!currentUser) throw new Error("Usuário não autenticado");

  const followingIds = await getFollowingIdsDb();

  // Exclude current user and followed users
  const excludedIds = [currentUser.id, ...followingIds];

  const { data, error } = await supabase
    .from("posts")
    .select("id, description, photo, photos, created_at, user_id, user_goal_id")
    .not("user_id", "in", `(${excludedIds.join(",")})`)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const postIds = rows.map((p: any) => p.id);
  const userIds = [...new Set(rows.map((p: any) => p.user_id))];
  const goalIds = [...new Set(rows.map((p: any) => p.user_goal_id).filter(Boolean))];

  const [likesMap, userLikesMap, commentCountsMap, profilesMap, goalMap] = await Promise.all([
    getPostLikesBatchDb(postIds),
    getUserPostLikesBatchDb(postIds),
    getCommentCountsBatchDb(postIds),
    getProfilesBatchDb(userIds),
    (async () => {
      const map = new Map<string, any>();
      if (goalIds.length > 0) {
        const { data: goalsData } = await supabase
          .rpc("get_user_goals_by_ids", { goal_ids: goalIds.map(Number) });
        if (goalsData?.length) {
          goalsData.forEach((g: any) => {
            map.set(String(g.id), {
              id: String(g.id),
              goal_id: String(g.goal_id),
              description: g.description ?? "",
              perc: Number(g.perc ?? 0),
              duration: Number(g.duration ?? 0),
              quantity: Number(g.quantity ?? 0),
              type_goal: Number(g.type_goal ?? 0),
              actual_progress: Math.round((Number(g.perc ?? 0) / 100) * Number(g.quantity ?? 0)),
            });
          });
        }
      }
      return map;
    })(),
  ]);

  const posts: PostWithStats[] = rows.map((post: any) => {
    const likes = likesMap.get(post.id) ?? { apoio: 0, continua: 0, ganhador: 0, consegueMais: 0, limiteMaior: 0, maisAlgum: 0 };
    const userLikes = userLikesMap.get(post.id) ?? [];
    const commentCount = commentCountsMap.get(post.id) ?? 0;
    const profile = profilesMap.get(post.user_id);
    const totalLikes = Object.values(likes).reduce((a: number, b: number) => a + b, 0);
    const userGoal = post.user_goal_id ? goalMap.get(String(post.user_goal_id)) : undefined;

    return {
      ...post,
      likes,
      userLikes,
      commentCount,
      hasActivity: totalLikes > 0 || commentCount > 0,
      userNickname: profile?.nickname || "Usuário",
      userPhoto: profile?.photo || null,
      userGoal,
    };
  });

  // Sort by engagement score (likes + comments) so new users see popular content first
  const userSegments: string[] = (() => {
    try {
      const stored = localStorage.getItem("user_fitness_segments");
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  })();

  const SEGMENT_KEYWORDS: Record<string, string[]> = {
    fitness: ["treino", "academia", "musculação", "musculo", "weight", "gym"],
    cardio: ["corrida", "cardio", "run", "maratona", "bike", "ciclismo"],
    diets: ["dieta", "nutrição", "alimentação", "comida", "receita", "proteina"],
    habits: ["hábito", "mindfulness", "meditação", "rotina", "habito"],
    yoga: ["yoga", "flexibilidade", "alongamento", "pilates"],
    sports: ["esporte", "futebol", "basquete", "natação", "sport"],
  };

  const getSegmentScore = (post: PostWithStats): number => {
    if (userSegments.length === 0) return 0;
    const desc = (post.description || "").toLowerCase();
    let score = 0;
    for (const seg of userSegments) {
      const keywords = SEGMENT_KEYWORDS[seg] || [];
      if (keywords.some((kw) => desc.includes(kw))) score += 2;
    }
    return score;
  };

  const getEngagementScore = (post: PostWithStats): number => {
    const totalLikes = Object.values(post.likes || {}).reduce((a: number, b: number) => a + b, 0);
    return totalLikes + (post.commentCount || 0);
  };

  posts.sort((a, b) => {
    const segDiff = getSegmentScore(b) - getSegmentScore(a);
    if (segDiff !== 0) return segDiff;
    return getEngagementScore(b) - getEngagementScore(a);
  });

  return posts;
};

export const togglePostLike = async (
  postId: string,
  incentiveType: PostIncentiveType,
) => {
  await togglePostIncentiveDb(postId, incentiveType);
};
