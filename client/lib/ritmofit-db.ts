import { supabase } from "./supabase";

/* ============================
   HELPERS
============================ */

function sb() {
  if (!supabase) throw new Error("Supabase não configurado");
  return supabase;
}

/* ============================
   PERFIL
============================ */

export async function getMyProfileDb() {
  const client = sb();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return null;

  const { data, error } = await client
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    handle: "@" + data.name.toLowerCase().replace(/\s+/g, ""),
    avatarUrl: data.avatar_url,
    bio: data.bio,
  };
}

/* ============================
   FEED / POSTS
============================ */

export async function getRitmoFitStateDb() {
  const client = sb();

  const { data, error } = await client
    .from("posts")
    .select(
      `
      *,
      users:user_id (
        id,
        name,
        avatar_url
      )
    `,
    )
    .order("updated_at", { ascending: false });

  if (error) throw error;

  const formatted =
    data?.map((p: any) => ({
      id: p.id,
      title: p.description,
      caption: p.description,
      imageDataUrl: p.photo,
      createdAt: p.updated_at,
      ownerHandle: "@" + p.users?.name?.toLowerCase().replace(/\s+/g, ""),
      ownerName: p.users?.name ?? "Usuário",
      incentives: { apoio: 0, continua: 0, orgulho: 0 },
      myIncentives: {},
      commentsCount: 0,
      completedDays: 0,
      durationDays: 30,
      category: "Treino",
      visibility: "public",
      frequency: "Diária",
    })) ?? [];

  return {
    goals: formatted,
    routines: [],
    blockedHandles: [],
  };
}

/* ============================
   POSTS
============================ */

export async function updateGoalDb(id: string, payload: any) {
  const client = sb();

  const { data, error } = await client
    .from("posts")
    .update({
      description: payload.caption,
      photo: payload.imageDataUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data;
}

/* ============================
   CURTIDAS
============================ */

export async function toggleGoalIncentiveDb(postId: string, type: string) {
  const client = sb();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) throw new Error("Não autenticado");

  const { data: existing } = await client
    .from("likes")
    .select("*")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await client.from("likes").delete().eq("id", existing.id);
  } else {
    await client.from("likes").insert({
      post_id: postId,
      user_id: user.id,
    });
  }

  const { data: all } = await client
    .from("likes")
    .select("id")
    .eq("post_id", postId);

  return {
    incentives: {
      apoio: all?.length ?? 0,
      continua: 0,
      orgulho: 0,
    },
    myIncentives: {
      apoio: !existing,
    },
  };
}

/* ============================
   COMENTÁRIOS
============================ */

export async function addGoalCommentDb(postId: string, text: string) {
  const client = sb();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) throw new Error("Não autenticado");

  const { error } = await client.from("comments").insert({
    post_id: postId,
    user_id: user.id,
    text,
  });

  if (error) throw error;
}

export async function listGoalComments(postId: string) {
  const client = sb();

  const { data, error } = await client
    .from("comments")
    .select(
      `
      *,
      users:user_id (
        id,
        name,
        avatar_url
      )
    `,
    )
    .eq("post_id", postId)
    .order("created_at");

  if (error) throw error;

  return (
    data?.map((c: any) => ({
      id: c.id,
      text: c.text,
      createdAt: c.created_at,
      authorName: c.users?.name ?? "Usuário",
      authorHandle:
        "@" + c.users?.name?.toLowerCase().replace(/\s+/g, "") ?? "@user",
    })) ?? []
  );
}

/* ============================
   STUBS (por enquanto)
============================ */

export async function blockUserDb() {
  return;
}

export async function copyRoutineDb() {
  return;
}
