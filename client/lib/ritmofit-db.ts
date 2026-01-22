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
   FEED
============================ */

export async function getRitmoFitStateDb() {
  const client = sb();

  const { data, error } = await client
    .from("posts")
    .select(
      `
      id,
      description,
      photo,
      updated_at,
      users:user_id (
        id,
        name,
        avatar_url
      )
    `,
    )
    .order("updated_at", { ascending: false });

  if (error) throw error;

  const goals =
    data?.map((p: any) => ({
      id: p.id,
      title: p.description,
      caption: p.description,
      imageDataUrl: p.photo,
      createdAt: p.updated_at,
      ownerHandle: "@" + p.users?.name?.toLowerCase().replace(/\s+/g, ""),
      ownerName: p.users?.name ?? "Usuário",
      incentives: { apoio: 0, continua: 0, orgulho: 0 },
      myInce
