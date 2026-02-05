import { supabase, hasSupabaseConfig } from "@/lib/supabase";
import {
  getPostLikesDb,
  getUserPostLikesDb,
  togglePostIncentiveDb,
  getUserProfileDb,
  getUserGoalsByUserIdDb,
  getUserGoalByIdDb,
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
  };
};

export const getFeedPosts = async (): Promise<PostWithStats[]> => {
  if (!hasSupabaseConfig || !supabase)
    throw new Error("Supabase não configurado");

  // Get the list of users the current user follows
  const followingIds = await getFollowingIdsDb();

  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .in("user_id", followingIds.length > 0 ? followingIds : [""])
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
      // Otherwise, fall back to the first goal of the user
      let userGoal = undefined;
      if (post.user_goal_id) {
        const specificGoal = await getUserGoalByIdDb(post.user_goal_id);
        if (specificGoal) {
          userGoal = {
            id: specificGoal.id,
            goal_id: specificGoal.goal_id,
            description: specificGoal.description,
            perc: specificGoal.perc,
          };
        }
      } else if (userGoals.length > 0) {
        // Fallback: use first user goal if no specific goal is linked to post
        const goal = userGoals[0];
        userGoal = {
          id: goal.id,
          goal_id: goal.goal_id,
          description: goal.description,
          perc: goal.perc,
        };
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
