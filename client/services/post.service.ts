import { supabase } from "@/lib/supabase";

export const getFeedPosts = async () => {
  const { data, error } = await supabase
    .from("posts")
    .select(`
      *,
      user:user_id (id, username, avatar_url),
      likes(count),
      comments(count)
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
};

export const createPost = async (content: string, image?: string) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("posts").insert({
    user_id: user?.id,
    content,
    image_url: image,
  });

  if (error) throw error;
};
