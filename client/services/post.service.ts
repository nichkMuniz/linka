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

  // Enrich each post with likes data and comment counts
  const posts = await Promise.all(
    (data ?? []).map(async (post: any) => {
      const { count: commentCount } = await supabase
        .from("comments")
        .select("*", { count: "exact", head: true })
        .eq("post_id", post.id);

      return {
        ...post,
        likes: await getPostLikesDb(post.id),
        userLikes: await getUserPostLikesDb(post.id),
        commentCount: commentCount ?? 0,
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
