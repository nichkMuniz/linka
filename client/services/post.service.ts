import { supabase } from "@/lib/supabase";

export const getFeedPosts = async () => {
  if (!supabase) throw new Error("Supabase não configurado");

  const { data, error } = await supabase
    .from("posts")
    .select(
      `
      id,
      description,
      photo,
      created_at,
      user:user_id (id, username, avatar_url)
    `
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
};
