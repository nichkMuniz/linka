import { supabase } from "@/lib/supabase";

export const getFeedPosts = async () => {
  if (!supabase) throw new Error("Supabase não configurado");

  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
};
