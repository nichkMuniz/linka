import { supabase, hasSupabaseConfig, getUserSafe } from "@/lib/supabase";
import {
  getPostLikesDb,
  getUserPostLikesDb,
  togglePostIncentiveDb,
  getUserProfileDb,
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
    .select("*")
    .in("user_id", userIdsToShow)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Collect all unique user_goal_ids to batch-fetch in one query
  const goalIds = [...new Set(
    (data ?? []).map((p: any) => p.user_goal_id).filter(Boolean)
  )];

  // Batch-fetch user_goals via RPC (bypasses RLS so we can read other users' goals)
  const goalMap = new Map<string, any>();
  if (goalIds.length > 0) {
    const { data: goalsData } = await supabase
      .rpc("get_user_goals_by_ids", { goal_ids: goalIds.map(Number) });

    if (goalsData?.length) {
      goalsData.forEach((g: any) => {
        goalMap.set(String(g.id), {
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

  // Enrich each post with likes, comments, user info, and goal data
  const posts = await Promise.all(
    (data ?? []).map(async (post: any) => {
      const [
        likes,
        userLikes,
        { count: commentCount },
        userProfile,
      ] = await Promise.all([
        getPostLikesDb(post.id),
        getUserPostLikesDb(post.id),
        supabase
          .from("comments")
          .select("*", { count: "exact", head: true })
          .eq("post_id", post.id),
        getUserProfileDb(post.user_id),
      ]);

      const totalLikes = Object.values(likes).reduce(
        (a: number, b: number) => a + b,
        0,
      );
      const hasActivity = totalLikes > 0 || (commentCount ?? 0) > 0;

      const userGoal = post.user_goal_id ? goalMap.get(String(post.user_goal_id)) : undefined;

      return {
        ...post,
        likes,
        userLikes,
        commentCount: commentCount ?? 0,
        hasActivity,
        userNickname: userProfile?.nickname || "Usuário",
        userPhoto: userProfile?.photo || null,
        userGoal,
      };
    }),
  );

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
    .select("*")
    .not("user_id", "in", `(${excludedIds.join(",")})`)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  const goalIds = [...new Set(
    (data ?? []).map((p: any) => p.user_goal_id).filter(Boolean)
  )];

  const goalMap = new Map<string, any>();
  if (goalIds.length > 0) {
    const { data: goalsData } = await supabase
      .rpc("get_user_goals_by_ids", { goal_ids: goalIds.map(Number) });

    if (goalsData?.length) {
      goalsData.forEach((g: any) => {
        goalMap.set(String(g.id), {
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

  const posts = await Promise.all(
    (data ?? []).map(async (post: any) => {
      const [
        likes,
        userLikes,
        { count: commentCount },
        userProfile,
      ] = await Promise.all([
        getPostLikesDb(post.id),
        getUserPostLikesDb(post.id),
        supabase
          .from("comments")
          .select("*", { count: "exact", head: true })
          .eq("post_id", post.id),
        getUserProfileDb(post.user_id),
      ]);

      const totalLikes = Object.values(likes).reduce(
        (a: number, b: number) => a + b,
        0,
      );
      const hasActivity = totalLikes > 0 || (commentCount ?? 0) > 0;
      const userGoal = post.user_goal_id ? goalMap.get(String(post.user_goal_id)) : undefined;

      return {
        ...post,
        likes,
        userLikes,
        commentCount: commentCount ?? 0,
        hasActivity,
        userNickname: userProfile?.nickname || "Usuário",
        userPhoto: userProfile?.photo || null,
        userGoal,
      };
    }),
  );

  return posts;
};

export const togglePostLike = async (
  postId: string,
  incentiveType: PostIncentiveType,
) => {
  await togglePostIncentiveDb(postId, incentiveType);
};
