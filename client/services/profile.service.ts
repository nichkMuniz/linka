import { supabase } from "@/lib/supabase";

export const getProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from("user")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
};

export const getUserPosts = async (userId: string) => {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
};
