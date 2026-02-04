import { supabase, hasSupabaseConfig } from "@/lib/supabase";
import {
  getPostLikesDb,
  getUserPostLikesDb,
  togglePostIncentiveDb,
  type PostWithLikes,
  type PostIncentiveType,
} from "@/lib/ritmofit-db";

export const getFeedPosts = async (): Promise<PostWithLikes[]> => {
  if (!hasSupabaseConfig || !supabase)
    throw new Error("Supabase não configurado");

  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Enrich each post with likes data
  const posts = await Promise.all(
    (data ?? []).map(async (post: any) => ({
      ...post,
      likes: await getPostLikesDb(post.id),
      userLikes: await getUserPostLikesDb(post.id),
    })),
  );

  return posts;
};

export const togglePostLike = async (
  postId: string,
  incentiveType: PostIncentiveType,
) => {
  await togglePostIncentiveDb(postId, incentiveType);
};
