import { getUserSafe, hasSupabaseConfig, supabase } from "@/lib/supabase";

function cleanHandle(raw: string) {
  const slug = raw
    .toLowerCase()
    .replace(/@/g, "")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "");
  return `@${slug || "voce"}`;
}

async function getViewer() {
  if (!hasSupabaseConfig || !supabase) return null;

  try {
    return await getUserSafe();
  } catch {
    return null;
  }
}

export type DbProfile = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl?: string;
};

async function ensureProfile(): Promise<DbProfile | null> {
  const user = await getViewer();
  if (!user || !supabase) return null;

  const email = String(user.email ?? "");
  const emailPrefix = email.includes("@") ? email.split("@")[0] : email;

  const displayName =
    String((user.user_metadata as any)?.full_name ?? "").trim() ||
    emailPrefix ||
    "Você";

  const handle = cleanHandle(
    String((user.user_metadata as any)?.handle ?? "").trim() || emailPrefix,
  );

  const avatarUrl = String(
    (user.user_metadata as any)?.avatar_url ?? "",
  ).trim();

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        display_name: displayName,
        handle,
        avatar_url: avatarUrl || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("id, display_name, handle, avatar_url")
    .maybeSingle();

  if (error) {
    return {
      id: user.id,
      displayName,
      handle,
      avatarUrl: avatarUrl || undefined,
    };
  }

  return {
    id: String(data?.id ?? user.id),
    displayName: String(data?.display_name ?? displayName),
    handle: String(data?.handle ?? handle),
    avatarUrl: (data?.avatar_url as string | null) ?? undefined,
  };
}

export async function getMyProfileDb(): Promise<DbProfile | null> {
  return ensureProfile();
}

/**
 * Post incentive types:
 * 1 = "te apoio" (HeartHandshake)
 * 2 = "continua" (Flame)
 * 3 = "ganhador" (Trophy)
 */
export type PostIncentiveType = 1 | 2 | 3;

export type PostLikeStats = {
  apoio: number; // type 1
  continua: number; // type 2
  ganhador: number; // type 3
};

export type PostWithLikes = {
  id: string;
  description: string;
  photo: string;
  created_at: string;
  user_id: string;
  likes: PostLikeStats;
  userLikes: PostIncentiveType[]; // Types the current user has liked with
};

export async function togglePostIncentiveDb(
  postId: string,
  incentiveType: PostIncentiveType,
) {
  if (!hasSupabaseConfig || !supabase) return;

  const viewer = await getViewer();
  if (!viewer) return;

  const { data: existing } = await supabase
    .from("likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", viewer.id)
    .eq("type", incentiveType)
    .maybeSingle();

  if (existing?.id) {
    // Remove the like
    await supabase.from("likes").delete().eq("id", existing.id);
  } else {
    // Add the like
    await supabase.from("likes").insert({
      post_id: postId,
      user_id: viewer.id,
      type: incentiveType,
    });
  }
}

export async function getPostLikesDb(postId: string): Promise<PostLikeStats> {
  if (!hasSupabaseConfig || !supabase) {
    return { apoio: 0, continua: 0, ganhador: 0 };
  }

  const { data } = await supabase
    .from("likes")
    .select("type")
    .eq("post_id", postId);

  const stats: PostLikeStats = { apoio: 0, continua: 0, ganhador: 0 };

  (data ?? []).forEach((row: any) => {
    const incentiveType = Number(row.type) as PostIncentiveType;
    if (incentiveType === 1) stats.apoio += 1;
    else if (incentiveType === 2) stats.continua += 1;
    else if (incentiveType === 3) stats.ganhador += 1;
  });

  return stats;
}

export async function getUserPostLikesDb(
  postId: string,
): Promise<PostIncentiveType[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const viewer = await getViewer();
  if (!viewer) return [];

  const { data } = await supabase
    .from("likes")
    .select("type")
    .eq("post_id", postId)
    .eq("user_id", viewer.id);

  return (data ?? [])
    .map((row: any) => Number(row.type) as PostIncentiveType)
    .filter((incentiveType): incentiveType is PostIncentiveType =>
      [1, 2, 3].includes(incentiveType),
    );
}

export type PostComment = {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userHandle: string;
  text: string;
  createdAt: string;
};

export async function addPostCommentDb(postId: string, text: string) {
  if (!hasSupabaseConfig || !supabase) return;

  const viewer = await getViewer();
  if (!viewer) return;

  const profile = await ensureProfile();
  const userName = profile?.displayName ?? "Você";
  const userHandle = profile?.handle ?? "@voce";

  const { error } = await supabase.from("comments").insert({
    post_id: postId,
    user_id: viewer.id,
    user_handle: userHandle,
    text: text.trim(),
  });

  if (error) {
    console.error("Error adding comment:", error);
    throw error;
  }
}

export async function getPostCommentsDb(
  postId: string,
): Promise<PostComment[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching comments:", error);
    return [];
  }

  return (data ?? []).map(
    (row: any) =>
      ({
        id: String(row.id),
        postId: String(row.post_id),
        userId: String(row.user_id),
        userName: String(row.user_name ?? "Usuário"),
        userHandle: String(row.user_handle ?? "@user"),
        text: String(row.text ?? ""),
        createdAt: String(row.created_at ?? new Date().toISOString()),
      }) satisfies PostComment,
  );
}

export async function deletePostCommentDb(commentId: string) {
  if (!hasSupabaseConfig || !supabase) return;

  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId);

  if (error) {
    console.error("Error deleting comment:", error);
    throw error;
  }
}

export type ProgrammedGoal = {
  id: string;
  description: string;
  duration: number; // in days
  quantity: number;
  type: number;
};

export async function getProgrammedGoalsDb(): Promise<ProgrammedGoal[]> {
  if (!hasSupabaseConfig || !supabase) {
    console.warn("Supabase not configured");
    return [];
  }

  const { data, error } = await supabase
    .from("goals")
    .select("id, description, duration, quantity, type")
    .order("created_at", { ascending: false });

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error fetching goals [${errorCode}]:`, errorMsg);
    throw new Error(`Falha ao carregar metas: ${errorMsg}`);
  }

  return (data ?? []).map((row: any) =>
    ({
      id: String(row.id),
      description: String(row.description ?? ""),
      duration: Number(row.duration ?? 0),
      quantity: Number(row.quantity ?? 0),
      type: Number(row.type ?? ""),
    }) satisfies ProgrammedGoal,
  );
}

export async function createUserGoalDb(goalId: string, userId: string, typeGoal: string, duration: number, quantity: number) {
  if (!hasSupabaseConfig || !supabase) return;

  const { error } = await supabase.from("user_goals").insert({
    goal_id: goalId,
    user_id: userId,
    type: typeGoal,
    duration,
    quantity,
  });

  if (error) {
    console.error("Error creating user goal:", error);
    throw error;
  }
}
