import { getUserSafe, supabase } from "@/lib/supabase";

export const getFeedPosts = async () => {
  if (!supabase) throw new Error("Supabase não configurado");

  const { data, error } = await supabase
    .from("posts")
    .select(
      `
      *,
      user:user_id (id, username, avatar_url),
      likes(count),
      comments(count)
    `,
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
};

export const createPost = async (content: string, image?: string) => {
  if (!supabase) throw new Error("Supabase não configurado");

  const user = await getUserSafe();
  if (!user) throw new Error("Faça login para publicar");

  const { error } = await supabase.from("posts").insert({
    user_id: user.id,
    content,
    image_url: image,
  });

  if (error) throw error;
};
