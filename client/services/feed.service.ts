import { supabase } from "@/lib/supabase";

export async function getFeedState() {
  const { data: userData } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("user")
    .select("handle")
    .eq("id", userData?.user?.id)
    .single();

  const { data: goals } = await supabase
    .from("posts")
    .select(
      `
      *,
      user:user_id (id, name, handle, avatar_url),
      likes(count),
      comments(count)
    `,
    )
    .order("created_at", { ascending: false });

  const { data: routines } = await supabase.from("routines").select("*");

  const { data: blocked } = await supabase
    .from("user_blocked")
    .select("blocked_handle");

  return {
    goals: goals ?? [],
    routines: routines ?? [],
    blockedHandles: blocked?.map((b) => b.blocked_handle) ?? [],
    myHandle: profile?.handle ?? "@voce",
  };
}
