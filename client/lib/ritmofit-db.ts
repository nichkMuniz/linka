import { supabase } from "./supabase";

/* ============================
   HELPERS
============================ */

function ensureSupabase() {
  if (!supabase) throw new Error("Supabase não configurado");
  return supabase;
}

/* ============================
   PERFIL
============================ */

export async function getMyProfileDb() {
  const sb = ensureSupabase();

  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) return null;

  const { data } = await sb
    .from("user")
    .select("*")
    .eq("id", user.id)
    .single();

  return data;
}

/* ============================
   FEED / POSTS
============================ */

export async function getRitmoFitStateDb() {
  const sb = ensureSupabase();

  const { data: goals, error } = await sb
    .from("posts")
    .select(`
      *,
      user:user_id (
        id,
        name,
        handle,
        avatar_url
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const formatted =
    goals?.map((p: any) => ({
      ...p,
      ownerName: p.user?.name ?? "Usuário",
      ownerHandle: p.user?.handle ?? "@user",
    })) ?? [];

  return {
    goals: formatted,
    routines: [],
    blockedHandles: [],
  };
}

export async function updateGoalDb(id: string, payload: any) {
  const sb = ensureSupabase();

  const { data, error } = await sb
    .from("posts")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data;
}

/* ============================
   INCENTIVOS / CURTIDAS
============================ */

export async function toggleGoalIncentiveDb(postId: string, type: string) {
  const sb = ensureSupabase();

  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { data: existing } = await sb
    .from("likes")
    .select("*")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .eq("type", type)
    .maybeSingle();

  if (existing) {
    await sb.from("likes").delete().eq("id", existing.id);
  } else {
    await sb.from("likes").insert({
      post_id: postId,
      user_id: user.id,
      type,
    });
  }

  const { data: counts } = await sb
    .from("likes")
    .select("type")
    .eq("post_id", postId);

  const incentives = { apoio: 0, continua: 0, orgulho: 0 };
  counts?.forEach((l: any) => {
    incentives[l.type] = (incentives[l.type] ?? 0) + 1;
  });

  const { data: my } = await sb
    .from("likes")
    .select("type")
    .eq("post_id", postId)
    .eq("user_id", user.id);

  return {
    incentives,
    myIncentives: {
      apoio: my?.some((l) => l.type === "apoio") ?? false,
      continua: my?.some((l) => l.type === "continua") ?? false,
      orgulho: my?.some((l) => l.type === "orgulho") ?? false,
    },
  };
}

/* ============================
   COMENTÁRIOS
============================ */

export async function addGoalCommentDb(postId: string, text: string) {
  const sb = ensureSupabase();

  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { error } = await sb.from("comments").insert({
    post_id: postId,
    user_id: user.id,
    text,
  });

  if (error) throw error;
}

export async function listGoalComments(postId: string) {
  const sb = ensureSupabase();

  const { data, error } = await sb
    .from("comments")
    .select(
      `
      *,
      user:user_id (
        id,
        name,
        handle,
        avatar_url
      )
    `,
    )
    .eq("post_id", postId)
    .order("created_at");

  if (error) throw error;

  return (
    data?.map((c: any) => ({
      ...c,
      authorName: c.user?.name ?? "Usuário",
      authorHandle: c.user?.handle ?? "@user",
    })) ?? []
  );
}

/* ============================
   BLOQUEIO / ROTINAS (stub)
============================ */

export async function blockUserDb() {
  return;
}

export async function copyRoutineDb() {
  return;
}
