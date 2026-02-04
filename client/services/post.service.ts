import { supabase, hasSupabaseConfig } from "@/lib/supabase";
import {
  getPostLikesDb,
  getUserPostLikesDb,
  togglePostIncentiveDb,
  getPostGoalDb,
  getRoutinesByIdsDb,
  type PostWithLikes,
  type PostIncentiveType,
  type PostGoalInfo,
  type Routine,
} from "@/lib/ritmofit-db";

export type PostWithStats = PostWithLikes & {
  commentCount: number;
  goalInfo?: PostGoalInfo | null;
  linkedRoutines?: Routine[];
  hasActivity: boolean;
};

export const getFeedPosts = async (): Promise<PostWithStats[]> => {
  if (!hasSupabaseConfig || !supabase)
    throw new Error("Supabase não configurado");

  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Enrich each post with likes, comments, and goal data
  const posts = await Promise.all(
    (data ?? []).map(async (post: any) => {
      const [
        likes,
        userLikes,
        { count: commentCount },
        goalInfo,
      ] = await Promise.all([
        getPostLikesDb(post.id),
        getUserPostLikesDb(post.id),
        supabase
          .from("comments")
          .select("*", { count: "exact", head: true })
          .eq("post_id", post.id),
        post.user_goal_id ? getPostGoalDb(post.user_goal_id) : Promise.resolve(null),
      ]);

      // Check if post has any activity
      const totalLikes = Object.values(likes).reduce((a: number, b: number) => a + b, 0);
      const hasActivity = totalLikes > 0 || (commentCount ?? 0) > 0;

      // Fetch linked routines if goal exists
      let linkedRoutines: Routine[] = [];
      if (goalInfo && goalInfo.attachedRoutineIds?.length) {
        linkedRoutines = await getRoutinesByIdsDb(goalInfo.attachedRoutineIds);
      }

      return {
        ...post,
        likes,
        userLikes,
        commentCount: commentCount ?? 0,
        goalInfo,
        linkedRoutines,
        hasActivity,
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
