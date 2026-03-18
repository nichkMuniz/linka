import { supabase, hasSupabaseConfig, getUserSafe } from "@/lib/supabase";
import {
  getPostLikesDb,
  getUserPostLikesDb,
  togglePostIncentiveDb,
  getUserProfileDb,
  getUserGoalsByUserIdDb,
  getFollowingIdsDb,
  type PostWithLikes,
  type PostIncentiveType,
  type UserGoal,
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

  // Enrich each post with likes, comments, user info, and goal data
  const posts = await Promise.all(
    (data ?? []).map(async (post: any) => {
      const [
        likes,
        userLikes,
        { count: commentCount },
        userProfile,
        userGoals,
      ] = await Promise.all([
        getPostLikesDb(post.id),
        getUserPostLikesDb(post.id),
        supabase
          .from("comments")
          .select("*", { count: "exact", head: true })
          .eq("post_id", post.id),
        getUserProfileDb(post.user_id),
        getUserGoalsByUserIdDb(post.user_id),
      ]);

      // Check if post has any activity
      const totalLikes = Object.values(likes).reduce(
        (a: number, b: number) => a + b,
        0,
      );
      const hasActivity = totalLikes > 0 || (commentCount ?? 0) > 0;

      // Get the post's specific user goal if user_goal_id is set
      // Use the already-fetched userGoals to avoid RLS issues when reading other users' goals
      let userGoal = undefined;
      if (post.user_goal_id) {
        const specificGoal = userGoals.find((g) => g.id === post.user_goal_id);
        if (specificGoal) {
          userGoal = {
            id: specificGoal.id,
            goal_id: specificGoal.goal_id,
            description: specificGoal.description,
            perc: specificGoal.perc,
            duration: specificGoal.duration,
            quantity: specificGoal.quantity,
            type_goal: specificGoal.type_goal,
            actual_progress: specificGoal.days_completed,
          };
        }
      }

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
