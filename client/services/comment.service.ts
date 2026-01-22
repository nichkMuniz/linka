import { supabase } from "@/lib/supabase";

export const getComments = async (postId: string) => {
  const { data, error } = await supabase
    .from("comments")
    .select(`
      *,
      user:user_id (id, username, avatar_url)
    `)
    .eq("post_id", postId)
    .order("created_at");

  if (error) throw error;
  return data;
};

export const createComment = async (postId: string, text: string) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("comments").insert({
    post_id: postId,
    user_id: user?.id,
    content: text,
  });

  if (error) throw error;
};
