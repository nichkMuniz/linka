import { supabase } from "@/lib/supabase";

export async function toggleGoalIncentive(goalId: string, kind: string) {
  const { data, error } = await supabase.rpc("toggle_incentive", {
    goal_id: goalId,
    incentive_type: kind,
  });

  if (error) throw error;
  return data;
}

export async function updateGoal(goalId: string, patch: any) {
  const { data, error } = await supabase
    .from("posts")
    .update(patch)
    .eq("id", goalId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function listGoalComments(goalId: string) {
  const { data, error } = await supabase
    .from("comments")
    .select(
      `
      *,
      user:user_id (id, name, handle, avatar_url)
    `,
    )
    .eq("post_id", goalId)
    .order("created_at");

  if (error) throw error;
  return data;
}

export async function addGoalComment(goalId: string, text: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("comments").insert({
    post_id: goalId,
    user_id: user?.id,
    text,
  });

  if (error) throw error;
}

export async function blockUser(handle: string) {
  const { error } = await supabase.from("user_blocked").insert({
    blocked_handle: handle,
  });

  if (error) throw error;
}

export async function copyRoutine(routineId: string) {
  const { error } = await supabase.from("user_routines").insert({
    routine_id: routineId,
  });

  if (error) throw error;
}
