import { getUserSafe, hasSupabaseConfig, supabase, registerViewerCacheInvalidator } from "@/lib/supabase";

// ─── Input validation helpers ────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUUID(value: string, label: string) {
  if (!UUID_RE.test(value)) throw new Error(`${label} inválido`);
}

function assertMaxLength(value: string, max: number, label: string) {
  if (value.length > max) throw new Error(`${label} muito longo (máximo ${max} caracteres)`);
}

function assertNotEmpty(value: string, label: string) {
  if (!value.trim()) throw new Error(`${label} não pode estar vazio`);
}

// ─── Viewer cache ─────────────────────────────────────────────────────────────
// Viewer cache: avoids redundant auth.getUser() calls within the same operation burst
let _viewerCache: { user: import("@supabase/supabase-js").User | null; expiry: number } | null = null;
const VIEWER_TTL_MS = 5000;

function invalidateViewerCache() {
  _viewerCache = null;
}

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

  // Return cached viewer if still valid
  if (_viewerCache && Date.now() < _viewerCache.expiry) {
    return _viewerCache.user;
  }

  try {
    const user = await getUserSafe();
    _viewerCache = { user, expiry: Date.now() + VIEWER_TTL_MS };
    return user;
  } catch {
    return null;
  }
}

export { invalidateViewerCache };

// Register the cache invalidator so supabase.ts can clear it on sign-out
registerViewerCacheInvalidator(invalidateViewerCache);

export type DbProfile = {
  id: string;
  nickname: string;
  handle: string;
  avatarUrl?: string;
};

async function ensureProfile(): Promise<DbProfile | null> {
  const user = await getViewer();
  if (!user || !supabase) return null;

  const email = String(user.email ?? "");
  const emailPrefix = email.includes("@") ? email.split("@")[0] : email;

  const nickname =
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
        user_id: user.id,
        nickname: nickname,
        handle,
        photo: avatarUrl || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("user_id, nickname, handle, photo")
    .maybeSingle();

  if (error) {
    return {
      id: user.id,
      nickname,
      handle,
      avatarUrl: avatarUrl || undefined,
    };
  }

  return {
    id: String(data?.user_id ?? user.id),
    nickname: String(data?.nickname ?? nickname),
    handle: String(data?.handle ?? handle),
    avatarUrl: (data?.photo as string | null) ?? undefined,
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
 * 4 = "você consegue mais" (Rocket)
 * 5 = "seu limite é maior" (Target)
 * 6 = "aguentava mais 10" (Zap)
 */
export type PostIncentiveType = 1 | 2 | 3 | 4 | 5 | 6;

export type PostLikeStats = {
  apoio: number; // type 1
  continua: number; // type 2
  ganhador: number; // type 3
  consegueMais: number; // type 4
  limiteMaior: number; // type 5
  maisAlgum: number; // type 6
};

export type PostWithLikes = {
  id: string;
  description: string;
  photo: string;
  photos?: string[] | null;
  created_at: string;
  user_id: string;
  user_goal_id?: string | null;
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
    const { error: deleteError } = await supabase
      .from("likes")
      .delete()
      .eq("id", existing.id);
    if (deleteError) throw deleteError;
  } else {
    // Add the like
    const { error: insertError } = await supabase.from("likes").insert({
      post_id: postId,
      user_id: viewer.id,
      type: incentiveType,
    });
    if (insertError) throw insertError;

    // Award 1 point for interacting with a post
    await addPointsDb(1);
  }
}

export async function getPostLikesDb(postId: string): Promise<PostLikeStats> {
  if (!hasSupabaseConfig || !supabase) {
    return { apoio: 0, continua: 0, ganhador: 0, consegueMais: 0, limiteMaior: 0, maisAlgum: 0 };
  }

  // Fetch counts per type in parallel — 6 lightweight HEAD requests instead of fetching all rows
  const [r1, r2, r3, r4, r5, r6] = await Promise.all([
    supabase.from("likes").select("id", { count: "exact", head: true }).eq("post_id", postId).eq("type", 1),
    supabase.from("likes").select("id", { count: "exact", head: true }).eq("post_id", postId).eq("type", 2),
    supabase.from("likes").select("id", { count: "exact", head: true }).eq("post_id", postId).eq("type", 3),
    supabase.from("likes").select("id", { count: "exact", head: true }).eq("post_id", postId).eq("type", 4),
    supabase.from("likes").select("id", { count: "exact", head: true }).eq("post_id", postId).eq("type", 5),
    supabase.from("likes").select("id", { count: "exact", head: true }).eq("post_id", postId).eq("type", 6),
  ]);

  return {
    apoio: r1.count ?? 0,
    continua: r2.count ?? 0,
    ganhador: r3.count ?? 0,
    consegueMais: r4.count ?? 0,
    limiteMaior: r5.count ?? 0,
    maisAlgum: r6.count ?? 0,
  };
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
      [1, 2, 3, 4, 5, 6].includes(incentiveType),
    );
}

export async function getPostLikeUsersDb(postId: string): Promise<Array<{
  userId: string;
  userNickname: string;
  userPhoto: string | null;
  type: number;
}>> {
  if (!hasSupabaseConfig || !supabase) return [];

  try {
    // Get all likes for the post
    const { data: likesData } = await supabase
      .from("likes")
      .select("user_id, type")
      .eq("post_id", postId)
      .order("created_at", { ascending: false });

    if (!likesData || likesData.length === 0) return [];

    // Get unique user IDs
    const userIds = [...new Set(likesData.map((l: any) => l.user_id))];

    // Fetch user profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nickname, photo")
      .in("user_id", userIds);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

    // Combine likes with user info
    const result = likesData
      .map((like: any) => {
        const profile = profileMap.get(like.user_id);
        return {
          userId: like.user_id,
          userNickname: profile?.nickname ?? "Usuário",
          userPhoto: profile?.photo ?? null,
          type: like.type,
        };
      });

    return result;
  } catch (err: any) {
    console.error("Error fetching post like users:", err);
    return [];
  }
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

  assertUUID(postId, "ID do post");
  assertNotEmpty(text, "Comentário");
  assertMaxLength(text.trim(), 500, "Comentário");

  const viewer = await getViewer();
  if (!viewer) return;

  const { error } = await supabase.from("comments").insert({
    post_id: postId,
    user_id: viewer.id,
    text: text.trim(),
  });

  if (error) {
    console.error("Error adding comment:", error);
    throw error;
  }

  // Award 1 point for commenting on a post
  await addPointsDb(1);
}

export async function getPostCommentsDb(
  postId: string,
): Promise<PostComment[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const { data, error } = await supabase
    .from("comments")
    .select("id, post_id, user_id, text, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    console.error("Error fetching comments:", error);
    return [];
  }

  const rows = data ?? [];
  if (rows.length === 0) return [];

  // Batch-fetch nicknames from profiles for all comment authors
  const userIds = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, nickname")
    .in("user_id", userIds);

  const profileMap = new Map(
    (profiles ?? []).map((p: any) => [String(p.user_id), String(p.nickname ?? "Usuário")]),
  );

  return rows.map(
    (row: any) => {
      const nickname = profileMap.get(String(row.user_id)) ?? String(row.user_name ?? "Usuário");
      return {
        id: String(row.id),
        postId: String(row.post_id),
        userId: String(row.user_id),
        userName: nickname,
        userHandle: nickname ? `@${nickname.toLowerCase().replace(/\s+/g, "")}` : "@usuario",
        text: String(row.text ?? ""),
        createdAt: String(row.created_at ?? new Date().toISOString()),
      } satisfies PostComment;
    },
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

export async function markPostCommentsAsReadDb(postId: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  const viewer = await getViewer();
  if (!viewer) return;

  // Get the post to check if user is the owner
  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("user_id")
    .eq("id", postId)
    .maybeSingle();

  if (postError || !post || post.user_id !== viewer.id) return;
}

export type ProgrammedGoal = {
  id: string;
  description: string;
  duration: number; // in days
  quantity: number;
  type: number;
  created_by_user?: number | null; // 1 = user-created, null = default
};

export async function getProgrammedGoalsDb(): Promise<ProgrammedGoal[]> {
  if (!hasSupabaseConfig || !supabase) {
    console.warn("Supabase not configured");
    return [];
  }

  const { data, error } = await supabase
    .from("goals")
    .select("id, description, duration, quantity, type, created_by_user")
    .eq("created_by_user", 0)
    .order("created_at", { ascending: false });

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error fetching goals [${errorCode}]:`, errorMsg);
    throw new Error(`Falha ao carregar metas: ${errorMsg}`);
  }

  return (data ?? []).map(
    (row: any) =>
      ({
        id: String(row.id),
        description: String(row.description ?? ""),
        duration: Number(row.duration ?? 0),
        quantity: Number(row.quantity ?? 0),
        type: Number(row.type ?? ""),
        created_by_user: row.created_by_user != null ? Number(row.created_by_user) : null,
      }) satisfies ProgrammedGoal,
  );
}

export async function createCustomGoalAndSelectDb(
  userId: string,
  description: string,
  type: number,
  duration: number,
  quantity: number,
): Promise<string> {
  if (!hasSupabaseConfig || !supabase) throw new Error("Supabase não configurado");

  assertUUID(userId, "ID do usuário");
  assertNotEmpty(description, "Descrição da meta");
  assertMaxLength(description.trim(), 200, "Descrição da meta");
  if (duration <= 0 || duration > 3650) throw new Error("Duração inválida (1–3650 dias)");
  if (quantity <= 0 || quantity > 100000) throw new Error("Quantidade inválida");

  // Insert goal and link to user in a sequential but validated chain
  const { data, error } = await supabase
    .from("goals")
    .insert({ description: description.trim(), type, duration, quantity, created_by_user: 1 })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating custom goal:", error);
    throw error;
  }

  const goalId = String(data.id);

  try {
    await createUserGoalDb(goalId, userId, type, duration, quantity);
  } catch (linkError) {
    // Attempt to clean up the orphaned goal if linking fails
    try { await supabase.from("goals").delete().eq("id", goalId); } catch { /* ignore */ }
    throw linkError;
  }

  return goalId;
}

export async function createUserGoalDb(
  goalId: string,
  userId: string,
  typeGoal: string | number,
  duration: number,
  quantity: number,
) {
  if (!hasSupabaseConfig || !supabase) return;

  const { error } = await supabase.from("user_goals").insert({
    goal_id: goalId,
    user_id: userId,
    type_goal: typeGoal,
    duration,
    quantity,
  });

  if (error) {
    console.error("Error creating user goal:", error);
    throw error;
  }

  // Award 5 points for selecting a new goal
  await addPointsDb(5);
}

export async function updateUserGoalDb(
  userGoalId: string,
  updates: {
    duration?: number;
    quantity?: number;
    days_completed?: number;
    perc?: number;
  },
) {
  if (!hasSupabaseConfig || !supabase) return;

  const updateData: any = {};

  // Copy duration and quantity as-is
  if (updates.duration !== undefined) updateData.duration = updates.duration;
  if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
  if (updates.days_completed !== undefined)
    updateData.days_completed = updates.days_completed;

  // For perc: use provided value, or calculate from days_completed if available
  if (updates.perc !== undefined) {
    updateData.perc = Math.round(updates.perc);
  }

  const { error } = await supabase
    .from("user_goals")
    .update(updateData)
    .eq("id", userGoalId);

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error updating user goal [${errorCode}]:`, {
      message: errorMsg,
      userGoalId,
      updates: updateData,
    });
    throw new Error(`Failed to update goal: ${errorMsg}`);
  }
}

export async function deleteUserGoalDb(userGoalId: string) {
  if (!hasSupabaseConfig || !supabase) return;

  const { error } = await supabase
    .from("user_goals")
    .delete()
    .eq("id", userGoalId);

  if (error) {
    console.error("Error deleting user goal:", error);
    throw error;
  }
}

export type UserGoal = {
  id: string;
  goal_id: string;
  description: string;
  duration: number;
  quantity: number;
  type_goal: number;
  perc: number;
  days_completed: number;
};

export async function getGoalByIdDb(goalId: string): Promise<UserGoal | null> {
  if (!hasSupabaseConfig || !supabase) return null;
  assertUUID(goalId, "ID da meta");

  const { data, error } = await supabase
    .from("goals")
    .select("id, description, duration, quantity, type")
    .eq("id", goalId)
    .maybeSingle();

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error fetching goal [${errorCode}]:`, errorMsg);
    return null;
  }

  if (!data) return null;

  return {
    id: String(data.id),
    goal_id: String(data.id),
    description: String(data.description ?? ""),
    duration: Number(data.duration ?? 0),
    quantity: Number(data.quantity ?? 0),
    type_goal: Number(data.type ?? 0),
    perc: 0,
    days_completed: 0,
  };
}

export async function getUserGoalsByUserIdDb(
  userId: string,
): Promise<UserGoal[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const mapRows = (rows: any[], descMap: Map<string, string>): UserGoal[] =>
    rows.map((row: any) => {
      const quantity = Number(row.quantity ?? 0);
      const perc = Number(row.perc ?? 0);
      const days_completed = row.days_completed != null
        ? Number(row.days_completed)
        : Math.round((perc / 100) * quantity);
      return {
        id: String(row.id),
        goal_id: String(row.goal_id ?? ""),
        description: descMap.get(String(row.goal_id)) ?? String((row.goals as any)?.description ?? ""),
        duration: Number(row.duration ?? 0),
        quantity,
        type_goal: Number(row.type_goal ?? 0),
        perc,
        days_completed,
      } satisfies UserGoal;
    });

  // Try with embedded join first
  const { data, error } = await supabase
    .from("user_goals")
    .select("id, goal_id, duration, quantity, type_goal, perc, days_completed, goals(description)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!error) {
    return mapRows(data ?? [], new Map());
  }

  // Fallback (any error): fetch without join + manual batch lookup
  console.warn(`[getUserGoalsByUserIdDb] Join failed (${error.code}), using fallback`);
  const { data: fallback, error: fbError } = await supabase
    .from("user_goals")
    .select("id, goal_id, duration, quantity, type_goal, perc, days_completed")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (fbError) {
    console.error(`Error fetching user goals [${fbError.code}]:`, fbError.message);
    return [];
  }

  const goalIds = (fallback ?? []).map((r: any) => r.goal_id).filter(Boolean);
  const descMap = new Map<string, string>();
  if (goalIds.length > 0) {
    const { data: goalsData } = await supabase.from("goals").select("id, description").in("id", goalIds);
    (goalsData ?? []).forEach((g: any) => descMap.set(String(g.id), String(g.description ?? "")));
  }

  return mapRows(fallback ?? [], descMap);
}

export async function getUserGoalsDb(): Promise<UserGoal[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const viewer = await getViewer();
  if (!viewer) return [];

  return getUserGoalsByUserIdDb(viewer.id);
}

export async function getUserGoalByIdDb(
  userGoalId: string,
): Promise<UserGoal | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const buildGoal = (row: any, description: string): UserGoal => {
    const quantity = Number(row.quantity ?? 0);
    const perc = Number(row.perc ?? 0);
    const days_completed = row.days_completed != null
      ? Number(row.days_completed)
      : Math.round((perc / 100) * quantity);
    return {
      id: String(row.id),
      goal_id: String(row.goal_id ?? ""),
      description,
      duration: Number(row.duration ?? 0),
      quantity,
      type_goal: Number(row.type_goal ?? 0),
      perc,
      days_completed,
    };
  };

  // Try with embedded join first
  const { data, error } = await supabase
    .from("user_goals")
    .select("id, goal_id, duration, quantity, type_goal, perc, days_completed, goals(description)")
    .eq("id", userGoalId)
    .maybeSingle();

  if (!error) {
    if (!data) return null;
    return buildGoal(data, String((data.goals as any)?.description ?? ""));
  }

  // Fallback (any error): two sequential queries
  console.warn(`[getUserGoalByIdDb] Join failed (${error.code}), using fallback`);
  const { data: fb } = await supabase
    .from("user_goals")
    .select("id, goal_id, duration, quantity, type_goal, perc, days_completed")
    .eq("id", userGoalId)
    .maybeSingle();
  if (!fb) return null;
  const { data: goalData } = await supabase.from("goals").select("description").eq("id", fb.goal_id).maybeSingle();
  return buildGoal(fb, String(goalData?.description ?? ""));
}

export async function incrementGoalProgressDb(
  userGoalId: string,
): Promise<UserGoal | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const viewer = await getViewer();
  if (!viewer) return null;

  // Increment days_completed by 1
  const { data: currentData, error: fetchError } = await supabase
    .from("user_goals")
    .select("days_completed, duration")
    .eq("id", userGoalId)
    .maybeSingle();

  if (fetchError || !currentData) {
    const errorMsg = fetchError?.message || "Unknown error";
    const errorCode = fetchError?.code || "UNKNOWN";
    console.error(`Error fetching goal progress [${errorCode}]:`, errorMsg);
    return null;
  }

  const currentDaysCompleted = Number(currentData.days_completed ?? 0);
  const duration = Number(currentData.duration ?? 1);
  const newDaysCompleted = Math.min(currentDaysCompleted + 1, duration); // Increment by 1, cap at duration

  // Calculate percentage for perc field based on the NEW value
  const perc = duration > 0 ? (newDaysCompleted / duration) * 100 : 0;

  const { data, error } = await supabase
    .from("user_goals")
    .update({ days_completed: newDaysCompleted, perc: Math.round(perc) })
    .eq("id", userGoalId)
    .eq("user_id", viewer.id)
    .select("id, goal_id, duration, quantity, type_goal, days_completed, perc")
    .maybeSingle();

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error updating goal progress [${errorCode}]:`, errorMsg);
    throw new Error(`Erro ao atualizar progresso: ${errorMsg}`);
  }

  if (!data) return null;

  // Award 1 point for updating a goal
  await addPointsDb(1);

  return {
    id: String(data.id),
    goal_id: String(data.goal_id ?? ""),
    description: "", // Will be fetched separately if needed
    duration: Number(data.duration ?? 0),
    quantity: Number(data.quantity ?? 0),
    type_goal: Number(data.type_goal ?? 0),
    perc: Number(data.perc ?? Math.round(perc)),
    days_completed: newDaysCompleted,
  };
}

export async function getUserSelectedGoalIdsDb(): Promise<string[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const viewer = await getViewer();
  if (!viewer) return [];

  const { data, error } = await supabase
    .from("user_goals")
    .select("goal_id")
    .eq("user_id", viewer.id);

  if (error) {
    console.error("Error fetching user selected goal IDs:", error);
    return [];
  }

  return (data ?? []).map((row: any) => String(row.goal_id ?? ""));
}

export type UserProfile = {
  id: string;
  nickname: string;
  bio: string;
  photo: string | null;
  objectives?: string[] | null;
};

export async function getUserProfileDb(
  userId: string,
): Promise<UserProfile | null> {
  if (!hasSupabaseConfig || !supabase) return null;
  assertUUID(userId, "ID do usuário");

  const { data, error } = await supabase
    .from("profiles")
    .select("id, nickname, bio, photo, objectives")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error fetching user profile [${errorCode}]:`, errorMsg);
    return null;
  }

  if (!data) return null;

  return {
    id: String(data.id ?? ""),
    nickname: String(data.nickname ?? ""),
    bio: String(data.bio ?? ""),
    photo: data.photo ? String(data.photo) : null,
  };
}

export async function updateUserProfileDb(
  userId: string,
  updates: { nickname?: string; bio?: string; photo?: string | null },
): Promise<UserProfile | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("user_id", userId)
    .select("id, nickname, bio, photo")
    .maybeSingle();

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error updating user profile [${errorCode}]:`, errorMsg);
    throw new Error(`Erro ao atualizar perfil: ${errorMsg}`);
  }

  if (!data) return null;

  return {
    id: String(data.id ?? ""),
    nickname: String(data.nickname ?? ""),
    bio: String(data.bio ?? ""),
    photo: data.photo ? String(data.photo) : null,
  };
}

export type PostWithUser = {
  id: string;
  description: string;
  photo: string;
  photos?: string[] | null;
  created_at: string;
  user_id: string;
  user_goal_id?: string | null;
  userNickname: string;
  userPhoto: string | null;
};

export async function getUserPostsDb(userId: string): Promise<PostWithUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const { data, error } = await supabase
    .from("posts")
    .select("id, description, photo, photos, created_at, user_id, user_goal_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error fetching user posts [${errorCode}]:`, errorMsg);
    return [];
  }

  // Fetch user profile info
  const userProfile = await getUserProfileDb(userId);
  const userNickname = userProfile?.nickname || "Usuário";
  const userPhoto = userProfile?.photo || null;

  return (data ?? []).map((row: any) => ({
    id: String(row.id ?? ""),
    description: String(row.description ?? ""),
    photo: String(row.photo ?? ""),
    photos: Array.isArray(row.photos) ? row.photos : null,
    created_at: String(row.created_at ?? ""),
    user_id: String(row.user_id ?? ""),
    userNickname,
    userPhoto,
  }));
}

export async function getPostByIdDb(postId: string): Promise<PostWithUser | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  assertUUID(postId, "ID do post");

  const { data, error } = await supabase
    .from("posts")
    .select("id, description, photo, photos, created_at, user_id, user_goal_id")
    .eq("id", postId)
    .maybeSingle();

  if (error || !data) return null;

  const userProfile = await getUserProfileDb(String(data.user_id));
  return {
    id: String(data.id),
    description: String(data.description ?? ""),
    photo: String(data.photo ?? ""),
    photos: Array.isArray(data.photos) ? data.photos : null,
    created_at: String(data.created_at ?? ""),
    user_id: String(data.user_id),
    user_goal_id: data.user_goal_id ?? null,
    userNickname: userProfile?.nickname || "Usuário",
    userPhoto: userProfile?.photo || null,
  };
}

export type UserStats = {
  postsCount: number;
  followersCount: number;
  followingCount: number;
  points: number;
  level: number;
};

export async function getWorkoutsDb(): Promise<Workout[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const { data, error } = await supabase
    .from("workouts")
    .select("id, name, description, photo, muscle_group")
    .order("created_at", { ascending: false });

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error fetching workouts [${errorCode}]:`, errorMsg);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    photo: row.photo ? String(row.photo) : null,
    muscle_group: row.muscle_group ? String(row.muscle_group) : null,
  }));
}

export async function bulkUpsertCatalogWorkoutsDb(
  exercises: Array<{ name: string; description: string; muscleGroup: string; photo: string | null; wgerId: number }>
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  const rows = exercises.map((ex) => ({
    name: ex.name,
    description: ex.description,
    muscle_group: ex.muscleGroup || null,
    photo: ex.photo || null,
    wger_id: ex.wgerId,
  }));

  // Upsert in batches of 100 to avoid request size limits
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    await supabase
      .from("workouts")
      .upsert(batch, { onConflict: "wger_id", ignoreDuplicates: false });
  }
}

export async function getCatalogWorkoutsFromDb(): Promise<Array<{
  id: string; name: string; description: string; muscleGroup: string; photo: string | null; wgerId: number | null;
}>> {
  if (!hasSupabaseConfig || !supabase) return [];

  const { data } = await supabase
    .from("workouts")
    .select("id, name, description, muscle_group, photo, wger_id")
    .not("wger_id", "is", null)
    .not("photo", "is", null);

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    muscleGroup: String(row.muscle_group ?? ""),
    photo: row.photo ? String(row.photo) : null,
    wgerId: row.wger_id ? Number(row.wger_id) : null,
  }));
}

export async function createCustomWorkoutDb(
  name: string,
  description: string,
  muscleGroup: string,
  photo?: string | null,
): Promise<Workout> {
  if (!hasSupabaseConfig || !supabase) throw new Error("Supabase não configurado");

  const insertData: Record<string, any> = { name, description, muscle_group: muscleGroup || null };
  if (photo) insertData.photo = photo;

  const { data, error } = await supabase
    .from("workouts")
    .insert(insertData)
    .select("id, name, description, photo, muscle_group")
    .single();

  if (error) {
    console.error("Error creating custom workout:", error);
    throw error;
  }

  return {
    id: String(data.id),
    name: String(data.name),
    description: String(data.description ?? ""),
    photo: data.photo ? String(data.photo) : null,
    muscle_group: data.muscle_group ? String(data.muscle_group) : null,
  };
}

export async function getUserStatsDb(userId: string): Promise<UserStats> {
  if (!hasSupabaseConfig || !supabase) {
    return { postsCount: 0, followersCount: 0, followingCount: 0, points: 0, level: 1 };
  }

  // Run all queries in parallel
  const [postsRes, followersRes, followingRes, rankingRes] = await Promise.all([
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("following").select("id", { count: "exact", head: true }).eq("following_id", userId),
    supabase.from("following").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("ranking").select("points, level").eq("user_id", userId).single(),
  ]);

  if (postsRes.error) {
    console.error(`Error fetching posts stats:`, postsRes.error?.message);
  }

  const points = Number(rankingRes.data?.points ?? 0);
  const level = Number(rankingRes.data?.level ?? Math.floor(points / 100) + 1);

  return {
    postsCount: postsRes.count ?? 0,
    followersCount: followersRes.count ?? 0,
    followingCount: followingRes.count ?? 0,
    points,
    level,
  };
}

// Routine type constants
export const ROUTINE_TYPES = {
  1: "Exercicios",
  2: "Dietas",
  3: "Habitos",
} as const;

export type RoutineTypeCode = 1 | 2 | 3;
export type RoutineType = (typeof ROUTINE_TYPES)[RoutineTypeCode];

export function getRoutineTypeName(code: number): string {
  return ROUTINE_TYPES[code as RoutineTypeCode] || "Desconhecido";
}

export type Routine = {
  id: string;
  user_id: string;
  type: number;
  goal_id: string | null;
  name?: string;
};

export type Workout = {
  id: string;
  name: string;
  description: string;
  photo: string | null;
  muscle_group?: string | null;
};

export type Diet = {
  id: string;
  name: string;
  description: string;
  photo: string | null;
};

export async function getDietsDb(): Promise<Diet[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const { data, error } = await supabase
    .from("diets")
    .select("id, name, description, photo")
    .order("created_at", { ascending: false });

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error fetching diets [${errorCode}]:`, errorMsg);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    photo: row.photo ? String(row.photo) : null
  }));
}

export async function bulkUpsertCatalogDietsDb(
  meals: Array<{ name: string; description: string; category: string; photo: string | null; mealdbId: number }>
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  const rows = meals.map((m) => ({
    name: m.name,
    description: m.description,
    photo: m.photo || null,
    mealdb_id: m.mealdbId,
    category: m.category,
  }));

  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    await supabase
      .from("diets")
      .upsert(batch, { onConflict: "mealdb_id", ignoreDuplicates: false });
  }
}

export async function getCatalogDietsFromDb(): Promise<Array<{
  id: string; name: string; description: string; category: string; photo: string | null; mealdbId: number | null;
}>> {
  if (!hasSupabaseConfig || !supabase) return [];

  const { data } = await supabase
    .from("diets")
    .select("id, name, description, photo, category, mealdb_id")
    .not("mealdb_id", "is", null)
    .not("photo", "is", null);

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    category: String(row.category ?? ""),
    photo: row.photo ? String(row.photo) : null,
    mealdbId: row.mealdb_id ? Number(row.mealdb_id) : null,
  }));
}

export async function createCustomDietDb(
  name: string,
  description: string,
  photo?: string | null,
): Promise<Diet> {
  if (!hasSupabaseConfig || !supabase) throw new Error("Supabase não configurado");

  const insertData: Record<string, any> = { name, description };
  if (photo) insertData.photo = photo;

  const { data, error } = await supabase
    .from("diets")
    .insert(insertData)
    .select("id, name, description, photo")
    .single();

  if (error) {
    console.error("Error creating custom diet:", error);
    throw error;
  }

  return {
    id: String(data.id),
    name: String(data.name),
    description: String(data.description ?? ""),
    photo: data.photo ? String(data.photo) : null
  };
}

export type Habit = {
  id: string;
  name: string;
  description: string;
  photo: string | null;
};

export async function getHabitsDb(): Promise<Habit[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const { data, error } = await supabase
    .from("habits")
    .select("id, name, description, photo")
    .order("created_at", { ascending: false });

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error fetching habits [${errorCode}]:`, errorMsg);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    photo: row.photo ? String(row.photo) : null,
  }));
}

export async function getUserRoutinesDb(userId: string): Promise<Routine[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const { data, error } = await supabase
    .from("routines")
    .select("id, user_id, type, goal_id, name")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error fetching user routines [${errorCode}]:`, errorMsg);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id ?? ""),
    user_id: String(row.user_id ?? ""),
    type: Number(row.type ?? 1),
    goal_id: row.goal_id ? String(row.goal_id) : null,
    name: row.name ? String(row.name) : undefined,
  }));
}

export async function createRoutineDb(
  userId: string,
  type: RoutineTypeCode,
  name?: string,
): Promise<Routine | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const { data, error } = await supabase
    .from("routines")
    .insert({
      user_id: userId,
      type,
      name: name || null,
    })
    .select("id, user_id, type, goal_id, name")
    .maybeSingle();

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error creating routine [${errorCode}]:`, errorMsg);
    throw new Error(`Erro ao criar rotina: ${errorMsg}`);
  }

  if (!data) return null;

  return {
    id: String(data.id ?? ""),
    user_id: String(data.user_id ?? ""),
    type: Number(data.type ?? 1),
    goal_id: data.goal_id ? String(data.goal_id) : null,
    name: data.name ? String(data.name) : undefined,
  };
}

export async function updateRoutineGoalDb(
  routineId: string,
  goalId: string | null,
): Promise<Routine | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const { data, error } = await supabase
    .from("routines")
    .update({
      goal_id: goalId,
    })
    .eq("id", routineId)
    .select("id, user_id, type, goal_id, name")
    .maybeSingle();

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error updating routine goal [${errorCode}]:`, errorMsg);
    throw new Error(`Erro ao atualizar meta da rotina: ${errorMsg}`);
  }

  if (!data) return null;

  return {
    id: String(data.id ?? ""),
    user_id: String(data.user_id ?? ""),
    type: Number(data.type ?? 1),
    goal_id: data.goal_id ? String(data.goal_id) : null,
    name: data.name ? String(data.name) : undefined,
  };
}

export async function updateRoutineNameDb(
  userId: string,
  oldName: string | null | undefined,
  typeCode: number,
  newName: string,
): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  let query = supabase
    .from("routines")
    .update({ name: newName.trim() || null })
    .eq("user_id", userId)
    .eq("type", typeCode);

  if (oldName) {
    query = query.eq("name", oldName);
  } else {
    query = query.is("name", null);
  }

  const { error } = await query;

  if (error) {
    console.error("Error updating routine name:", error);
    return false;
  }

  // Also update user_workouts / user_diets / user_habits name column
  if (typeCode === 1) {
    let wQuery = supabase.from("user_workouts").update({ name: newName.trim() || null }).eq("user_id", userId);
    wQuery = oldName ? wQuery.eq("name", oldName) : wQuery.is("name", null);
    await wQuery;
  } else if (typeCode === 2) {
    let dQuery = supabase.from("user_diets").update({ name: newName.trim() || null }).eq("user_id", userId);
    dQuery = oldName ? dQuery.eq("name", oldName) : dQuery.is("name", null);
    await dQuery;
  } else if (typeCode === 3) {
    let hQuery = supabase.from("user_habits").update({ name: newName.trim() || null }).eq("user_id", userId);
    hQuery = oldName ? hQuery.eq("name", oldName) : hQuery.is("name", null);
    await hQuery;
  }

  return true;
}

export async function deleteRoutinesOfTypeDb(
  userId: string,
  type: RoutineTypeCode,
): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  try {
    // Delete routines of the specified type for the user
    const { error } = await supabase
      .from("routines")
      .delete()
      .eq("user_id", userId)
      .eq("type", type);

    if (error) throw error;
    return true;
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    const errorCode = err?.code || "UNKNOWN";
    console.error(`Error deleting routines of type [${errorCode}]:`, errorMsg);
    throw new Error(`Erro ao deletar rotina: ${errorMsg}`);
  }
}

// Get items for a specific routine (by userId + routineName + type) — works for other users via workouts/diets/habits catalog join
export async function getRoutineItemsForViewDb(
  userId: string,
  type: number,
  routineName: string | undefined,
): Promise<Array<{ id: string; workoutName?: string; dietName?: string; habitName?: string }>> {
  if (!hasSupabaseConfig || !supabase) return [];

  try {
    if (type === 1) {
      // Step 1: get user_workouts rows (no join — FK points to user_workouts_hist not workouts)
      const query = supabase
        .from("user_workouts")
        .select("id, workout_id, name")
        .eq("user_id", userId);
      const { data, error } = routineName
        ? await query.eq("name", routineName)
        : await query.is("name", null);
      if (error || !data || data.length === 0) return [];

      // Step 2: fetch workout names from workouts table
      const workoutIds = [...new Set(data.map((r: any) => r.workout_id).filter(Boolean))];
      const { data: workoutsData } = workoutIds.length > 0
        ? await supabase.from("workouts").select("id, name").in("id", workoutIds)
        : { data: [] };
      const nameMap = new Map((workoutsData ?? []).map((w: any) => [String(w.id), String(w.name)]));

      const seen = new Set<string>();
      return data.filter((r: any) => {
        const k = r.workout_id ?? r.id;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }).map((r: any) => ({
        id: String(r.id),
        workoutName: nameMap.get(String(r.workout_id)) || "Exercício",
      }));

    } else if (type === 2) {
      const query = supabase
        .from("user_diets")
        .select("id, diet_id, name")
        .eq("user_id", userId);
      const { data, error } = routineName
        ? await query.eq("name", routineName)
        : await query.is("name", null);
      if (error || !data || data.length === 0) return [];

      const dietIds = [...new Set(data.map((r: any) => r.diet_id).filter(Boolean))];
      const { data: dietsData } = dietIds.length > 0
        ? await supabase.from("diets").select("id, name").in("id", dietIds)
        : { data: [] };
      const nameMap = new Map((dietsData ?? []).map((d: any) => [String(d.id), String(d.name)]));

      const seen = new Set<string>();
      return data.filter((r: any) => {
        const k = r.diet_id ?? r.id;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }).map((r: any) => ({
        id: String(r.id),
        dietName: nameMap.get(String(r.diet_id)) || "Dieta",
      }));

    } else {
      const query = supabase
        .from("user_habits")
        .select("id, habit_id, name")
        .eq("user_id", userId);
      const { data, error } = routineName
        ? await query.eq("name", routineName)
        : await query.is("name", null);
      if (error || !data || data.length === 0) return [];

      const habitIds = [...new Set(data.map((r: any) => r.habit_id).filter(Boolean))];
      const { data: habitsData } = habitIds.length > 0
        ? await supabase.from("habits").select("id, name").in("id", habitIds)
        : { data: [] };
      const nameMap = new Map((habitsData ?? []).map((h: any) => [String(h.id), String(h.name)]));

      const seen = new Set<string>();
      return data.filter((r: any) => {
        const k = r.habit_id ?? r.id;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }).map((r: any) => ({
        id: String(r.id),
        habitName: nameMap.get(String(r.habit_id)) || "Hábito",
      }));
    }
  } catch (err) {
    console.error("Error fetching routine items for view:", err);
    return [];
  }
}

export async function getRoutinesByGoalIdDb(
  goalId: string,
): Promise<Routine[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const { data, error } = await supabase
    .from("routines")
    .select("id, user_id, type, goal_id, name")
    .eq("goal_id", goalId);

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error fetching routines by goal [${errorCode}]:`, errorMsg);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id ?? ""),
    user_id: String(row.user_id ?? ""),
    type: Number(row.type ?? 1),
    goal_id: row.goal_id ? String(row.goal_id) : null,
    name: row.name ? String(row.name) : undefined,
  }));
}

export type ExerciseRoutine = {
  id: string;
  routineId: string;
  userId: string;
  exerciseName: string;
  exercisePhoto?: string | null;
};

export async function getUserExerciseRoutinesDb(userId: string): Promise<ExerciseRoutine[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  try {
    // Get user routines of type 1 (Exercicios) directly
    const { data: routines, error: routinesError } = await supabase
      .from("routines")
      .select("id, user_id, type, name")
      .eq("user_id", userId)
      .eq("type", 1)
      .order("created_at", { ascending: false });

    if (routinesError) {
      const errorMsg = routinesError?.message || String(routinesError);
      const errorCode = routinesError?.code || "UNKNOWN";
      console.error(`Error fetching exercise routines [${errorCode}]:`, errorMsg);
      return [];
    }

    if (!routines || routines.length === 0) return [];

    const result: ExerciseRoutine[] = [];
    let hasUnnamed = false;
    const seenNames = new Set<string>();

    for (const routine of routines) {
      if (routine.name) {
        // Named routines — deduplicate by name
        if (!seenNames.has(routine.name)) {
          seenNames.add(routine.name);
          result.push({
            id: String(routine.id ?? ""),
            routineId: String(routine.id ?? ""),
            userId: String(routine.user_id ?? ""),
            exerciseName: String(routine.name),
            exercisePhoto: null,
          });
        }
      } else {
        hasUnnamed = true;
      }
    }

    // All unnamed routines are grouped into a single entry
    if (hasUnnamed) {
      result.push({
        id: "__unnamed__",
        routineId: "__unnamed__",
        userId: userId,
        exerciseName: "Rotina de Exercícios",
        exercisePhoto: null,
      });
    }

    return result;
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error(`Unexpected error fetching exercise routines:`, errorMsg);
    return [];
  }
}

export type UserWorkout = {
  id: string;
  workout_id: string;
  user_id: string;
  name?: string | null;
};

export async function createUserWorkoutsDb(
  userId: string,
  workoutIds: string[],
  options?: {
    name?: string;
  },
): Promise<UserWorkout[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const workoutsToInsert = workoutIds.map((workoutId) => ({
    workout_id: workoutId,
    user_id: userId,
    name: options?.name || null,
  }));

  const { data, error } = await supabase
    .from("user_workouts")
    .insert(workoutsToInsert)
    .select(
      "id, workout_id, user_id, name",
    );

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error creating user workouts [${errorCode}]:`, errorMsg);
    throw new Error(`Erro ao salvar exercícios: ${errorMsg}`);
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id ?? ""),
    workout_id: String(row.workout_id ?? ""),
    user_id: String(row.user_id ?? ""),
    name: row.name ? String(row.name) : null,
  }));
}

export type UserWorkoutWithDetails = {
  id: string;
  workout_id: string;
  user_id: string;
  name?: string | null;
  workoutName?: string;
  workoutPhoto?: string | null;
  workoutDescription?: string;
  muscle_group?: string | null;
  created_at?: string | null;
};

export async function getUserWorkoutsDb(
  userId: string,
): Promise<UserWorkoutWithDetails[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const { data, error } = await supabase
    .from("user_workouts")
    .select(
      "id, workout_id, user_id, name, created_at, workouts(name, photo, description, muscle_group)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    const errorDetails = (error?.details || error?.message || "").toLowerCase();

    // Silently handle relationship errors - try without join and fetch workouts separately
    if (
      errorDetails.includes("relationship") ||
      errorCode === "PGRST200" ||
      errorMsg.includes("relationship")
    ) {
      console.warn(
        `[getUserWorkoutsDb] Relationship error detected, using fallback method: ${errorMsg}`,
      );

      const { data: dataFallback, error: errorFallback } = await supabase
        .from("user_workouts")
        .select(
          "id, workout_id, user_id, name, created_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!errorFallback && dataFallback) {
        // Fetch workout details separately
        const workoutIds = dataFallback
          .map((row: any) => row.workout_id)
          .filter(Boolean);
        const workoutDetailsMap: { [key: string]: any } = {};

        if (workoutIds.length > 0) {
          const { data: workoutsData } = await supabase
            .from("workouts")
            .select("id, name, photo, description, muscle_group")
            .in("id", workoutIds);

          if (workoutsData) {
            workoutsData.forEach((w: any) => {
              workoutDetailsMap[String(w.id)] = w;
            });
          }
        }

        return (dataFallback ?? []).map((row: any) => {
          const workoutDetails = workoutDetailsMap[String(row.workout_id)];
          return {
            id: String(row.id ?? ""),
            workout_id: String(row.workout_id ?? ""),
            user_id: String(row.user_id ?? ""),
            name: row.name ? String(row.name) : null,
            workoutName: workoutDetails?.name || "Exercício desconhecido",
            workoutPhoto: workoutDetails?.photo || null,
            workoutDescription: workoutDetails?.description || undefined,
            muscle_group: workoutDetails?.muscle_group || null,
            created_at: row.created_at ? String(row.created_at) : null,
          };
        });
      } else if (errorFallback) {
        const fallbackMsg = errorFallback?.message || String(errorFallback);
        const fallbackCode = errorFallback?.code || "UNKNOWN";
        console.error(
          `[getUserWorkoutsDb] Fallback also failed [${fallbackCode}]:`,
          fallbackMsg,
        );
      }
    }

    console.error(`Error fetching user workouts [${errorCode}]:`, errorMsg);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id ?? ""),
    workout_id: String(row.workout_id ?? ""),
    user_id: String(row.user_id ?? ""),
    name: row.name ? String(row.name) : null,
    workoutName: (row.workouts as any)?.name || "Exercício desconhecido",
    workoutPhoto: (row.workouts as any)?.photo || null,
    workoutDescription: (row.workouts as any)?.description || undefined,
    muscle_group: (row.workouts as any)?.muscle_group || null,
    created_at: row.created_at ? String(row.created_at) : null,
  }));
}

export type UserDiet = {
  id: string;
  diet_id: string;
  user_id: string;
  name?: string | null;
};

export async function createUserDietsDb(
  userId: string,
  dietIds: string[],
  options?: {
    name?: string;
  },
): Promise<UserDiet[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const dietsToInsert = dietIds.map((dietId) => ({
    diet_id: dietId,
    user_id: userId,
    name: options?.name || null,
  }));

  const { data, error } = await supabase
    .from("user_diets")
    .insert(dietsToInsert)
    .select("id, diet_id, user_id, name");

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error creating user diets [${errorCode}]:`, errorMsg);
    throw new Error(`Erro ao salvar dietas: ${errorMsg}`);
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id ?? ""),
    diet_id: String(row.diet_id ?? ""),
    user_id: String(row.user_id ?? ""),
    name: row.name ? String(row.name) : null,
  }));
}

export type UserDietWithDetails = {
  id: string;
  diet_id: string;
  user_id: string;
  name?: string | null;
  dietName?: string;
  dietPhoto?: string | null;
  dietDescription?: string;
  is_completed?: boolean | null;
  completed_at?: string | null;
};

export async function getUserDietsDb(
  userId: string,
): Promise<UserDietWithDetails[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const { data, error } = await supabase
    .from("user_diets")
    .select(
      "id, diet_id, user_id, name, is_completed, completed_at, diets(name, photo, description)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    const errorDetails = (error?.details || error?.message || "").toLowerCase();

    // Silently handle relationship errors - try without join and fetch diets separately
    if (
      errorDetails.includes("relationship") ||
      errorCode === "PGRST200" ||
      errorMsg.includes("relationship")
    ) {
      console.warn(
        `[getUserDietsDb] Relationship error detected, using fallback method: ${errorMsg}`,
      );

      const { data: dataFallback, error: errorFallback } = await supabase
        .from("user_diets")
        .select("id, diet_id, user_id, name, is_completed, completed_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!errorFallback && dataFallback) {
        // Fetch diet details separately
        const dietIds = dataFallback
          .map((row: any) => row.diet_id)
          .filter(Boolean);
        const dietDetailsMap: { [key: string]: any } = {};

        if (dietIds.length > 0) {
          const { data: dietsData } = await supabase
            .from("diets")
            .select("id, name, photo, description")
            .in("id", dietIds);

          if (dietsData) {
            dietsData.forEach((d: any) => {
              dietDetailsMap[String(d.id)] = d;
            });
          }
        }

        return (dataFallback ?? []).map((row: any) => {
          const dietDetails = dietDetailsMap[String(row.diet_id)];
          return {
            id: String(row.id ?? ""),
            diet_id: String(row.diet_id ?? ""),
            user_id: String(row.user_id ?? ""),
            name: row.name ? String(row.name) : null,
            dietName: dietDetails?.name || "Dieta desconhecida",
            dietPhoto: dietDetails?.photo || null,
            dietDescription: dietDetails?.description || undefined,
            is_completed: row.is_completed ?? false,
            completed_at: row.completed_at ?? null,
          };
        });
      } else if (errorFallback) {
        const fallbackMsg = errorFallback?.message || String(errorFallback);
        const fallbackCode = errorFallback?.code || "UNKNOWN";
        console.error(
          `[getUserDietsDb] Fallback also failed [${fallbackCode}]:`,
          fallbackMsg,
        );
      }
    }

    // Last-resort fallback: columns is_completed/completed_at may not exist yet — fetch without them
    console.warn(`[getUserDietsDb] Trying minimal fallback without is_completed/completed_at: ${errorMsg}`);
    const { data: minData, error: minError } = await supabase
      .from("user_diets")
      .select("id, diet_id, user_id, name, diets(name, photo, description)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!minError && minData) {
      return (minData ?? []).map((row: any) => ({
        id: String(row.id ?? ""),
        diet_id: String(row.diet_id ?? ""),
        user_id: String(row.user_id ?? ""),
        name: row.name ? String(row.name) : null,
        dietName: (row.diets as any)?.name || "Dieta desconhecida",
        dietPhoto: (row.diets as any)?.photo || null,
        dietDescription: (row.diets as any)?.description || undefined,
        is_completed: false,
        completed_at: null,
      }));
    }

    console.error(`Error fetching user diets [${errorCode}]:`, errorMsg);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id ?? ""),
    diet_id: String(row.diet_id ?? ""),
    user_id: String(row.user_id ?? ""),
    name: row.name ? String(row.name) : null,
    dietName: (row.diets as any)?.name || "Dieta desconhecida",
    dietPhoto: (row.diets as any)?.photo || null,
    dietDescription: (row.diets as any)?.description || undefined,
    is_completed: row.is_completed ?? false,
    completed_at: row.completed_at ?? null,
  }));
}

export type UserHabit = {
  id: string;
  habit_id: string;
  user_id: string;
  name?: string | null;
};

export async function createUserHabitsDb(
  userId: string,
  habitIds: string[],
  options?: {
    name?: string;
  },
): Promise<UserHabit[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const habitsToInsert = habitIds.map((habitId) => ({
    habit_id: habitId,
    user_id: userId,
    name: options?.name || null,
  }));

  const { data, error } = await supabase
    .from("user_habits")
    .insert(habitsToInsert)
    .select("id, habit_id, user_id, name");

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error creating user habits [${errorCode}]:`, errorMsg);
    throw new Error(`Erro ao salvar hábitos: ${errorMsg}`);
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id ?? ""),
    habit_id: String(row.habit_id ?? ""),
    user_id: String(row.user_id ?? ""),
    name: row.name ? String(row.name) : null,
  }));
}

export type UserHabitWithDetails = {
  id: string;
  habit_id: string;
  user_id: string;
  name?: string | null;
  habitName?: string;
  habitPhoto?: string | null;
  habitDescription?: string;
  is_completed?: boolean | null;
  completed_at?: string | null;
};

export async function getUserHabitsDb(
  userId: string,
): Promise<UserHabitWithDetails[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const { data, error } = await supabase
    .from("user_habits")
    .select("id, habit_id, user_id, name, is_completed, completed_at, habits(name, photo, description)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    const errorDetails = (error?.details || error?.message || "").toLowerCase();

    // Silently handle relationship errors - try without join and fetch habits separately
    if (
      errorDetails.includes("relationship") ||
      errorCode === "PGRST200" ||
      errorMsg.includes("relationship")
    ) {
      console.warn(
        `[getUserHabitsDb] Relationship error detected, using fallback method: ${errorMsg}`,
      );

      const { data: dataFallback, error: errorFallback } = await supabase
        .from("user_habits")
        .select("id, habit_id, user_id, name, is_completed, completed_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!errorFallback && dataFallback) {
        // Fetch habit details separately
        const habitIds = dataFallback
          .map((row: any) => row.habit_id)
          .filter(Boolean);
        const habitDetailsMap: { [key: string]: any } = {};

        if (habitIds.length > 0) {
          const { data: habitsData } = await supabase
            .from("habits")
            .select("id, name, photo, description")
            .in("id", habitIds);

          if (habitsData) {
            habitsData.forEach((h: any) => {
              habitDetailsMap[String(h.id)] = h;
            });
          }
        }

        return (dataFallback ?? []).map((row: any) => {
          const habitDetails = habitDetailsMap[String(row.habit_id)];
          return {
            id: String(row.id ?? ""),
            habit_id: String(row.habit_id ?? ""),
            user_id: String(row.user_id ?? ""),
            name: row.name ? String(row.name) : null,
            habitName: habitDetails?.name || "Hábito desconhecido",
            habitPhoto: habitDetails?.photo || null,
            habitDescription: habitDetails?.description || undefined,
            is_completed: row.is_completed ?? false,
            completed_at: row.completed_at ?? null,
          };
        });
      } else if (errorFallback) {
        const fallbackMsg = errorFallback?.message || String(errorFallback);
        const fallbackCode = errorFallback?.code || "UNKNOWN";
        console.error(
          `[getUserHabitsDb] Fallback also failed [${fallbackCode}]:`,
          fallbackMsg,
        );
      }
    }

    // Last-resort fallback: columns is_completed/completed_at may not exist yet — fetch without them
    console.warn(`[getUserHabitsDb] Trying minimal fallback without is_completed/completed_at: ${errorMsg}`);
    const { data: minData, error: minError } = await supabase
      .from("user_habits")
      .select("id, habit_id, user_id, name, habits(name, photo, description)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!minError && minData) {
      return (minData ?? []).map((row: any) => ({
        id: String(row.id ?? ""),
        habit_id: String(row.habit_id ?? ""),
        user_id: String(row.user_id ?? ""),
        name: row.name ? String(row.name) : null,
        habitName: (row.habits as any)?.name || "Hábito desconhecido",
        habitPhoto: (row.habits as any)?.photo || null,
        habitDescription: (row.habits as any)?.description || undefined,
        is_completed: false,
        completed_at: null,
      }));
    }

    console.error(`Error fetching user habits [${errorCode}]:`, errorMsg);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id ?? ""),
    habit_id: String(row.habit_id ?? ""),
    user_id: String(row.user_id ?? ""),
    name: row.name ? String(row.name) : null,
    habitName: (row.habits as any)?.name || "Hábito desconhecido",
    habitPhoto: (row.habits as any)?.photo || null,
    habitDescription: (row.habits as any)?.description || undefined,
    is_completed: row.is_completed ?? false,
    completed_at: row.completed_at ?? null,
  }));
}

// Search Functions

export type SearchUser = {
  id: string;
  nickname: string;
  bio?: string;
  photo?: string | null;
};

export async function searchUsersDb(query: string): Promise<SearchUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  if (!query.trim()) return [];

  const searchQuery = `%${query.toLowerCase()}%`;

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, nickname, bio, photo")
    .ilike("nickname", searchQuery)
    .limit(20);

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error searching users [${errorCode}]:`, errorMsg);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.user_id ?? ""),
    nickname: String(row.nickname ?? "Usuário"),
    bio: row.bio ? String(row.bio) : undefined,
    photo: row.photo ? String(row.photo) : null,
  }));
}

export type SearchWorkout = {
  id: string;
  userWorkoutId: string;
  userId: string;
  userName: string;
  userPhoto?: string | null;
  workoutName: string;
  workoutDescription?: string;
  workoutPhoto?: string | null;
};

export async function searchUserWorkoutsDb(
  query: string,
): Promise<SearchWorkout[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  if (!query.trim()) return [];

  const searchQuery = `%${query.toLowerCase()}%`;

  const { data, error } = await supabase
    .from("user_workouts")
    .select(
      "id, user_id, workout_id, workouts(id, name, description, photo), profiles(nickname, photo)",
    )
    .ilike("workouts.name", searchQuery)
    .limit(20);

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    const errorDetails = error?.details || "";

    if (errorDetails.includes("relationship")) {
      // Fallback: fetch user workouts and fetch workout/profile details separately
      const { data: dataFallback } = await supabase
        .from("user_workouts")
        .select("id, user_id, workout_id")
        .limit(100);

      if (dataFallback) {
        const workoutIds = [
          ...new Set(dataFallback.map((w: any) => w.workout_id)),
        ];
        const userIds = [...new Set(dataFallback.map((w: any) => w.user_id))];

        const workoutDetailsMap: { [key: string]: any } = {};
        const profileDetailsMap: { [key: string]: any } = {};

        if (workoutIds.length > 0) {
          const { data: workoutsData } = await supabase
            .from("workouts")
            .select("id, name, description, photo")
            .in("id", workoutIds);

          if (workoutsData) {
            workoutsData.forEach((w: any) => {
              workoutDetailsMap[String(w.id)] = w;
            });
          }
        }

        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("user_id, nickname, photo")
            .in("user_id", userIds);

          if (profilesData) {
            profilesData.forEach((p: any) => {
              profileDetailsMap[String(p.user_id)] = p;
            });
          }
        }

        return (dataFallback ?? [])
          .filter((row: any) => {
            const workoutName =
              workoutDetailsMap[String(row.workout_id)]?.name || "";
            return workoutName.toLowerCase().includes(query.toLowerCase());
          })
          .slice(0, 20)
          .map((row: any) => {
            const workout = workoutDetailsMap[String(row.workout_id)];
            const profile = profileDetailsMap[String(row.user_id)];
            return {
              id: String(workout?.id ?? ""),
              userWorkoutId: String(row.id ?? ""),
              userId: String(row.user_id ?? ""),
              userName: String(profile?.nickname ?? "Usuário"),
              userPhoto: profile?.photo || null,
              workoutName: String(workout?.name ?? ""),
              workoutDescription: workout?.description,
              workoutPhoto: workout?.photo || null,
            };
          });
      }
    }

    console.error(`Error searching workouts [${errorCode}]:`, errorMsg);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: String((row.workouts as any)?.id ?? ""),
    userWorkoutId: String(row.id ?? ""),
    userId: String(row.user_id ?? ""),
    userName: String((row.profiles as any)?.nickname ?? "Usuário"),
    userPhoto: (row.profiles as any)?.photo || null,
    workoutName: String((row.workouts as any)?.name ?? ""),
    workoutDescription: (row.workouts as any)?.description,
    workoutPhoto: (row.workouts as any)?.photo || null,
  }));
}

export type SearchDiet = {
  id: string;
  userDietId: string;
  userId: string;
  userName: string;
  userPhoto?: string | null;
  dietName: string;
  dietDescription?: string;
  dietPhoto?: string | null;
};

export async function searchUserDietsDb(query: string): Promise<SearchDiet[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  if (!query.trim()) return [];

  const searchQuery = `%${query.toLowerCase()}%`;

  const { data, error } = await supabase
    .from("user_diets")
    .select(
      "id, user_id, diet_id, diets(id, name, description, photo), profiles(nickname, photo)",
    )
    .ilike("diets.name", searchQuery)
    .limit(20);

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    const errorDetails = error?.details || "";

    if (errorDetails.includes("relationship")) {
      // Fallback: fetch user diets and fetch diet/profile details separately
      const { data: dataFallback } = await supabase
        .from("user_diets")
        .select("id, user_id, diet_id")
        .limit(100);

      if (dataFallback) {
        const dietIds = [...new Set(dataFallback.map((d: any) => d.diet_id))];
        const userIds = [...new Set(dataFallback.map((d: any) => d.user_id))];

        const dietDetailsMap: { [key: string]: any } = {};
        const profileDetailsMap: { [key: string]: any } = {};

        if (dietIds.length > 0) {
          const { data: dietsData } = await supabase
            .from("diets")
            .select("id, name, description, photo")
            .in("id", dietIds);

          if (dietsData) {
            dietsData.forEach((d: any) => {
              dietDetailsMap[String(d.id)] = d;
            });
          }
        }

        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("user_id, nickname, photo")
            .in("user_id", userIds);

          if (profilesData) {
            profilesData.forEach((p: any) => {
              profileDetailsMap[String(p.user_id)] = p;
            });
          }
        }

        return (dataFallback ?? [])
          .filter((row: any) => {
            const dietName = dietDetailsMap[String(row.diet_id)]?.name || "";
            return dietName.toLowerCase().includes(query.toLowerCase());
          })
          .slice(0, 20)
          .map((row: any) => {
            const diet = dietDetailsMap[String(row.diet_id)];
            const profile = profileDetailsMap[String(row.user_id)];
            return {
              id: String(diet?.id ?? ""),
              userDietId: String(row.id ?? ""),
              userId: String(row.user_id ?? ""),
              userName: String(profile?.nickname ?? "Usuário"),
              userPhoto: profile?.photo || null,
              dietName: String(diet?.name ?? ""),
              dietDescription: diet?.description,
              dietPhoto: diet?.photo || null,
            };
          });
      }
    }

    console.error(`Error searching diets [${errorCode}]:`, errorMsg);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: String((row.diets as any)?.id ?? ""),
    userDietId: String(row.id ?? ""),
    userId: String(row.user_id ?? ""),
    userName: String((row.profiles as any)?.nickname ?? "Usuário"),
    userPhoto: (row.profiles as any)?.photo || null,
    dietName: String((row.diets as any)?.name ?? ""),
    dietDescription: (row.diets as any)?.description,
    dietPhoto: (row.diets as any)?.photo || null,
  }));
}

// Search routines by name from the routines table (type 1=workout, 2=diet)
export type RoutineResult = {
  routineId: string;
  routineName: string | null;
  routineType: number;
  userId: string;
  userNickname: string;
  userPhoto: string | null;
};

export async function searchRoutinesDb(
  query: string,
  routineType: 1 | 2,
  excludeUserId?: string,
): Promise<RoutineResult[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  try {
    // Query routines grouped by name+user — include named AND unnamed routines
    let dbQuery = supabase
      .from("routines")
      .select("id, user_id, type, name")
      .eq("type", routineType)
      .is("follower_id", null);

    if (query.trim()) {
      dbQuery = dbQuery.ilike("name", `%${query.trim()}%`);
    }

    if (excludeUserId) {
      dbQuery = dbQuery.neq("user_id", excludeUserId);
    }

    const { data, error } = await dbQuery
      .order("user_id", { ascending: true })
      .limit(50);

    if (error || !data?.length) return [];

    // Deduplicate by name+user_id (null name counts as one per user)
    const seen = new Set<string>();
    const unique = (data as any[]).filter((row) => {
      const key = `${row.user_id}::${row.name ?? "__unnamed__"}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Batch-fetch profiles
    const userIds = [...new Set(unique.map((r: any) => String(r.user_id)))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nickname, photo")
      .in("user_id", userIds);

    const profileMap = new Map(
      (profiles ?? []).map((p: any) => [String(p.user_id), p]),
    );

    return unique
      .map((row: any) => {
        const profile = profileMap.get(String(row.user_id));
        return {
          routineId: String(row.id),
          routineName: row.name ? String(row.name) : null,
          routineType: Number(row.type),
          userId: String(row.user_id),
          userNickname: profile?.nickname ? String(profile.nickname) : "Usuário",
          userPhoto: profile?.photo ? String(profile.photo) : null,
        };
      })
      .sort((a, b) => a.userNickname.localeCompare(b.userNickname));
  } catch (err: any) {
    console.error("Error searching routines:", err);
    return [];
  }
}

// Returns keys ("sourceUserId::routineName") for routines the current user has already copied
export async function getCopiedRoutineKeysDb(currentUserId: string): Promise<Set<string>> {
  if (!hasSupabaseConfig || !supabase) return new Set();
  try {
    const { data, error } = await supabase
      .from("routines")
      .select("follower_id, name")
      .eq("user_id", currentUserId)
      .not("follower_id", "is", null);
    if (error || !data?.length) return new Set();
    return new Set(
      (data as any[]).map((row) => `${String(row.follower_id)}::${row.name ?? null}`)
    );
  } catch {
    return new Set();
  }
}

// Fetch exercises for a user's workout routine (for dropdown display)
export type RoutineItemRow = {
  id: string;
  itemId: string;
  itemName: string;
};

export async function getRoutineWorkoutsDb(userId: string, routineName: string | null): Promise<RoutineItemRow[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  try {
    const baseQuery = supabase
      .from("user_workouts")
      .select("id, workout_id, workouts(name)")
      .eq("user_id", userId)
      .limit(30);
    const { data, error } = routineName
      ? await baseQuery.eq("name", routineName)
      : await baseQuery.is("name", null);

    if (!error && data) {
      return data.map((r: any) => ({
        id: String(r.id),
        itemId: String(r.workout_id),
        itemName: (r.workouts as any)?.name || "Exercício",
      }));
    }

    // Fallback: fetch without join then resolve names separately
    const fbBase = supabase
      .from("user_workouts")
      .select("id, workout_id")
      .eq("user_id", userId)
      .limit(30);
    const { data: fb } = routineName
      ? await fbBase.eq("name", routineName)
      : await fbBase.is("name", null);

    if (!fb?.length) return [];

    const workoutIds = fb.map((r: any) => r.workout_id).filter(Boolean);
    const namesMap: Record<string, string> = {};
    if (workoutIds.length > 0) {
      const { data: wData } = await supabase
        .from("workouts")
        .select("id, name")
        .in("id", workoutIds);
      (wData ?? []).forEach((w: any) => { namesMap[String(w.id)] = w.name; });
    }

    return fb.map((r: any) => ({
      id: String(r.id),
      itemId: String(r.workout_id),
      itemName: namesMap[String(r.workout_id)] || "Exercício",
    }));
  } catch {
    return [];
  }
}

export async function getRoutineDietsDb(userId: string, routineName: string | null): Promise<RoutineItemRow[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  try {
    const baseQuery = supabase
      .from("user_diets")
      .select("id, diet_id, diets(name)")
      .eq("user_id", userId)
      .limit(30);
    const { data, error } = routineName
      ? await baseQuery.eq("name", routineName)
      : await baseQuery.is("name", null);

    if (!error && data) {
      return data.map((r: any) => ({
        id: String(r.id),
        itemId: String(r.diet_id),
        itemName: (r.diets as any)?.name || "Alimento",
      }));
    }

    // Fallback: fetch without join then resolve names separately
    const fbBase = supabase
      .from("user_diets")
      .select("id, diet_id")
      .eq("user_id", userId)
      .limit(30);
    const { data: fb } = routineName
      ? await fbBase.eq("name", routineName)
      : await fbBase.is("name", null);

    if (!fb?.length) return [];

    const dietIds = fb.map((r: any) => r.diet_id).filter(Boolean);
    const namesMap: Record<string, string> = {};
    if (dietIds.length > 0) {
      const { data: dData } = await supabase
        .from("diets")
        .select("id, name")
        .in("id", dietIds);
      (dData ?? []).forEach((d: any) => { namesMap[String(d.id)] = d.name; });
    }

    return fb.map((r: any) => ({
      id: String(r.id),
      itemId: String(r.diet_id),
      itemName: namesMap[String(r.diet_id)] || "Alimento",
    }));
  } catch {
    return [];
  }
}

// Copy all workouts or diets from one user to another
export async function copyRoutineToUserDb(
  sourceUserId: string,
  targetUserId: string,
  routineType: 1 | 2,
  routineName: string | null,
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  // Step 1: Insert the actual items — the DB trigger will create the routines entry.
  if (routineType === 1) {
    const query = supabase
      .from("user_workouts")
      .select("workout_id, name")
      .eq("user_id", sourceUserId);

    const { data, error } = routineName
      ? await query.eq("name", routineName)
      : await query.is("name", null);

    if (error || !data?.length) throw new Error("Nenhum treino encontrado.");

    const toInsert = data.map((row: any) => ({
      workout_id: row.workout_id,
      user_id: targetUserId,
      name: row.name ?? null,
    }));

    const { error: insertError } = await supabase.from("user_workouts").insert(toInsert);
    if (insertError) throw new Error(insertError.message);
  } else {
    const query = supabase
      .from("user_diets")
      .select("diet_id, name")
      .eq("user_id", sourceUserId);

    const { data, error } = routineName
      ? await query.eq("name", routineName)
      : await query.is("name", null);

    if (error || !data?.length) throw new Error("Nenhuma dieta encontrada.");

    const toInsert = data.map((row: any) => ({
      diet_id: row.diet_id,
      user_id: targetUserId,
      name: row.name ?? null,
    }));

    const { error: insertError } = await supabase.from("user_diets").insert(toInsert);
    if (insertError) throw new Error(insertError.message);
  }

  // Step 2: Set follower_id on the routines entry created by the trigger.
  const finalUpdateQuery = supabase
    .from("routines")
    .update({ follower_id: sourceUserId })
    .eq("user_id", targetUserId)
    .eq("type", routineType);

  const { error: finalUpdateError } = routineName
    ? await finalUpdateQuery.eq("name", routineName)
    : await finalUpdateQuery.is("name", null);

  if (finalUpdateError) console.error("Error setting follower_id after copy:", finalUpdateError.message);
}

// Following Functions

export async function getAllUsersDb(
  excludeUserId?: string,
  limit = 100,
  offset = 0,
): Promise<SearchUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, nickname, bio, photo")
      .order("nickname", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      const errorMsg = error?.message || String(error);
      const errorCode = error?.code || "UNKNOWN";
      console.error(`Error fetching all users [${errorCode}]:`, errorMsg);
      return [];
    }

    const allUsers = (data ?? []).map((row: any) => ({
      id: String(row.user_id ?? ""),
      nickname: String(row.nickname ?? "Usuário"),
      bio: row.bio ? String(row.bio) : undefined,
      photo: row.photo ? String(row.photo) : null,
    }));

    // Filter out the current user if excludeUserId is provided
    if (excludeUserId) {
      return allUsers.filter((user) => user.id !== excludeUserId);
    }

    return allUsers;
  } catch (err: any) {
    console.error("Error fetching all users:", err);
    return [];
  }
}

export async function followUserDb(followingId: string): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const viewer = await getViewer();
  if (!viewer) return false;

  const { error } = await supabase.from("following").insert({
    user_id: viewer.id,
    following_id: followingId,
  });

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error following user [${errorCode}]:`, errorMsg);
    return false;
  }

  return true;
}

export async function unfollowUserDb(followingId: string): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const viewer = await getViewer();
  if (!viewer) return false;

  const { error } = await supabase
    .from("following")
    .delete()
    .eq("user_id", viewer.id)
    .eq("following_id", followingId);

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error unfollowing user [${errorCode}]:`, errorMsg);
    return false;
  }

  return true;
}

export async function isFollowingDb(followingId: string): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const viewer = await getViewer();
  if (!viewer) return false;

  const { data, error } = await supabase
    .from("following")
    .select("id")
    .eq("user_id", viewer.id)
    .eq("following_id", followingId)
    .maybeSingle();

  if (error) {
    console.error("Error checking if following:", error);
    return false;
  }

  return !!data;
}

export async function getFollowingIdsDb(): Promise<string[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const viewer = await getViewer();
  if (!viewer) return [];

  const { data, error } = await supabase
    .from("following")
    .select("following_id")
    .eq("user_id", viewer.id);

  if (error) {
    console.error("Error fetching following IDs:", error);
    return [];
  }

  return (data ?? []).map((row: any) => String(row.following_id ?? ""));
}

// Stories functionality
export type Story = {
  id: string;
  user_id: string;
  description: string;
  media_url: string;
  created_at: string;
};

export type StoryWithUser = Story & {
  userNickname: string;
  userPhoto: string | null;
};

export async function getActiveStoriesDb(): Promise<StoryWithUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const viewer = await getViewer();
  if (!viewer) return [];

  // Get stories from the last 24 hours
  const twentyFourHoursAgo = new Date(
    Date.now() - 24 * 60 * 60 * 1000,
  ).toISOString();

  try {
    // Get current user's following IDs
    const followingIds = await getFollowingIdsDb();
    const userIdsToShow = [viewer.id, ...followingIds];

    const { data, error } = await supabase
      .from("flow")
      .select("*")
      .in("user_id", userIdsToShow)
      .gte("created_at", twentyFourHoursAgo)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching stories:", error);
      return [];
    }

    // Batch-fetch all story author profiles in a single query
    const storyList = data ?? [];
    const uniqueUserIds = [...new Set(storyList.map((s: any) => s.user_id).filter(Boolean))];
    const profileMap = new Map<string, { nickname: string; photo: string | null }>();

    if (uniqueUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nickname, photo")
        .in("user_id", uniqueUserIds);

      (profiles ?? []).forEach((p: any) => {
        profileMap.set(String(p.user_id), {
          nickname: String(p.nickname ?? "Usuário"),
          photo: p.photo ? String(p.photo) : null,
        });
      });
    }

    return storyList.map((story: any) => {
      const profile = profileMap.get(story.user_id) ?? { nickname: "Usuário", photo: null };
      return {
        ...story,
        id: String(story.id),
        user_id: String(story.user_id),
        userNickname: profile.nickname,
        userPhoto: profile.photo,
      };
    });
  } catch (err: any) {
    console.error("Error fetching active stories:", err);
    return [];
  }
}

export async function getUserActiveStoriesDb(userId: string): Promise<StoryWithUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await supabase
      .from("flow")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", twentyFourHoursAgo)
      .order("created_at", { ascending: true });

    if (error || !data?.length) return [];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nickname, photo")
      .eq("user_id", userId)
      .limit(1);

    const profile = profiles?.[0];

    return data.map((story: any) => ({
      ...story,
      id: String(story.id),
      user_id: String(story.user_id),
      userNickname: profile?.nickname ?? "Usuário",
      userPhoto: profile?.photo ?? null,
    }));
  } catch (err: any) {
    console.error("Error fetching user stories:", err);
    return [];
  }
}

export async function getExpiredUserFlowsDb(): Promise<StoryWithUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const viewer = await getViewer();
  if (!viewer) return [];

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await supabase
      .from("flow")
      .select("*")
      .eq("user_id", viewer.id)
      .lt("created_at", twentyFourHoursAgo)
      .order("created_at", { ascending: false });

    if (error || !data?.length) return [];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nickname, photo")
      .eq("user_id", viewer.id)
      .limit(1);

    const profile = profiles?.[0];

    return data.map((story: any) => ({
      ...story,
      id: String(story.id),
      user_id: String(story.user_id),
      userNickname: profile?.nickname ?? "Usuário",
      userPhoto: profile?.photo ?? null,
    }));
  } catch (err: any) {
    console.error("Error fetching expired flows:", err);
    return [];
  }
}

export async function createStoryDb(
  description: string,
  mediaUrl: string,
): Promise<Story | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const viewer = await getViewer();
  if (!viewer) return null;

  try {
    const { data, error } = await supabase
      .from("flow")
      .insert({
        user_id: viewer.id,
        description,
        media_url: mediaUrl,
      })
      .select()
      .maybeSingle();

    if (error) {
      const errorMsg = error?.message || String(error);
      const errorCode = error?.code || "UNKNOWN";
      console.error(`Error creating story [${errorCode}]:`, errorMsg);
      return null;
    }

    return data ? { ...data, id: String(data.id), user_id: String(data.user_id) } : null;
  } catch (err: any) {
    console.error("Error creating story:", err);
    return null;
  }
}

export async function deleteOldStoriesDb(): Promise<boolean> {
  // Flows are no longer auto-deleted after 24h — they are only hidden from
  // the active feed by the created_at filter in getActiveStoriesDb.
  // Manual deletion happens via deleteStoryDb only.
  return true;
}

export async function deleteStoryDb(storyId: string): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const viewer = await getViewer();
  if (!viewer) return false;

  try {
    // Cast to number in case PK is bigint — string comparison may not match
    const numericId = Number(storyId);
    const idValue = Number.isFinite(numericId) ? numericId : storyId;

    // Delete dependencies first to avoid FK violations
    // Try both numeric and string forms to handle bigint vs text FK columns
    const { error: e1 } = await supabase.from("flow_likes").delete().eq("flow_id", idValue);
    if (e1) { const { error: e1b } = await supabase.from("flow_likes").delete().eq("flow_id", String(storyId)); if (e1b) console.error("flow_likes delete error:", e1b.message); }
    const { error: e2 } = await supabase.from("flow_comments").delete().eq("flow_id", idValue);
    if (e2) { const { error: e2b } = await supabase.from("flow_comments").delete().eq("flow_id", String(storyId)); if (e2b) console.error("flow_comments delete error:", e2b.message); }
    const { error: e3 } = await supabase.from("flow_user_viewed").delete().eq("flow_id", idValue);
    if (e3) { const { error: e3b } = await supabase.from("flow_user_viewed").delete().eq("flow_id", String(storyId)); if (e3b) console.error("flow_user_viewed delete error:", e3b.message); }

    // Only allow deleting own flow
    const { error } = await supabase
      .from("flow")
      .delete()
      .eq("id", idValue)
      .eq("user_id", viewer.id);

    if (error) {
      console.error("Error deleting story:", error);
      return false;
    }

    return true;
  } catch (err: any) {
    console.error("Error deleting story:", err);
    return false;
  }
}

// Story likes (incentives)
export async function toggleStoryLikeDb(
  storyId: string,
  incentiveType: PostIncentiveType,
) {
  if (!hasSupabaseConfig || !supabase) return;

  const viewer = await getViewer();
  if (!viewer) return;

  // Cast to number in case PK is bigint
  const numericId = Number(storyId);
  const idValue = Number.isFinite(numericId) ? numericId : storyId;

  const { data: existing } = await supabase
    .from("flow_likes")
    .select("id")
    .eq("flow_id", idValue)
    .eq("user_id", viewer.id)
    .eq("type", incentiveType)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase.from("flow_likes").delete().eq("id", existing.id);
    if (error) console.error("Error removing story like:", error);
  } else {
    const { error } = await supabase.from("flow_likes").insert({
      flow_id: idValue,
      user_id: viewer.id,
      type: incentiveType,
    });
    if (error) {
      console.error("Error inserting story like:", error);
      throw error;
    }
    await addPointsDb(1);
  }
}

export async function getStoryLikesDb(storyId: string): Promise<PostLikeStats> {
  if (!hasSupabaseConfig || !supabase) {
    return { apoio: 0, continua: 0, ganhador: 0, consegueMais: 0, limiteMaior: 0, maisAlgum: 0 };
  }

  const numId = Number(storyId);
  const idVal = Number.isFinite(numId) ? numId : storyId;
  // Fetch counts per type in parallel — 6 lightweight HEAD requests instead of fetching all rows
  const [r1, r2, r3, r4, r5, r6] = await Promise.all([
    supabase.from("flow_likes").select("id", { count: "exact", head: true }).eq("flow_id", idVal).eq("type", 1),
    supabase.from("flow_likes").select("id", { count: "exact", head: true }).eq("flow_id", idVal).eq("type", 2),
    supabase.from("flow_likes").select("id", { count: "exact", head: true }).eq("flow_id", idVal).eq("type", 3),
    supabase.from("flow_likes").select("id", { count: "exact", head: true }).eq("flow_id", idVal).eq("type", 4),
    supabase.from("flow_likes").select("id", { count: "exact", head: true }).eq("flow_id", idVal).eq("type", 5),
    supabase.from("flow_likes").select("id", { count: "exact", head: true }).eq("flow_id", idVal).eq("type", 6),
  ]);

  return {
    apoio: r1.count ?? 0,
    continua: r2.count ?? 0,
    ganhador: r3.count ?? 0,
    consegueMais: r4.count ?? 0,
    limiteMaior: r5.count ?? 0,
    maisAlgum: r6.count ?? 0,
  };
}

export async function getUserStoryLikesDb(
  storyId: string,
): Promise<PostIncentiveType[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const viewer = await getViewer();
  if (!viewer) return [];

  const numId2 = Number(storyId);
  const idVal2 = Number.isFinite(numId2) ? numId2 : storyId;
  const { data } = await supabase
    .from("flow_likes")
    .select("type")
    .eq("flow_id", idVal2)
    .eq("user_id", viewer.id);

  return (data ?? [])
    .map((row: any) => Number(row.type) as PostIncentiveType)
    .filter((incentiveType): incentiveType is PostIncentiveType =>
      [1, 2, 3, 4, 5, 6].includes(incentiveType),
    );
}

export type FlowViewer = {
  followerId: string;
  userNickname: string;
  userPhoto: string | null;
  incentiveTypes: number[]; // empty = no incentive sent
  viewedAt: string;
};

// Story comments
export type StoryComment = {
  id: string;
  storyId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
};

export async function addStoryCommentDb(
  storyId: string,
  text: string,
): Promise<StoryComment | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  assertNotEmpty(text, "Comentário");
  assertMaxLength(text.trim(), 500, "Comentário");

  const viewer = await getViewer();
  if (!viewer) return null;

  try {
    const numIdC = Number(storyId);
    const idValC = Number.isFinite(numIdC) ? numIdC : storyId;
    const { data, error } = await supabase
      .from("flow_comments")
      .insert({
        flow_id: idValC,
        user_id: viewer.id,
        text,
      })
      .select()
      .maybeSingle();

    if (error) throw error;

    // Fetch nickname in the same round-trip as the insert result (single query)
    const { data: profileData } = await supabase
      .from("profiles")
      .select("nickname")
      .eq("user_id", viewer.id)
      .maybeSingle();

    return {
      id: data?.id || "",
      storyId: storyId,
      userId: viewer.id,
      userName: profileData?.nickname || "Usuário",
      text,
      createdAt: data?.created_at || new Date().toISOString(),
    };
  } catch (err: any) {
    console.error("Error adding story comment:", err);
    return null;
  }
}

export async function getStoryCommentsDb(
  storyId: string,
): Promise<StoryComment[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  try {
    const numIdG = Number(storyId);
    const idValG = Number.isFinite(numIdG) ? numIdG : storyId;
    const { data, error } = await supabase
      .from("flow_comments")
      .select("*")
      .eq("flow_id", idValG)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const rows = data ?? [];
    if (rows.length === 0) return [];

    // Batch-fetch all comment authors in a single query to avoid N+1
    const userIds = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nickname")
      .in("user_id", userIds);

    const profileMap = new Map(
      (profiles ?? []).map((p: any) => [String(p.user_id), String(p.nickname ?? "Usuário")]),
    );

    return rows.map((comment: any) => ({
      id: String(comment.id),
      storyId: storyId,
      userId: String(comment.user_id),
      userName: profileMap.get(String(comment.user_id)) ?? "Usuário",
      text: String(comment.text ?? ""),
      createdAt: String(comment.created_at),
    }));
  } catch (err: any) {
    console.error("Error fetching story comments:", err?.message || err);
    return [];
  }
}

export async function deleteStoryCommentDb(commentId: string): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  try {
    const numIdDel = Number(commentId);
    const idValDel = Number.isFinite(numIdDel) ? numIdDel : commentId;
    const { error } = await supabase
      .from("flow_comments")
      .delete()
      .eq("id", idValDel);

    if (error) throw error;
    return true;
  } catch (err: any) {
    console.error("Error deleting story comment:", err);
    return false;
  }
}

// In-memory set to avoid duplicate inserts within the same browser session
const _recordedFlowViews = new Set<string>();
// In-flight lock set to prevent race conditions
const _recordingInFlight = new Set<string>();

export async function recordFlowViewDb(storyId: string, storyOwnerId: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  const viewer = await getViewer();
  if (!viewer || viewer.id === storyOwnerId) return;

  const key = `${viewer.id}:${storyId}`;

  // Already recorded in this session or currently being recorded — skip
  if (_recordedFlowViews.has(key) || _recordingInFlight.has(key)) return;

  _recordingInFlight.add(key);

  try {
    // Always check DB using both user_id (owner) and follower_id + flow_id
    const { data: existing, error: checkError } = await supabase
      .from("flow_user_viewed")
      .select("flow_id")
      .eq("flow_id", storyId)
      .eq("follower_id", viewer.id)
      .eq("user_id", storyOwnerId)
      .maybeSingle();

    if (checkError) console.error("Error checking flow view:", checkError.message);

    if (existing) {
      _recordedFlowViews.add(key);
      return;
    }

    // Delete any stale rows with partial match before inserting (safety net)
    await supabase
      .from("flow_user_viewed")
      .delete()
      .eq("flow_id", storyId)
      .eq("follower_id", viewer.id);

    const { error } = await supabase
      .from("flow_user_viewed")
      .insert({
        user_id: storyOwnerId,
        follower_id: viewer.id,
        flow_id: storyId,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error("Error inserting flow view:", error.message);
    } else {
      _recordedFlowViews.add(key);
    }
  } catch (err: any) {
    console.error("Error recording flow view:", err?.message || err);
  } finally {
    _recordingInFlight.delete(key);
  }
}

/**
 * Returns the set of story owner user_ids whose flows the current viewer has already seen.
 * Uses flow_user_viewed where follower_id = current viewer.
 */
export async function getMyViewedFlowUserIdsDb(): Promise<Set<string>> {
  if (!hasSupabaseConfig || !supabase) return new Set();
  const viewer = await getViewer();
  if (!viewer) return new Set();

  try {
    const { data, error } = await supabase
      .from("flow_user_viewed")
      .select("user_id")
      .eq("follower_id", viewer.id);

    if (error) throw error;
    return new Set((data ?? []).map((r: any) => String(r.user_id)));
  } catch (err: any) {
    console.error("Error fetching viewed flow user ids:", err?.message || err);
    return new Set();
  }
}

export async function getFlowViewersDb(storyId: string): Promise<FlowViewer[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  try {
    const { data: views, error } = await supabase
      .from("flow_user_viewed")
      .select("follower_id, created_at, updated_at")
      .eq("flow_id", storyId)
      .order("updated_at", { ascending: false });

    if (error || !views || views.length === 0) return [];

    const followerIds = views.map((v: any) => v.follower_id);

    const [profilesResult, likesResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, nickname, photo")
        .in("user_id", followerIds),
      supabase
        .from("flow_likes")
        .select("user_id, type")
        .eq("flow_id", storyId)
        .in("user_id", followerIds),
    ]);

    const profileMap = new Map(
      (profilesResult.data ?? []).map((p: any) => [String(p.user_id), p]),
    );

    // Group all incentive types per user (a user can send multiple)
    const likesPerUser = new Map<string, number[]>();
    for (const l of (likesResult.data ?? [])) {
      const uid = String(l.user_id);
      if (!likesPerUser.has(uid)) likesPerUser.set(uid, []);
      likesPerUser.get(uid)!.push(Number(l.type));
    }

    return views.map((view: any) => {
      const profile = profileMap.get(String(view.follower_id));
      return {
        followerId: String(view.follower_id),
        userNickname: profile?.nickname ?? "Usuário",
        userPhoto: profile?.photo ?? null,
        incentiveTypes: likesPerUser.get(String(view.follower_id)) ?? [],
        viewedAt: String(view.updated_at ?? view.created_at),
      };
    });
  } catch (err: any) {
    console.error("Error fetching flow viewers:", err?.message || err);
    return [];
  }
}

// Messages functionality
export type Message = {
  id: string;
  id_user: string;
  id_following: string;
  text: string;
  read: 0 | 1;
  created_at: string;
  emoji: string | null;
};

export type MessageWithUser = Message & {
  senderNickname: string;
  senderPhoto: string | null;
  recipientNickname: string;
  recipientPhoto: string | null;
};

export type Conversation = {
  userId: string;
  userNickname: string;
  userPhoto: string | null;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
};

export async function sendMessageDb(
  recipientId: string,
  text: string,
): Promise<Message | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  assertUUID(recipientId, "ID do destinatário");
  assertNotEmpty(text, "Mensagem");
  assertMaxLength(text.trim(), 1000, "Mensagem");

  const viewer = await getViewer();
  if (!viewer) return null;

  try {
    // Validate that the recipient is in the current user's following list
    const { data: followingData, error: followingError } = await supabase
      .from("following")
      .select("id")
      .eq("user_id", viewer.id)
      .eq("following_id", recipientId)
      .maybeSingle();

    if (followingError || !followingData) {
      console.error("Error validating following relationship:", followingError);
      return null;
    }

    // Create the message
    const { data, error } = await supabase
      .from("messages")
      .insert({
        id_user: viewer.id,
        id_following: recipientId,
        text,
        read: 0,
      })
      .select()
      .maybeSingle();

    if (error) {
      const errorMsg = error?.message || String(error);
      const errorCode = error?.code || "UNKNOWN";
      console.error(`Error sending message [${errorCode}]:`, errorMsg);
      return null;
    }

    return data;
  } catch (err: any) {
    console.error("Error sending message:", err);
    return null;
  }
}

export async function getConversationsDb(): Promise<Conversation[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const viewer = await getViewer();
  if (!viewer) return [];

  try {
    // Get all conversations (both sent and received messages)
    const { data: messages, error } = await supabase
      .from("messages")
      .select("*")
      .or(`id_user.eq.${viewer.id},id_following.eq.${viewer.id}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching conversations:", error);
      return [];
    }

    // Group messages by conversation
    const conversationMap = new Map<string, (typeof messages)[0][]>();
    (messages ?? []).forEach((msg) => {
      const otherUserId =
        msg.id_user === viewer.id ? msg.id_following : msg.id_user;
      if (!conversationMap.has(otherUserId)) {
        conversationMap.set(otherUserId, []);
      }
      conversationMap.get(otherUserId)?.push(msg);
    });

    // Batch-fetch all conversation partner profiles in a single query
    const otherUserIds = Array.from(conversationMap.keys()).filter(Boolean);
    const profileMap = new Map<string, { nickname: string; photo: string | null }>();

    if (otherUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nickname, photo")
        .in("user_id", otherUserIds);

      (profiles ?? []).forEach((p: any) => {
        profileMap.set(String(p.user_id), {
          nickname: String(p.nickname ?? "Usuário"),
          photo: p.photo ? String(p.photo) : null,
        });
      });
    }

    // Build conversations from map (no serial awaits)
    const conversations: Conversation[] = [];

    for (const [userId, msgs] of conversationMap.entries()) {
      const profile = profileMap.get(userId) ?? { nickname: "Usuário", photo: null };
      const unreadCount = msgs.filter(
        (msg) => msg.id_following === viewer.id && msg.read === 0,
      ).length;

      conversations.push({
        userId,
        userNickname: profile.nickname,
        userPhoto: profile.photo,
        lastMessage: msgs[0]?.text || "",
        lastMessageTime: msgs[0]?.created_at || new Date().toISOString(),
        unreadCount,
      });
    }

    return conversations;
  } catch (err: any) {
    console.error("Error getting conversations:", err);
    return [];
  }
}

export async function getConversationMessagesDb(
  otherUserId: string,
): Promise<MessageWithUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const viewer = await getViewer();
  if (!viewer) return [];

  try {
    // Get all messages between current user and other user
    const { data: messages, error } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(id_user.eq.${viewer.id},id_following.eq.${otherUserId}),and(id_user.eq.${otherUserId},id_following.eq.${viewer.id})`,
      )
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
      return [];
    }

    // Enrich with user info
    const [senderProfile, recipientProfile] = await Promise.all([
      getUserProfileDb(viewer.id),
      getUserProfileDb(otherUserId),
    ]);

    return (messages ?? []).map((msg) => ({
      ...msg,
      senderNickname:
        msg.id_user === viewer.id
          ? senderProfile?.nickname || "Você"
          : recipientProfile?.nickname || "Usuário",
      senderPhoto:
        msg.id_user === viewer.id
          ? senderProfile?.photo || null
          : recipientProfile?.photo || null,
      recipientNickname:
        msg.id_following === viewer.id
          ? senderProfile?.nickname || "Você"
          : recipientProfile?.nickname || "Usuário",
      recipientPhoto:
        msg.id_following === viewer.id
          ? senderProfile?.photo || null
          : recipientProfile?.photo || null,
    }));
  } catch (err: any) {
    console.error("Error getting conversation messages:", err);
    return [];
  }
}

export async function markMessagesAsReadDb(
  senderUserId: string,
): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const viewer = await getViewer();
  if (!viewer) return false;

  try {
    const { error } = await supabase
      .from("messages")
      .update({ read: 1 })
      .eq("id_user", senderUserId)
      .eq("id_following", viewer.id)
      .eq("read", 0);

    if (error) {
      console.error("Error marking messages as read:", error);
      return false;
    }

    return true;
  } catch (err: any) {
    console.error("Error marking messages as read:", err);
    return false;
  }
}

export async function setMessageEmojiDb(
  messageId: string,
  emoji: string | null,
): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const { error } = await supabase
    .from("messages")
    .update({ emoji })
    .eq("id", messageId);

  if (error) {
    console.error("Error setting message emoji:", error);
    return false;
  }

  return true;
}

export async function getUnreadMessageCountDb(): Promise<number> {
  if (!hasSupabaseConfig || !supabase) return 0;

  const viewer = await getViewer();
  if (!viewer) return 0;

  try {
    // Count distinct senders with unread messages (not total unread messages)
    const { data, error } = await supabase
      .from("messages")
      .select("id_user")
      .eq("id_following", viewer.id)
      .eq("read", 0);

    if (error) {
      console.error("Error fetching unread message count:", error);
      return 0;
    }

    const distinctSenders = new Set((data ?? []).map((row: any) => row.id_user)).size;
    return distinctSenders;
  } catch (err: any) {
    console.error("Error getting unread message count:", err);
    return 0;
  }
}

export type MessageReactionRecord = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

export async function getMessageReactionsDb(
  messageIds: string[],
): Promise<MessageReactionRecord[]> {
  if (!hasSupabaseConfig || !supabase || messageIds.length === 0) return [];

  const { data, error } = await supabase
    .from("message_reactions")
    .select("*")
    .in("message_id", messageIds);

  if (error) {
    console.error("Error fetching message reactions:", error);
    return [];
  }

  return data ?? [];
}

export async function addMessageReactionDb(
  messageId: string,
  emoji: string,
): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const viewer = await getViewer();
  if (!viewer) return false;

  // Upsert to avoid duplicates
  const { error } = await supabase.from("message_reactions").upsert(
    { message_id: messageId, user_id: viewer.id, emoji },
    { onConflict: "message_id,user_id,emoji" },
  );

  if (error) {
    console.error("Error adding message reaction:", error);
    return false;
  }

  return true;
}

export async function removeMessageReactionDb(
  messageId: string,
  emoji: string,
): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const viewer = await getViewer();
  if (!viewer) return false;

  const { error } = await supabase
    .from("message_reactions")
    .delete()
    .eq("message_id", messageId)
    .eq("user_id", viewer.id)
    .eq("emoji", emoji);

  if (error) {
    console.error("Error removing message reaction:", error);
    return false;
  }

  return true;
}

export async function getFollowersDb(userId?: string): Promise<SearchUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const viewer = await getViewer();
  if (!viewer) return [];

  const targetUserId = userId ?? viewer.id;

  try {
    // Get all followers of the target user
    const { data, error } = await supabase
      .from("following")
      .select("user_id")
      .eq("following_id", targetUserId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching followers:", error);
      return [];
    }

    const followerIds = (data ?? []).map((row: any) =>
      String(row.user_id ?? ""),
    );

    if (followerIds.length === 0) return [];

    // Fetch profile data for each follower
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, nickname, bio, photo")
      .in("user_id", followerIds);

    if (profileError) {
      console.error("Error fetching follower profiles:", profileError);
      return [];
    }

    return (profiles ?? []).map((row: any) => ({
      id: String(row.user_id ?? ""),
      nickname: String(row.nickname ?? "Usuário"),
      bio: row.bio ? String(row.bio) : undefined,
      photo: row.photo ? String(row.photo) : null,
    }));
  } catch (err: any) {
    console.error("Error getting followers:", err);
    return [];
  }
}

export async function getFollowingDb(
  userId?: string,
): Promise<SearchUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const viewer = await getViewer();
  if (!viewer) return [];

  const targetUserId = userId || viewer.id;

  try {
    // Get all users that the target user is following
    const { data, error } = await supabase
      .from("following")
      .select("following_id")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching following:", error);
      return [];
    }

    const followingIds = (data ?? []).map((row: any) =>
      String(row.following_id ?? ""),
    );

    if (followingIds.length === 0) return [];

    // Fetch profile data for each user being followed
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, nickname, bio, photo")
      .in("user_id", followingIds);

    if (profileError) {
      console.error("Error fetching following profiles:", profileError);
      return [];
    }

    return (profiles ?? []).map((row: any) => ({
      id: String(row.user_id ?? ""),
      nickname: String(row.nickname ?? "Usuário"),
      bio: row.bio ? String(row.bio) : undefined,
      photo: row.photo ? String(row.photo) : null,
    }));
  } catch (err: any) {
    console.error("Error getting following:", err);
    return [];
  }
}

export type Shot = {
  id: string;
  user_id: string;
  video_url: string;
  description: string;
  created_at: string;
  likes: PostLikeStats;
  userLikes: PostIncentiveType[];
};

export type ShotWithUser = Shot & {
  userNickname: string;
  userPhoto: string | null;
  commentCount?: number;
};

export async function getShotsDb(): Promise<ShotWithUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const viewer = await getViewer();
  if (!viewer) return [];

  try {
    // Get all shots from all users (algorithm shows everyone's content)
    const { data: shotsData, error: shotsError } = await supabase
      .from("shots")
      .select("id, user_id, video_url, description, created_at")
      .order("created_at", { ascending: false });

    if (shotsError) {
      console.error("[getShotsDb] Error fetching shots:", shotsError);
      return [];
    }


    if (!shotsData || shotsData.length === 0) {
      return [];
    }

    // Get all unique user IDs to batch fetch profiles
    const uniqueUserIds = [
      ...new Set((shotsData ?? []).map((r: any) => String(r.user_id))),
    ];

    let profiles: any[] = [];
    if (uniqueUserIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, nickname, photo")
        .in("user_id", uniqueUserIds);

      if (profilesError) {
        console.error("[getShotsDb] Error fetching profiles:", profilesError);
      } else {
        profiles = profilesData ?? [];
      }
    }


    const profileMap = new Map(
      (profiles ?? []).map((p: any) => [
        p.user_id,
        { nickname: p.nickname, photo: p.photo },
      ]),
    );

    // Get all likes for these shots in one query
    const shotIds = (shotsData ?? []).map((r: any) => String(r.id));

    let allLikes: any[] = [];
    if (shotIds.length > 0) {
      const { data: likesData, error: likesError } = await supabase
        .from("shots_likes")
        .select("shots_id, type, user_id")
        .in("shots_id", shotIds);

      if (likesError) {
        console.error(
          "[getShotsDb] Error fetching likes:",
          likesError?.message || JSON.stringify(likesError),
        );
        // Try legacy format if shots_likes table doesn't exist
        const { data: legacyLikes, error: legacyError } = await supabase
          .from("likes")
          .select("post_id, type, user_id")
          .in("post_id", shotIds);

        if (!legacyError && legacyLikes) {
          allLikes = (legacyLikes ?? []).map((like: any) => ({
            ...like,
            shots_id: like.post_id,
          }));
        }
      } else {
        allLikes = likesData ?? [];
      }
    }


    const likesMap = new Map<
      string,
      { likes: PostLikeStats; userLikes: PostIncentiveType[] }
    >();

    (allLikes ?? []).forEach((like: any) => {
      const shotId = String(like.shots_id);
      if (!likesMap.has(shotId)) {
        likesMap.set(shotId, {
          likes: { apoio: 0, continua: 0, ganhador: 0, consegueMais: 0, limiteMaior: 0, maisAlgum: 0 },
          userLikes: [],
        });
      }

      const entry = likesMap.get(shotId)!;
      const type = Number(like.type) as PostIncentiveType;

      if (type === 1) entry.likes.apoio += 1;
      else if (type === 2) entry.likes.continua += 1;
      else if (type === 3) entry.likes.ganhador += 1;
      else if (type === 4) entry.likes.consegueMais += 1;
      else if (type === 5) entry.likes.limiteMaior += 1;
      else if (type === 6) entry.likes.maisAlgum += 1;

      if (like.user_id === viewer.id) {
        entry.userLikes.push(type);
      }
    });

    // Build final shot objects
    const shotsWithUserData: ShotWithUser[] = (shotsData ?? []).map(
      (shot: any) => {
        const userProfile = profileMap.get(String(shot.user_id)) || {
          nickname: "Usuário",
          photo: null,
        };
        const likeData = likesMap.get(String(shot.id)) || {
          likes: { apoio: 0, continua: 0, ganhador: 0, consegueMais: 0, limiteMaior: 0, maisAlgum: 0 },
          userLikes: [],
        };

        return {
          id: String(shot.id ?? ""),
          user_id: String(shot.user_id ?? ""),
          video_url: String(shot.video_url ?? ""),
          description: String(shot.description ?? ""),
          created_at: String(shot.created_at ?? new Date().toISOString()),
          likes: likeData.likes,
          userLikes: likeData.userLikes,
          userNickname: String(userProfile.nickname ?? "Usuário"),
          userPhoto: userProfile.photo ? String(userProfile.photo) : null,
        };
      },
    );

    return shotsWithUserData;
  } catch (err: any) {
    console.error("Error getting shots:", err?.message || JSON.stringify(err));
    return [];
  }
}

export async function createShotDb(
  videoUrl: string,
  description: string,
  userGoalId: string | null = null,
): Promise<Shot | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const viewer = await getViewer();
  if (!viewer) return null;

  try {
    const { data, error } = await supabase
      .from("shots")
      .insert({
        user_id: viewer.id,
        video_url: videoUrl,
        description: description.trim()
      })
      .select()
      .maybeSingle();

    if (error) {
      const errorMsg = error?.message || String(error);
      const errorCode = error?.code || "UNKNOWN";
      console.error(`Error creating shot [${errorCode}]:`, errorMsg);
      return null;
    }

    if (data) {
      // Award 5 points for creating a shot
      await addPointsDb(5);
    }

    return data || null;
  } catch (err: any) {
    console.error("Error creating shot:", err);
    return null;
  }
}

export async function updateShotDb(
  shotId: string,
  description: string,
): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const viewer = await getViewer();
  if (!viewer) return false;

  try {
    const { error } = await supabase
      .from("shots")
      .update({
        description: description.trim(),
      })
      .eq("id", shotId)
      .eq("user_id", viewer.id);

    if (error) {
      console.error("Error updating shot:", error);
      return false;
    }

    return true;
  } catch (err: any) {
    console.error("Error updating shot:", err);
    return false;
  }
}

export async function deleteShotDb(shotId: string): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const viewer = await getViewer();
  if (!viewer) return false;

  try {
    // Delete dependencies first (likes and comments)
    await supabase.from("shots_likes").delete().eq("shots_id", shotId);
    await supabase.from("shots_comments").delete().eq("shots_id", shotId);

    const { error } = await supabase
      .from("shots")
      .delete()
      .eq("id", shotId)
      .eq("user_id", viewer.id);

    if (error) {
      console.error("Error deleting shot:", error);
      return false;
    }

    return true;
  } catch (err: any) {
    console.error("Error deleting shot:", err);
    return false;
  }
}

export async function toggleShotIncentiveDb(
  shotId: string,
  incentiveType: PostIncentiveType,
  shotOwnerId?: string,
) {
  if (!hasSupabaseConfig || !supabase) return;

  const viewer = await getViewer();
  if (!viewer) return;

  try {
    let { data: existing, error: checkError } = await supabase
      .from("shots_likes")
      .select("id")
      .eq("shots_id", shotId)
      .eq("user_id", viewer.id)
      .eq("type", incentiveType)
      .maybeSingle();

    // If shots_likes table doesn't exist, try legacy likes table
    if (checkError) {
      const { data: legacyExisting } = await supabase
        .from("likes")
        .select("id")
        .eq("post_id", shotId)
        .eq("user_id", viewer.id)
        .eq("type", incentiveType)
        .maybeSingle();

      existing = legacyExisting;
    }

    if (existing?.id) {
      // Remove the like
      const tableName = checkError ? "likes" : "shots_likes";
      await supabase.from(tableName).delete().eq("id", existing.id);
    } else {
      // Add the like
      let insertError = null;
      const { error: shotLikeError } = await supabase
        .from("shots_likes")
        .insert({
          shots_id: shotId,
          user_id: viewer.id,
          type: incentiveType,
        });

      if (shotLikeError) {
        // Try legacy format
        const { error: legacyInsertError } = await supabase
          .from("likes")
          .insert({
            post_id: shotId,
            user_id: viewer.id,
            type: incentiveType,
          });
        insertError = legacyInsertError;
      }

      if (!shotLikeError || !insertError) {
        // Award 1 point for interacting with a shot
        await addPointsDb(1);

        // Notify shot owner (type 2 = incentive), skip if owner is self
        if (shotOwnerId && shotOwnerId !== viewer.id) {
          const { error: notifError } = await supabase.from("notifications").insert({
            user_id: shotOwnerId,
            follower_id: viewer.id,
            type: 2,
            post_id: shotId,
            read: false,
          });
          if (notifError) {
            console.error("Error inserting shot incentive notification:", notifError);
          }
        }
      }
    }
  } catch (err: any) {
    console.error(
      "Error toggling shot incentive:",
      err?.message || JSON.stringify(err),
    );
  }
}

export type ShotComment = {
  id: string;
  shotId: string;
  userId: string;
  userName: string;
  userHandle: string;
  text: string;
  createdAt: string;
};

export async function addShotCommentDb(shotId: string, text: string, shotOwnerId?: string) {
  if (!hasSupabaseConfig || !supabase) return;

  const viewer = await getViewer();
  if (!viewer) return;

  const profile = await ensureProfile();
  const userHandle = profile?.handle ?? "@voce";

  try {
    const { error } = await supabase.from("shots_comments").insert({
      shots_id: shotId,
      user_id: viewer.id,
      user_handle: userHandle,
      text: text.trim(),
    });

    if (error) {
      // Try legacy format if shots_comments table doesn't exist
      const { error: legacyError } = await supabase.from("comments").insert({
        post_id: shotId,
        user_id: viewer.id,
        user_handle: userHandle,
        text: text.trim(),
      });

      if (legacyError) {
        console.error(
          "Error adding shot comment:",
          legacyError?.message || JSON.stringify(legacyError),
        );
        throw legacyError;
      }
    }

    // Award 1 point for commenting on a shot
    await addPointsDb(1);

    // Notify shot owner (type 3 = comment), skip if owner is self
    if (shotOwnerId && shotOwnerId !== viewer.id) {
      const { error: notifError } = await supabase.from("notifications").insert({
        user_id: shotOwnerId,
        follower_id: viewer.id,
        type: 3,
        post_id: shotId,
        read: false,
      });
      if (notifError) {
        console.error("Error inserting shot comment notification:", notifError);
      }
    }
  } catch (err: any) {
    console.error(
      "Error adding shot comment:",
      err?.message || JSON.stringify(err),
    );
    throw err;
  }
}

export async function getShotCommentsDb(
  shotId: string,
): Promise<ShotComment[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  try {
    const { data, error } = await supabase
      .from("shots_comments")
      .select("*")
      .eq("shots_id", shotId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(
        "Error fetching shot comments:",
        error?.message || JSON.stringify(error),
      );
      // Try legacy format if shots_comments table doesn't exist
      const { data: legacyData, error: legacyError } = await supabase
        .from("comments")
        .select("*")
        .eq("post_id", shotId)
        .order("created_at", { ascending: true });

      if (legacyError) {
        console.error(
          "Error fetching shot comments (legacy):",
          legacyError?.message || JSON.stringify(legacyError),
        );
        return [];
      }

      return (legacyData ?? []).map(
        (row: any) =>
          ({
            id: String(row.id),
            shotId: String(row.post_id),
            userId: String(row.user_id),
            userName: String(row.user_name ?? "Usuário"),
            userHandle: String(row.user_handle ?? "@user"),
            text: String(row.text ?? ""),
            createdAt: String(row.created_at ?? new Date().toISOString()),
          }) satisfies ShotComment,
      );
    }

    // Batch-fetch all commenter profiles in a single query
    const commentList = data ?? [];
    const uniqueUserIds = [...new Set(commentList.map((r: any) => r.user_id).filter(Boolean))];
    const profileMap = new Map<string, string>();

    if (uniqueUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nickname")
        .in("user_id", uniqueUserIds);

      (profiles ?? []).forEach((p: any) => {
        if (p.nickname) profileMap.set(String(p.user_id), String(p.nickname));
      });
    }

    return commentList.map((row: any) => ({
      id: String(row.id),
      shotId: String(row.shots_id),
      userId: String(row.user_id),
      userName: profileMap.get(String(row.user_id)) ?? String(row.user_name ?? "Usuário"),
      userHandle: String(row.user_handle ?? "@user"),
      text: String(row.text ?? ""),
      createdAt: String(row.created_at ?? new Date().toISOString()),
    }) satisfies ShotComment);
  } catch (err: any) {
    console.error(
      "Error getting shot comments:",
      err?.message || JSON.stringify(err),
    );
    return [];
  }
}

export async function deleteShotCommentDb(commentId: string) {
  if (!hasSupabaseConfig || !supabase) return;
  assertUUID(commentId, "ID do comentário");

  const viewer = await getViewer();
  if (!viewer) return;

  try {
    const { error } = await supabase
      .from("shots_comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", viewer.id);

    if (error) {
      // Try legacy format if shots_comments table doesn't exist
      const { error: legacyError } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId)
        .eq("user_id", viewer.id);

      if (legacyError) {
        console.error(
          "Error deleting shot comment:",
          legacyError?.message || JSON.stringify(legacyError),
        );
        throw legacyError;
      }
    }
  } catch (err: any) {
    console.error(
      "Error deleting shot comment:",
      err?.message || JSON.stringify(err),
    );
    throw err;
  }
}

export type RankingUser = {
  userId: string;
  userNickname: string;
  userPhoto: string | null;
  points: number;
  level: number;
};

export async function addPointsDb(points: number): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  const viewer = await getViewer();
  if (!viewer) return;

  try {
    // Check if user already has a ranking entry
    const { data: existing, error: existingError } = await supabase
      .from("ranking")
      .select("id, points")
      .eq("user_id", viewer.id)
      .maybeSingle();

    if (existingError && existingError.code !== "PGRST116") {
      console.error("Error fetching ranking:", existingError);
      return;
    }

    if (existing) {
      // Update existing ranking
      const newPoints = (existing.points || 0) + points;
      const newLevel = Math.floor(newPoints / 100) + 1;

      const { error: updateError } = await supabase
        .from("ranking")
        .update({
          points: newPoints,
          level: newLevel,
        })
        .eq("user_id", viewer.id);

      if (updateError) {
        console.error("Error updating ranking:", updateError);
      }
    } else {
      // Create new ranking entry
      const { error: insertError } = await supabase.from("ranking").insert({
        user_id: viewer.id,
        points,
        level: 1,
      });

      if (insertError) {
        console.error("Error creating ranking:", insertError);
      }
    }
  } catch (err: any) {
    console.error("Error adding points:", err);
  }
}

export async function getRankingDb(): Promise<RankingUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  try {
    // Read points directly from the ranking table (all users, no date filter)
    const { data: rankingData, error } = await supabase
      .from("ranking")
      .select("user_id, points")
      .order("points", { ascending: false });

    if (error) {
      console.error("Error fetching ranking table:", error);
      return [];
    }

    if (!rankingData || rankingData.length === 0) return [];

    const userIds = rankingData.map((r: any) => String(r.user_id));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nickname, photo")
      .in("user_id", userIds);

    const profileMap = new Map(
      (profiles ?? []).map((p: any) => [
        String(p.user_id),
        { nickname: p.nickname, photo: p.photo },
      ]),
    );

    return rankingData.map((r: any) => {
      const uid = String(r.user_id);
      const points = Number(r.points) || 0;
      const profile = profileMap.get(uid) || { nickname: "Usuário", photo: null };
      return {
        userId: uid,
        userNickname: String(profile.nickname),
        userPhoto: profile.photo ? String(profile.photo) : null,
        points,
        level: Math.floor(points / 7) + 1,
      };
    });
  } catch (err: any) {
    console.error("Error getting ranking:", err);
    return [];
  }
}

// Update user workout with series, weight, and reps information
export async function updateUserWorkoutDb(
  workoutId: string,
  series: number,
  weight: number,
  reps: number,
): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const { error } = await supabase
    .from("user_workouts")
    .update({
      series: series,
      volume: weight,
    })
    .eq("id", workoutId);

  if (error) {
    console.error("Error updating user workout:", error);
    return false;
  }

  return true;
}

// Toggle completion for user diet
export async function toggleUserDietCompletionDb(
  userDietId: string,
  isCompleted: boolean,
): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const updatePayload: Record<string, any> = { is_completed: isCompleted };
  if (isCompleted) {
    updatePayload.completed_at = new Date().toISOString();
  } else {
    updatePayload.completed_at = null;
  }

  const { error } = await supabase
    .from("user_diets")
    .update(updatePayload)
    .eq("id", userDietId);

  if (error) {
    console.error("Error updating user diet:", error);
    return false;
  }

  return true;
}

// Toggle completion for user habit
export async function toggleUserHabitCompletionDb(
  userHabitId: string,
  isCompleted: boolean,
): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const updatePayload: Record<string, any> = { is_completed: isCompleted };
  if (isCompleted) {
    updatePayload.completed_at = new Date().toISOString();
  } else {
    updatePayload.completed_at = null;
  }

  const { error } = await supabase
    .from("user_habits")
    .update(updatePayload)
    .eq("id", userHabitId);

  if (error) {
    console.error("Error updating user habit:", error);
    return false;
  }

  return true;
}

// Update existing workout records instead of creating duplicates
export async function updateWorkoutSeriesDb(
  workoutRecords: Array<{
    id: string;
    volume?: number;
    reps?: number;
    time_rest?: number;
    duration?: number;
  }>,
): Promise<void> {
  if (!hasSupabaseConfig || !supabase || workoutRecords.length === 0) return;

  const results = await Promise.all(
    workoutRecords.map((record) =>
      supabase
        .from("user_workouts")
        .update({
          volume: record.volume || null,
          reps: record.reps || null,
          time_rest: record.time_rest || null,
          duration: record.duration || null,
        })
        .eq("id", record.id),
    ),
  );

  for (const { error } of results) {
    if (error) {
      const errorMsg = error?.message || String(error);
      const errorCode = error?.code || "UNKNOWN";
      console.error(`Error updating workout series [${errorCode}]:`, errorMsg);
      throw new Error(`Erro ao atualizar treino: ${errorMsg}`);
    }
  }
}

// Save workout series data - creates new records for each series
export async function saveWorkoutSeriesDb(
  userId: string,
  workoutData: Array<{
    workout_id: string;
    series: Array<{
      volume: number; // kg
      reps: number;
      time_rest: number; // in seconds
    }>;
    duration: number; // total workout duration in seconds
  }>,
): Promise<UserWorkout[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const seriesToInsert: any[] = [];

  for (const workout of workoutData) {
    for (const serie of workout.series) {
      seriesToInsert.push({
        user_id: userId,
        workout_id: workout.workout_id,
        volume: serie.volume || null,
        reps: serie.reps || null,
        time_rest: serie.time_rest || null,
        duration: workout.duration || null,
      });
    }
  }

  if (seriesToInsert.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("user_workouts")
    .insert(seriesToInsert)
    .select("id, workout_id, user_id, volume, reps, time_rest, duration");

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error saving workout series [${errorCode}]:`, errorMsg);
    throw new Error(`Erro ao registrar treino: ${errorMsg}`);
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id ?? ""),
    workout_id: String(row.workout_id ?? ""),
    user_id: String(row.user_id ?? ""),
    volume: row.volume,
    reps: row.reps,
    time_rest: row.time_rest,
    duration: row.duration,
  }));
}

// Notifications functionality
export type NotificationItem = {
  id: string;
  type: 1 | 2 | 3 | 4 | 5; // 1 = new follower, 2 = incentive, 3 = comment, 4 = duel invite, 5 = join request
  userId: string;
  userNickname: string;
  userPhoto: string | null;
  postId?: string;
  shotId?: string; // Present when notification relates to a shot (from shots_id column in notifications)
  postPhoto?: string;
  incentiveType?: number; // For type 2 (incentive): 1=apoio, 2=continua, 3=ganhador, 4=consegueMais, 5=limiteMaior, 6=maisAlgum
  groupName?: string; // For type 4 (duel invite)
  createdAt: string;
  read?: boolean; // Whether the notification has been read
};

export async function getNotificationsDb(): Promise<NotificationItem[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const viewer = await getViewer();
  if (!viewer) return [];

  try {
    // Read directly from notifications table
    const { data: notificationsData, error } = await supabase
      .from("notifications")
      .select(
        `
        id,
        follower_id,
        type,
        post_id,
        shots_id,
        created_at,
        read
      `
      )
      .eq("user_id", viewer.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error fetching notifications:", error);
      return [];
    }

    if (!notificationsData || notificationsData.length === 0) {
      return [];
    }

    // Get all follower IDs and post IDs to fetch related data
    const followerIds = [...new Set(notificationsData.map((n: any) => n.follower_id))];
    const postIds = [...new Set(notificationsData.filter((n: any) => n.type !== 4 && n.type !== 5 && !n.shots_id).map((n: any) => n.post_id).filter(Boolean))];
    const shotNotifIds = [...new Set(notificationsData.filter((n: any) => n.shots_id).map((n: any) => n.shots_id).filter(Boolean))];
    const groupIds = [...new Set(notificationsData.filter((n: any) => n.type === 4 || n.type === 5).map((n: any) => n.post_id).filter(Boolean))];
    const incentiveNotifications = notificationsData.filter((n: any) => n.type === 2);

    // Fetch follower profiles, post photos (posts + shots), group names, and like data in parallel
    const [profilesResult, postsResult, shotsResult, shotNotifResult, groupsResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, nickname, photo")
        .in("user_id", followerIds),
      postIds.length > 0
        ? supabase
          .from("posts")
          .select("id, photo")
          .in("id", postIds)
        : Promise.resolve({ data: [] as any[] }),
      postIds.length > 0
        ? supabase
          .from("shots")
          .select("id, video_url")
          .in("id", postIds)
        : Promise.resolve({ data: [] as any[] }),
      shotNotifIds.length > 0
        ? supabase
          .from("shots")
          .select("id, video_url")
          .in("id", shotNotifIds)
        : Promise.resolve({ data: [] as any[] }),
      groupIds.length > 0
        ? supabase
          .from("duel_groups")
          .select("id, name")
          .in("id", groupIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const { data: profiles } = profilesResult as any;
    const { data: posts } = postsResult as any;
    const { data: shots } = shotsResult as any;
    const { data: shotNotifs } = shotNotifResult as any;
    const { data: groups } = groupsResult as any;

    const profileMap = new Map<string, any>((profiles ?? []).map((p: any) => [p.user_id, p]));
    // Merge posts and shots into one map (shots use thumbnail_url as photo)
    const postMap = new Map<string, any>([
      ...(posts ?? []).map((p: any) => [p.id, { photo: p.photo }] as [string, any]),
      ...(shots ?? []).map((s: any) => [s.id, { photo: s.video_url }] as [string, any]),
    ]);
    // Map for shots coming via shots_id column
    const shotNotifMap = new Map<string, any>((shotNotifs ?? []).map((s: any) => [s.id, { photo: s.video_url }]));
    const groupMap = new Map<string, any>((groups ?? []).map((g: any) => [g.id, g]));

    // Fetch like types for incentive notifications.
    // Key: notif.id → incentive type number.
    // Strategy: for each incentive notification, fetch ALL likes from that user on that post/shot
    // (ordered by created_at asc), then pick the like whose index matches the notification's
    // rank among notifications from the same user+post pair (oldest notif → oldest like).
    // This correctly handles users who gave multiple different incentives on the same post/shot.
    let likesMap = new Map<string, number>(); // notif.id → incentive type
    if (incentiveNotifications.length > 0) {
      // Separate incentive notifications: shots (have shots_id) vs regular posts (have post_id)
      const shotIncentiveNotifs = incentiveNotifications.filter((n: any) => n.shots_id);
      const postIncentiveNotifs = incentiveNotifications.filter((n: any) => !n.shots_id && n.post_id);

      // --- Regular post incentives (tabela: likes, coluna: post_id) ---
      const groupedPostNotifs = new Map<string, any[]>();
      for (const notif of postIncentiveNotifs) {
        const key = `${notif.follower_id}:${notif.post_id}`;
        if (!groupedPostNotifs.has(key)) groupedPostNotifs.set(key, []);
        groupedPostNotifs.get(key)!.push(notif);
      }
      for (const group of groupedPostNotifs.values()) {
        group.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
      const uniquePostPairs = [...groupedPostNotifs.keys()];
      const postLikeQueries = uniquePostPairs.map((key) => {
        const [followerId, postId] = key.split(":");
        return supabase
          .from("likes")
          .select("type, created_at")
          .eq("post_id", postId)
          .eq("user_id", followerId)
          .order("created_at", { ascending: true })
          .then((r: any) => (r.data ?? []) as any[]);
      });

      // --- Shot incentives (tabela: shots_likes, coluna: shots_id) ---
      const groupedShotNotifs = new Map<string, any[]>();
      for (const notif of shotIncentiveNotifs) {
        const key = `${notif.follower_id}:${notif.shots_id}`;
        if (!groupedShotNotifs.has(key)) groupedShotNotifs.set(key, []);
        groupedShotNotifs.get(key)!.push(notif);
      }
      for (const group of groupedShotNotifs.values()) {
        group.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
      const uniqueShotPairs = [...groupedShotNotifs.keys()];
      const shotLikeQueries = uniqueShotPairs.map((key) => {
        const [followerId, shotId] = key.split(":");
        return supabase
          .from("shots_likes")
          .select("type, created_at")
          .eq("shots_id", shotId)
          .eq("user_id", followerId)
          .order("created_at", { ascending: true })
          .then((r: any) => (r.data ?? []) as any[]);
      });

      const [postLikeResults, shotLikeResults] = await Promise.all([
        Promise.all(postLikeQueries),
        Promise.all(shotLikeQueries),
      ]);

      uniquePostPairs.forEach((key, idx) => {
        const likes: any[] = postLikeResults[idx] ?? [];
        const notifs = groupedPostNotifs.get(key)!;
        notifs.forEach((notif: any, i: number) => {
          const like = likes[i];
          if (like?.type !== undefined && like.type !== null) {
            likesMap.set(notif.id, Number(like.type));
          }
        });
      });

      uniqueShotPairs.forEach((key, idx) => {
        const likes: any[] = shotLikeResults[idx] ?? [];
        const notifs = groupedShotNotifs.get(key)!;
        notifs.forEach((notif: any, i: number) => {
          const like = likes[i];
          if (like?.type !== undefined && like.type !== null) {
            likesMap.set(notif.id, Number(like.type));
          }
        });
      });
    }

    // Transform notifications table records to NotificationItem format
    const notifications: NotificationItem[] = notificationsData
      .map((notif: any) => {
        const profile = profileMap.get(notif.follower_id);
        if (!profile) return null;

        const notification: NotificationItem = {
          id: notif.id,
          type: notif.type,
          userId: notif.follower_id,
          userNickname: profile.nickname,
          userPhoto: profile.photo,
          createdAt: notif.created_at,
          read: notif.read ?? false,
        };

        // Add incentive type for type 2 notifications (keyed by notif.id)
        if (notif.type === 2 && likesMap.has(notif.id)) {
          notification.incentiveType = likesMap.get(notif.id);
        }

        // Add shot-related fields when shots_id is present (from DB trigger)
        if (notif.shots_id && notif.type !== 4 && notif.type !== 5) {
          notification.shotId = notif.shots_id;
          const shot = shotNotifMap.get(notif.shots_id);
          if (shot?.photo) {
            notification.postPhoto = shot.photo;
          }
        }
        // Add post-related fields for non-duel notifications (regular posts)
        else if (notif.post_id && notif.type !== 4 && notif.type !== 5) {
          notification.postId = notif.post_id;
          const post = postMap.get(notif.post_id);
          if (post?.photo) {
            notification.postPhoto = post.photo;
          }
        }

        // Add group name for duel invite/join-request notifications (type 4 and 5)
        if ((notif.type === 4 || notif.type === 5) && notif.post_id) {
          const group = groupMap.get(notif.post_id);
          notification.groupName = group?.name ?? "Duelo";
        }

        return notification;
      })
      .filter((n: NotificationItem | null) => n !== null) as NotificationItem[];

    return notifications;
  } catch (err: any) {
    console.error("Error getting notifications:", err);
    return [];
  }
}

export async function getUnreadNotificationsCountDb(): Promise<number> {
  if (!hasSupabaseConfig || !supabase) return 0;

  const viewer = await getViewer();
  if (!viewer) return 0;

  try {
    // Try with read filter first
    let { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", viewer.id)
      .eq("read", false);

    // If read column doesn't exist, fallback to all unread
    if (error && error.message?.includes("read")) {
      console.warn("Read column might not exist, fetching all notifications count");
      const { count: allCount, error: fallbackError } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", viewer.id);

      if (fallbackError) {
        const errorMsg = typeof fallbackError === 'object' ? JSON.stringify(fallbackError) : String(fallbackError);
        console.error("Error fetching unread count:", errorMsg);
        return 0;
      }
      return allCount ?? 0;
    }

    if (error) {
      const errorMsg = typeof error === 'object' ? JSON.stringify(error) : String(error);
      console.error("Error fetching unread count:", errorMsg);
      return 0;
    }

    return count ?? 0;
  } catch (err: any) {
    const errorMsg = typeof err === 'object' ? JSON.stringify(err) : String(err);
    console.error("Error getting unread notifications count:", errorMsg);
    return 0;
  }
}

export async function markNotificationsAsReadDb(): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const viewer = await getViewer();
  if (!viewer) return false;

  try {
    // Try to update with read filter
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", viewer.id)
      .eq("read", false);

    if (error) {
      // Log the error properly
      const errorMsg = typeof error === 'object' ? JSON.stringify(error) : String(error);
      console.warn("Error marking notifications as read (this might be normal if read column doesn't exist):", errorMsg);

      // If it's a column not found error, just return true since we can't track read status
      if (errorMsg.includes("read") || errorMsg.includes("column")) {
        return true;
      }

      return false;
    }

    return true;
  } catch (err: any) {
    const errorMsg = typeof err === 'object' ? JSON.stringify(err) : String(err);
    console.warn("Error marking notifications as read:", errorMsg);
    // Don't fail the operation if read column doesn't exist
    return true;
  }
}

export async function clearNotificationsDb(): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const viewer = await getViewer();
  if (!viewer) return false;

  try {
    // Delete all notifications for the current user
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", viewer.id);

    if (error) {
      const errorMsg = typeof error === 'object' ? JSON.stringify(error) : String(error);
      console.error("Error clearing notifications:", errorMsg);
      return false;
    }

    return true;
  } catch (err: any) {
    const errorMsg = typeof err === 'object' ? JSON.stringify(err) : String(err);
    console.error("Error clearing notifications:", errorMsg);
    return false;
  }
}

export function subscribeToUnreadNotificationsDb(
  onNewNotification: (count: number) => void
): (() => void) | null {
  if (!hasSupabaseConfig || !supabase) return null;

  let isSubscribed = true;

  (async () => {
    try {
      const viewer = await getViewer();
      if (!viewer || !isSubscribed) return;

      // Subscribe to insert/update events on notifications table
      const subscription = supabase
        .channel(`notifications:${viewer.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${viewer.id}`,
          },
          async () => {
            if (!isSubscribed) return;
            // Fetch updated unread count
            const count = await getUnreadNotificationsCountDb();
            onNewNotification(count);
          }
        )
        .subscribe();

      // Return unsubscribe function
      return () => {
        isSubscribed = false;
        subscription.unsubscribe();
      };
    } catch (err: any) {
      console.error("Error subscribing to notifications:", err);
    }
  })();

  // Cleanup function
  return () => {
    isSubscribed = false;
  };
}

// Post Creation Function
export async function createPostDb(
  photoUrl: string | string[] | null,
  description: string,
  userGoalId?: string | null,
): Promise<string> {
  if (!supabase) throw new Error("Supabase não configurado");

  try {
    const viewer = await getViewer();
    if (!viewer) throw new Error("Usuário não autenticado");

    // Handle null (text-only post), single string, or array of strings
    const photos = photoUrl === null ? [] : Array.isArray(photoUrl) ? photoUrl : [photoUrl];
    const firstPhoto = photos.length > 0 ? photos[0] : null;
    const photosJson = photos.length > 1 ? photos : null;

    const { data, error } = await supabase
      .from("posts")
      .insert({
        user_id: viewer.id,
        photo: firstPhoto,
        photos: photosJson,
        description: description.trim(),
        user_goal_id: userGoalId ? Number(userGoalId) : null,
        created_at: new Date().toISOString(),
      })
      .select("id");

    if (error) throw error;
    if (!data || data.length === 0) throw new Error("Failed to create post");

    // Award points for creating a post
    await addPointsDb(5);

    return data[0].id;
  } catch (err: any) {
    console.error("Error creating post:", err);
    throw err;
  }
}

// Delete Post Function
export async function deletePostDb(postId: string): Promise<boolean> {
  if (!supabase) throw new Error("Supabase não configurado");

  try {
    const viewer = await getViewer();
    if (!viewer) throw new Error("Usuário não autenticado");

    // Get the post first to verify ownership and get photo URL
    const { data: postData, error: fetchError } = await supabase
      .from("posts")
      .select("user_id, photo")
      .eq("id", postId)
      .single();

    if (fetchError) throw fetchError;
    if (!postData) throw new Error("Post não encontrado");

    // Verify ownership
    if (postData.user_id !== viewer.id) {
      throw new Error("Você não tem permissão para deletar este post");
    }

    // Delete notifications referencing this post
    await supabase.from("notifications").delete().eq("post_id", postId);

    // Delete likes/incentives associated with the post
    await supabase.from("likes").delete().eq("post_id", postId);

    // Delete comments associated with the post (must succeed before deleting post due to FK)
    const { error: commentsError } = await supabase
      .from("comments")
      .delete()
      .eq("post_id", postId);

    if (commentsError) {
      console.error("Error deleting comments:", commentsError);
      throw commentsError;
    }

    // Delete the post itself
    const deleteResponse = await supabase
      .from("posts")
      .delete()
      .eq("id", postId)
      .select();


    const { error: postDeleteError, data: deletedData } = deleteResponse;

    if (postDeleteError) {
      console.error("Erro ao deletar post:", postDeleteError);
      throw postDeleteError;
    }


    // Delete image from storage if it exists
    if (postData.photo) {
      try {
        // Extract the file path from the public URL
        // URL format: https://xxxxx.supabase.co/storage/v1/object/public/posts/user_id/timestamp.jpg
        const pathMatch = postData.photo.match(/\/posts\/(.+)$/);
        if (pathMatch && pathMatch[1]) {
          const filePath = pathMatch[1];
          await supabase.storage.from("posts").remove([filePath]);
        }
      } catch (err) {
        console.error("Error deleting image from storage:", err);
        // Don't fail the operation if image deletion fails
      }
    }

    return true;
  } catch (err: any) {
    console.error("Error deleting post:", err);
    throw err;
  }
}

export async function updatePostDb(
  postId: string,
  description: string,
  userGoalId: string | null,
): Promise<boolean> {
  if (!supabase) throw new Error("Supabase não configurado");

  try {
    const viewer = await getViewer();
    if (!viewer) throw new Error("Usuário não autenticado");

    // Verify ownership
    const { data: postData, error: fetchError } = await supabase
      .from("posts")
      .select("user_id")
      .eq("id", postId)
      .single();

    if (fetchError) throw fetchError;
    if (!postData) throw new Error("Post não encontrado");

    if (postData.user_id !== viewer.id) {
      throw new Error("Você não tem permissão para editar este post");
    }

    // Update the post
    const { error } = await supabase
      .from("posts")
      .update({
        description: description.trim(),
        user_goal_id: userGoalId,
      })
      .eq("id", postId);

    if (error) throw error;
    return true;
  } catch (err: any) {
    console.error("Error updating post:", err);
    throw err;
  }
}

export async function getUserShotsDb(userId: string): Promise<ShotWithUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  try {
    const { data: shotsData, error: shotsError } = await supabase
      .from("shots")
      .select("id, user_id, video_url, description, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (shotsError) {
      console.error("Error fetching user shots:", shotsError);
      return [];
    }

    if (!shotsData || shotsData.length === 0) {
      return [];
    }

    // Get user profile
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, nickname, photo")
      .eq("user_id", userId)
      .single();

    if (profileError) {
      console.error("Error fetching user profile:", profileError);
      return [];
    }

    // Get all likes for these shots
    const shotIds = (shotsData ?? []).map((r: any) => String(r.id));
    let allLikes: any[] = [];
    if (shotIds.length > 0) {
      const { data: likesData, error: likesError } = await supabase
        .from("shots_likes")
        .select("shots_id, type, user_id")
        .in("shots_id", shotIds);

      if (likesError) {
        // Try legacy format
        const { data: legacyLikes } = await supabase
          .from("likes")
          .select("post_id, type, user_id")
          .in("post_id", shotIds);
        allLikes = legacyLikes ?? [];
      } else {
        allLikes = likesData ?? [];
      }
    }

    // Get comment counts
    const { data: commentsData, error: commentsError } = await supabase
      .from("shots_comments")
      .select("shots_id")
      .in("shots_id", shotIds);

    const commentMap = new Map<string, number>();
    if (!commentsError && commentsData) {
      commentsData.forEach((c: any) => {
        commentMap.set(c.shots_id, (commentMap.get(c.shots_id) ?? 0) + 1);
      });
    }

    // Transform to ShotWithUser format
    const shotsWithUserData: ShotWithUser[] = (shotsData ?? []).map((shot: any) => {
      const likes = {
        apoio: 0,
        continua: 0,
        ganhador: 0,
        consegueMais: 0,
        limiteMaior: 0,
        maisAlgum: 0,
      };

      allLikes.forEach((like: any) => {
        const shotIdStr = String(like.shots_id || like.post_id);
        if (shotIdStr === String(shot.id)) {
          const typeMap: Record<number, keyof typeof likes> = {
            1: "apoio",
            2: "continua",
            3: "ganhador",
            4: "consegueMais",
            5: "limiteMaior",
            6: "maisAlgum",
          };
          const key = typeMap[like.type];
          if (key) likes[key]++;
        }
      });

      return {
        ...shot,
        userNickname: profileData?.nickname || "Usuário",
        userPhoto: profileData?.photo || null,
        likes,
        userLikes: [],
        commentCount: commentMap.get(shot.id) ?? 0,
      };
    });

    return shotsWithUserData;
  } catch (err: any) {
    console.error("Error getting user shots:", err);
    return [];
  }
}

// Complaint Functions
export async function reportUserDb(followerId: string, reason: string): Promise<boolean> {
  if (!supabase) throw new Error("Supabase não configurado");

  try {
    const viewer = await getViewer();
    if (!viewer) throw new Error("Usuário não autenticado");

    const { error } = await supabase
      .from("user_complaint")
      .insert({
        user_id: viewer.id,
        follower_id: followerId,
        reason: reason,
        created_at: new Date().toISOString(),
      });

    if (error) throw error;
    return true;
  } catch (err: any) {
    console.error("Error reporting user:", err);
    throw err;
  }
}

export async function reportPostDb(postId: string, reason: string): Promise<boolean> {
  if (!supabase) throw new Error("Supabase não configurado");

  try {
    const viewer = await getViewer();
    if (!viewer) throw new Error("Usuário não autenticado");

    const { error } = await supabase
      .from("post_complaint")
      .insert({
        user_id: viewer.id,
        post_id: postId,
        reason: reason,
        created_at: new Date().toISOString(),
      });

    if (error) throw error;
    return true;
  } catch (err: any) {
    console.error("Error reporting post:", err);
    throw err;
  }
}

// Check-in Functions
export type CheckIn = {
  id: string;
  user_id: string;
  check_in_date: string;
  day_of_week: number;
  created_at: string;
  updated_at: string;
};

export async function createCheckInDb(userId: string): Promise<CheckIn> {
  if (!supabase) throw new Error("Supabase não configurado");

  try {
    const today = new Date();
    const checkInDate = today.toISOString().split('T')[0];
    const dayOfWeek = today.getDay();

    const { data, error } = await supabase
      .from("check_ins")
      .insert({
        user_id: userId,
        check_in_date: checkInDate,
        day_of_week: dayOfWeek,
      })
      .select()
      .single();

    if (error) {
      // If unique constraint error, it means check-in already exists for today
      if (error.code === '23505') {
        throw new Error("Você já fez check-in hoje");
      }
      throw error;
    }

    return data as CheckIn;
  } catch (err: any) {
    console.error("Error creating check-in:", err);
    throw err;
  }
}

export async function getTodayCheckInDb(userId: string): Promise<CheckIn | null> {
  if (!supabase) throw new Error("Supabase não configurado");

  try {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from("check_ins")
      .select()
      .eq("user_id", userId)
      .eq("check_in_date", today)
      .maybeSingle();

    if (error) throw error;
    return data as CheckIn | null;
  } catch (err: any) {
    console.error("Error getting today's check-in:", err);
    return null;
  }
}

export async function getWeekCheckInsDb(userId: string): Promise<number[]> {
  if (!supabase) throw new Error("Supabase não configurado");

  try {
    // Get the first day of the current week (Sunday)
    const today = new Date();
    const firstDay = new Date(today);
    firstDay.setDate(today.getDate() - today.getDay());
    firstDay.setHours(0, 0, 0, 0);

    const weekStart = firstDay.toISOString().split('T')[0];
    const weekEnd = new Date(firstDay);
    weekEnd.setDate(firstDay.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from("check_ins")
      .select("day_of_week")
      .eq("user_id", userId)
      .gte("check_in_date", weekStart)
      .lte("check_in_date", weekEndStr);

    if (error) throw error;

    // Extract unique day_of_week values
    const daysSet = new Set((data ?? []).map((row: any) => row.day_of_week));
    return Array.from(daysSet).sort((a, b) => a - b);
  } catch (err: any) {
    console.error("Error getting week check-ins:", err);
    return [];
  }
}

export async function getCheckInHistoryDb(userId: string, days: number = 30): Promise<CheckIn[]> {
  if (!supabase) throw new Error("Supabase não configurado");

  try {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    const sinceDateStr = sinceDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from("check_ins")
      .select()
      .eq("user_id", userId)
      .gte("check_in_date", sinceDateStr)
      .order("check_in_date", { ascending: false });

    if (error) throw error;
    return (data ?? []) as CheckIn[];
  } catch (err: any) {
    console.error("Error getting check-in history:", err);
    return [];
  }
}

// Commercial Profile Functions
export type CommercialProfile = {
  id: string;
  user_id: string;
  business_segment?: string;
  business_name?: string;
  business_description?: string;
  business_phone?: string;
  business_email?: string;
  business_website?: string;
  business_logo_url?: string;
  business_banner_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function getCommercialProfileDb(userId: string): Promise<CommercialProfile | null> {
  if (!supabase) throw new Error("Supabase não configurado");

  try {
    const { data, error } = await supabase
      .from("commercial_profiles")
      .select()
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return data as CommercialProfile | null;
  } catch (err: any) {
    console.error("Error getting commercial profile:", err);
    return null;
  }
}

export async function createOrUpdateCommercialProfileDb(
  userId: string,
  profile: Partial<CommercialProfile>,
): Promise<CommercialProfile> {
  if (!supabase) throw new Error("Supabase não configurado");

  try {
    const existingProfile = await getCommercialProfileDb(userId);

    if (existingProfile) {
      // Update existing profile
      const { data, error } = await supabase
        .from("commercial_profiles")
        .update({
          ...profile,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;
      return data as CommercialProfile;
    } else {
      // Create new profile
      const { data, error } = await supabase
        .from("commercial_profiles")
        .insert({
          user_id: userId,
          ...profile,
        })
        .select()
        .single();

      if (error) throw error;
      return data as CommercialProfile;
    }
  } catch (err: any) {
    console.error("Error creating/updating commercial profile:", err);
    throw err;
  }
}

export async function deleteCommercialProfileDb(userId: string): Promise<boolean> {
  if (!supabase) throw new Error("Supabase não configurado");

  try {
    const { error } = await supabase
      .from("commercial_profiles")
      .delete()
      .eq("user_id", userId);

    if (error) throw error;
    return true;
  } catch (err: any) {
    console.error("Error deleting commercial profile:", err);
    throw err;
  }
}

// Workout History Functions
export type WorkoutHistoryRecord = {
  id: string;
  userId: string;
  userWorkoutId: string | null;
  workoutId: string;
  workoutName: string;
  kilos: number | null;
  volume: string | null;
  dateCompleted: string;
  createdAt: string;
};

export async function saveWorkoutHistoryDb(
  userId: string,
  userWorkoutId: string | null,
  workoutId: string,
  kilos: number | null = null,
  volume: string | null = null,
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  try {
    const { error } = await supabase
      .from("user_workouts_hist")
      .insert([
        {
          user_id: userId,
          user_workout_id: userWorkoutId,
          workout_id: workoutId,
          kilos,
          volume,
          date_completed: new Date().toISOString(),
        },
      ]);

    if (error) throw error;
  } catch (err: any) {
    console.error("Error saving workout history:", err);
    throw err;
  }
}

export async function getWorkoutHistoryDb(
  userId: string,
  workoutId: string
): Promise<WorkoutHistoryRecord[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  try {
    const { data, error } = await supabase
      .from("user_workouts_hist")
      .select(`
        id,
        user_id,
        user_workout_id,
        workout_id,
        kilos,
        volume,
        date_completed,
        created_at,
        workouts (name)
      `)
      .eq("user_id", userId)
      .eq("workout_id", workoutId)
      .order("date_completed", { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      id: String(row.id),
      userId: String(row.user_id),
      userWorkoutId: row.user_workout_id,
      workoutId: String(row.workout_id),
      workoutName: row.workouts?.name || "Exercício",
      kilos: row.kilos,
      volume: row.volume,
      dateCompleted: String(row.date_completed),
      createdAt: String(row.created_at),
    }));
  } catch (err: any) {
    console.error("Error fetching workout history:", err);
    return [];
  }
}

/**
 * Batch-fetch workout history for multiple workoutIds in a single query.
 * Returns a map of workoutId → WorkoutHistoryRecord[]
 */
export async function getWorkoutHistoriesBatchDb(
  userId: string,
  workoutIds: string[],
): Promise<Record<string, WorkoutHistoryRecord[]>> {
  if (!hasSupabaseConfig || !supabase || workoutIds.length === 0) return {};

  try {
    const { data, error } = await supabase
      .from("user_workouts_hist")
      .select("id, user_id, user_workout_id, workout_id, kilos, volume, date_completed, created_at, workouts(name)")
      .eq("user_id", userId)
      .in("workout_id", workoutIds)
      .order("date_completed", { ascending: false });

    if (error) throw error;

    const result: Record<string, WorkoutHistoryRecord[]> = {};
    workoutIds.forEach((id) => { result[id] = []; });

    (data ?? []).forEach((row: any) => {
      const wid = String(row.workout_id);
      if (!result[wid]) result[wid] = [];
      result[wid].push({
        id: String(row.id),
        userId: String(row.user_id),
        userWorkoutId: row.user_workout_id,
        workoutId: wid,
        workoutName: row.workouts?.name || "Exercício",
        kilos: row.kilos,
        volume: row.volume,
        dateCompleted: String(row.date_completed),
        createdAt: String(row.created_at),
      });
    });

    return result;
  } catch (err: any) {
    console.error("Error fetching workout histories batch:", err);
    return {};
  }
}

/**
 * Batch-check follow status for multiple user IDs in a single query.
 * Returns a map of userId → boolean (is current viewer following that user)
 */
export async function getFollowingStatusBatchDb(
  targetUserIds: string[],
): Promise<Record<string, boolean>> {
  if (!hasSupabaseConfig || !supabase || targetUserIds.length === 0) return {};

  const viewer = await getViewer();
  if (!viewer) return Object.fromEntries(targetUserIds.map((id) => [id, false]));

  try {
    const { data, error } = await supabase
      .from("following")
      .select("following_id")
      .eq("user_id", viewer.id)
      .in("following_id", targetUserIds);

    if (error) throw error;

    const followingSet = new Set((data ?? []).map((r: any) => String(r.following_id)));
    return Object.fromEntries(targetUserIds.map((id) => [id, followingSet.has(id)]));
  } catch (err: any) {
    console.error("Error batch-checking follow status:", err);
    return Object.fromEntries(targetUserIds.map((id) => [id, false]));
  }
}

// Save diet history record
export async function saveDietHistoryDb(
  userId: string,
  userDietId: string | null,
  dietId: number,
  quantity: number | null = null,
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  try {
    const { error } = await supabase
      .from("user_diets_hist")
      .insert([
        {
          user_id: userId,
          user_diet_id: userDietId,
          diet_id: dietId,
          quantity,
          created_at: new Date().toISOString(),
        },
      ]);

    if (error) throw error;
  } catch (err: any) {
    console.error("Error saving diet history:", err);
    throw err;
  }
}

// Save habit history record
export async function saveHabitHistoryDb(
  userId: string,
  userHabitId: string | null,
  habitId: number,
  quantity: number | null = null,
  frequency: number | null = null
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  try {
    const { error } = await supabase
      .from("user_habits_hist")
      .insert([
        {
          user_id: userId,
          user_habit_id: userHabitId,
          habit_id: habitId,
          quantity,
          frequency,
          created_at: new Date().toISOString(),
        },
      ]);

    if (error) throw error;
  } catch (err: any) {
    console.error("Error saving habit history:", err);
    throw err;
  }
}

// Check if user has completed any routines today
export async function hasCompletedRoutineToday(userId: string): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.toISOString();

    // Check for today's workouts
    const { data: workoutData, error: workoutError } = await supabase
      .from("user_workouts_hist")
      .select("id")
      .eq("user_id", userId)
      .gte("created_at", todayStart)
      .limit(1);

    if (!workoutError && workoutData && workoutData.length > 0) {
      return true;
    }

    // Check for today's diets
    const { data: dietData, error: dietError } = await supabase
      .from("user_diets_hist")
      .select("id")
      .eq("user_id", userId)
      .gte("created_at", todayStart)
      .limit(1);

    if (!dietError && dietData && dietData.length > 0) {
      return true;
    }

    // Check for today's habits
    const { data: habitData, error: habitError } = await supabase
      .from("user_habits_hist")
      .select("id")
      .eq("user_id", userId)
      .gte("created_at", todayStart)
      .limit(1);

    if (!habitError && habitData && habitData.length > 0) {
      return true;
    }

    return false;
  } catch (err: any) {
    console.error("Error checking routine completion today:", err);
    return false;
  }
}

// Group and Check-in Types
export type DuelGroup = {
  id: string;
  createdBy: string;
  name: string;
  location: string;
  goal: string;
  icon: string;
  photo?: string | null;
  createdAt: string;
  updatedAt?: string;
  endDate?: string;
};

export type CompletedRoutineExercise = {
  workoutId: string;
  workoutName: string;
  muscleGroup: string | null;
  kilos: number | null;
  volume: string | null;
};

export type CompletedRoutine = {
  /** user_workouts.id — used as the selector key */
  userWorkoutId: string;
  routineName: string;
  /** exercises belonging to this routine (from user_workouts_hist today) */
  exercises: CompletedRoutineExercise[];
  /** total volume across all exercises */
  totalVolume: number;
  /** total sets across all exercises (count of hist records) */
  totalSeries: number;
  /** primary muscle group (most common) */
  primaryMuscleGroup: string | null;
  completedAt: string;
};

/**
 * Returns all routines the user completed today (or recently), built from
 * user_workouts_hist joined with user_workouts → routines (for the routine name)
 * and workouts (for muscle_group).
 */
export async function getCompletedRoutinesTodayDb(userId: string): Promise<CompletedRoutine[]> {
  if (!hasSupabaseConfig || !supabase || !userId) return [];

  try {
    // Fetch all hist records from the last 7 days so the user always has recent options
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const { data, error } = await supabase
      .from("user_workouts_hist")
      .select(`
        id,
        user_workout_id,
        workout_id,
        kilos,
        volume,
        date_completed,
        workouts (name, muscle_group)
      `)
      .eq("user_id", userId)
      .gte("date_completed", since.toISOString())
      .order("date_completed", { ascending: false });

    if (error || !data || data.length === 0) return [];

    // Get all distinct user_workout_ids to fetch routine names
    const userWorkoutIds = [...new Set((data as any[]).map((r: any) => r.user_workout_id).filter(Boolean))];

    const routineNameMap: Record<string, string> = {};
    if (userWorkoutIds.length > 0) {
      const { data: uwData } = await supabase
        .from("user_workouts")
        .select("id, name")
        .in("id", userWorkoutIds);
      (uwData ?? []).forEach((uw: any) => {
        routineNameMap[String(uw.id)] = uw.name || "Rotina de Exercícios";
      });
    }

    // Group by (routineName + date day) to avoid duplicates when the user has
    // multiple user_workouts rows with the same name (e.g. two "Peito" entries).
    const sessionMap: Record<string, { userWorkoutId: string; routineName: string; exercises: CompletedRoutineExercise[]; completedAt: string }> = {};

    for (const row of data as any[]) {
      const uwId = row.user_workout_id ? String(row.user_workout_id) : "__none__";
      const routineName = routineNameMap[uwId] || "Rotina de Exercícios";
      const day = row.date_completed?.substring(0, 10) ?? "unknown";
      // Key by name+day so all same-named routines on the same day merge into one card
      const key = `${routineName}__${day}`;

      if (!sessionMap[key]) {
        sessionMap[key] = {
          userWorkoutId: uwId,
          routineName,
          exercises: [],
          completedAt: row.date_completed,
        };
      }

      // Avoid adding the exact same exercise twice (same workout_id + kilos)
      const exerciseKey = `${row.workout_id}__${row.kilos ?? ""}`;
      const alreadyAdded = sessionMap[key].exercises.some(
        (ex) => `${ex.workoutId}__${ex.kilos ?? ""}` === exerciseKey,
      );
      if (!alreadyAdded) {
        sessionMap[key].exercises.push({
          workoutId: String(row.workout_id),
          workoutName: (row.workouts as any)?.name || "Exercício",
          muscleGroup: (row.workouts as any)?.muscle_group || null,
          kilos: row.kilos,
          volume: row.volume,
        });
      }
    }

    return Object.values(sessionMap).map((session) => {
      const totalSeries = session.exercises.length;
      const totalVolume = session.exercises.reduce((sum, ex) => {
        const v = parseFloat(String(ex.volume ?? "0")) || 0;
        return sum + v;
      }, 0);

      // Most frequent muscle group
      const mgCount: Record<string, number> = {};
      session.exercises.forEach((ex) => {
        if (ex.muscleGroup) mgCount[ex.muscleGroup] = (mgCount[ex.muscleGroup] || 0) + 1;
      });
      const primaryMuscleGroup = Object.entries(mgCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      return {
        userWorkoutId: session.userWorkoutId,
        routineName: session.routineName,
        exercises: session.exercises,
        totalVolume,
        totalSeries,
        primaryMuscleGroup,
        completedAt: session.completedAt,
      };
    });
  } catch (err: any) {
    console.error("Error fetching completed routines:", err);
    return [];
  }
}

export type GroupCheckIn = {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  userPhoto: string | null;
  photo: string;
  description: string;
  workoutInfo: string;
  muscleGroup: string | null;
  exercises: CompletedRoutineExercise[];
  series: number;
  volume: number;
  createdAt: string;
};

// Create a new duel group
export async function createDuelGroupDb(
  createdBy: string,
  name: string,
  location: string,
  goal: string,
  members: string[],
  endDate?: string
): Promise<DuelGroup> {
  if (!supabase) throw new Error("Supabase not configured");

  try {
    // Create the group
    const { data: groupData, error: groupError } = await supabase
      .from("duel_groups")
      .insert({
        created_by: createdBy,
        name,
        location,
        goal,
        end_date: endDate || null,
        icon: "⚔️",
      })
      .select()
      .single();

    if (groupError) throw groupError;
    if (!groupData) throw new Error("Failed to create group");

    // Add the creator as accepted participant, invited members as pending
    const rows = [
      { group_id: groupData.id, user_id: createdBy, status: "accepted" },
      ...members.map((userId) => ({ group_id: groupData.id, user_id: userId, status: "pending" })),
    ];
    const { error: participantsError } = await supabase
      .from("duel_group_participants")
      .insert(rows);

    if (participantsError) throw participantsError;

    // Send duel invite notification to each invited member
    if (members.length > 0) {
      const { error: notifError } = await supabase.from("notifications").insert(
        members.map((userId) => ({
          user_id: userId,
          follower_id: createdBy,
          type: 4,
          post_id: groupData.id,
          read: false,
        }))
      );
      if (notifError) {
        console.error("Error inserting duel invite notifications:", notifError);
      }
    }

    return {
      id: groupData.id,
      createdBy: groupData.created_by,
      name: groupData.name,
      location: groupData.location,
      goal: groupData.goal,
      icon: groupData.icon,
      createdAt: groupData.created_at,
      updatedAt: groupData.updated_at,
      endDate: groupData.end_date,
    };
  } catch (error: any) {
    const errorMsg = error?.message || JSON.stringify(error);
    console.error("Error creating duel group:", errorMsg);
    console.error("Full error details:", error);
    throw new Error(errorMsg);
  }
}

// Get group by ID with participant count
export async function getDuelGroupDb(groupId: string): Promise<DuelGroup | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("duel_groups")
      .select("*")
      .eq("id", groupId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      createdBy: data.created_by,
      name: data.name,
      location: data.location,
      goal: data.goal,
      icon: data.icon,
      photo: data.photo || null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      endDate: data.end_date,
    };
  } catch (error) {
    console.error("Error getting duel group:", error);
    return null;
  }
}

// Get user's own groups (created by user)
export async function getUserCreatedDuelGroupsDb(userId: string): Promise<DuelGroup[]> {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("duel_groups")
      .select("*")
      .eq("created_by", userId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];

    return data.map((group: any) => ({
      id: group.id,
      createdBy: group.created_by,
      name: group.name,
      location: group.location,
      goal: group.goal,
      icon: group.icon,
      photo: group.photo || null,
      createdAt: group.created_at,
      updatedAt: group.updated_at,
      endDate: group.end_date,
    }));
  } catch (error) {
    console.error("Error getting user created groups:", error);
    return [];
  }
}

// Get groups user can participate in (not created by user, user not already member)
export async function getAvailableDuelGroupsDb(userId: string): Promise<DuelGroup[]> {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("duel_groups")
      .select("*")
      .neq("created_by", userId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];

    return data.map((group: any) => ({
      id: group.id,
      createdBy: group.created_by,
      name: group.name,
      location: group.location,
      goal: group.goal,
      icon: group.icon,
      photo: group.photo || null,
      createdAt: group.created_at,
      updatedAt: group.updated_at,
      endDate: group.end_date,
    }));
  } catch (error) {
    console.error("Error getting available groups:", error);
    return [];
  }
}

// Optimized: fetch available groups enriched with participant count, creator profile and membership
// status in 3 parallel queries instead of N*2+1 sequential ones.
export type EnrichedDuelGroup = DuelGroup & {
  creatorNickname: string;
  creatorPhoto: string | null;
  participants: number;
  isAlreadyMember: boolean;
  isPending: boolean;
};

export async function getEnrichedDuelGroupsDb(
  userId: string,
): Promise<{ myGroups: EnrichedDuelGroup[]; availableGroups: EnrichedDuelGroup[]; pendingInvites: Array<{ groupId: string; groupName: string; groupGoal: string; groupLocation: string }> }> {
  if (!supabase) return { myGroups: [], availableGroups: [], pendingInvites: [] };

  try {
    // 3 parallel queries — no waterfall
    const [createdResult, availResult, participantsResult] = await Promise.all([
      // My created groups
      supabase
        .from("duel_groups")
        .select("id, created_by, name, location, goal, icon, photo, created_at, updated_at, end_date")
        .eq("created_by", userId)
        .order("created_at", { ascending: false }),

      // Available groups (not created by me)
      supabase
        .from("duel_groups")
        .select("id, created_by, name, location, goal, icon, photo, created_at, updated_at, end_date")
        .neq("created_by", userId)
        .order("created_at", { ascending: false }),

      // All participations across all groups (accepted + pending) — one query for everything
      supabase
        .from("duel_group_participants")
        .select("group_id, user_id, status"),
    ]);

    const createdGroups = createdResult.data ?? [];
    const availGroups = availResult.data ?? [];
    const allParticipants = participantsResult.data ?? [];

    // Build lookup maps from the single participants query
    const countMap: Record<string, number> = {};
    const memberMap: Record<string, boolean> = {};
    const pendingMap: Record<string, boolean> = {};

    for (const p of allParticipants) {
      if (!p.group_id) continue;
      const isAccepted = !p.status || p.status === "accepted";
      if (isAccepted) {
        countMap[p.group_id] = (countMap[p.group_id] ?? 0) + 1;
        if (p.user_id === userId) memberMap[p.group_id] = true;
      } else if (p.status === "pending" && p.user_id === userId) {
        pendingMap[p.group_id] = true;
      }
    }

    // Batch-fetch creator profiles for available groups (one query)
    const creatorIds = [...new Set(availGroups.map((g: any) => g.created_by).filter(Boolean))];
    const creatorProfileMap: Record<string, { nickname: string; photo: string | null }> = {};
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nickname, photo")
        .in("user_id", creatorIds);
      (profiles ?? []).forEach((p: any) => {
        creatorProfileMap[p.user_id] = { nickname: p.nickname || "Usuário", photo: p.photo || null };
      });
    }

    const toBase = (g: any): DuelGroup => ({
      id: g.id,
      createdBy: g.created_by,
      name: g.name,
      location: g.location,
      goal: g.goal,
      icon: g.icon ?? "⚔️",
      photo: g.photo || null,
      createdAt: g.created_at,
      updatedAt: g.updated_at,
      endDate: g.end_date,
    });

    // Groups where user is a participant (accepted, not created by user)
    const participantGroupIds = allParticipants
      .filter((p) => p.user_id === userId && (!p.status || p.status === "accepted"))
      .map((p) => String(p.group_id));
    const createdGroupIds = new Set(createdGroups.map((g: any) => String(g.id)));
    const participantOnlyGroupIds = participantGroupIds.filter((id) => !createdGroupIds.has(id));

    let participantGroups: any[] = [];
    if (participantOnlyGroupIds.length > 0) {
      const { data: pgData } = await supabase
        .from("duel_groups")
        .select("id, created_by, name, location, goal, icon, photo, created_at, updated_at, end_date")
        .in("id", participantOnlyGroupIds);
      participantGroups = pgData ?? [];
    }

    const myGroups: EnrichedDuelGroup[] = [
      ...createdGroups.map((g: any) => ({
        ...toBase(g),
        creatorNickname: "",
        creatorPhoto: null,
        participants: countMap[g.id] ?? 1,
        isAlreadyMember: true,
        isPending: false,
      })),
      ...participantGroups.map((g: any) => ({
        ...toBase(g),
        creatorNickname: "",
        creatorPhoto: null,
        participants: countMap[g.id] ?? 1,
        isAlreadyMember: true,
        isPending: false,
      })),
    ];

    const availableGroups: EnrichedDuelGroup[] = availGroups.map((g: any) => {
      const creator = creatorProfileMap[g.created_by] ?? { nickname: "Usuário", photo: null };
      return {
        ...toBase(g),
        creatorNickname: creator.nickname,
        creatorPhoto: creator.photo,
        participants: countMap[g.id] ?? 1,
        isAlreadyMember: memberMap[g.id] ?? false,
        isPending: pendingMap[g.id] ?? false,
      };
    });

    // Build pendingInvites from the maps (groups where user has a pending invite)
    const pendingGroupIds = Object.keys(pendingMap);
    const pendingInvites = availGroups
      .filter((g: any) => pendingGroupIds.includes(String(g.id)))
      .map((g: any) => ({
        groupId: String(g.id),
        groupName: String(g.name),
        groupGoal: String(g.goal || ""),
        groupLocation: String(g.location || ""),
      }));

    return { myGroups, availableGroups, pendingInvites };
  } catch (error) {
    console.error("Error getting enriched duel groups:", error);
    return { myGroups: [], availableGroups: [], pendingInvites: [] };
  }
}

// Get groups created by users the current user follows (no external IDs needed)
export async function getFollowingGroupsDb(): Promise<DuelGroup[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const viewer = await getViewer();
  if (!viewer) return [];

  try {
    // Fetch following IDs directly from the following table
    const followingIds = await getFollowingIdsDb();
    if (followingIds.length === 0) return [];

    const { data, error } = await supabase
      .from("duel_groups")
      .select("*")
      .in("created_by", followingIds)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching following groups:", error);
      return [];
    }

    return (data ?? []).map((group: any) => ({
      id: group.id,
      createdBy: group.created_by,
      name: group.name,
      location: group.location,
      goal: group.goal,
      icon: group.icon,
      photo: group.photo || null,
      createdAt: group.created_at,
      updatedAt: group.updated_at,
      endDate: group.end_date,
    }));
  } catch (error) {
    console.error("Error getting following groups:", error);
    return [];
  }
}

// Get all groups for a user (created by or member of)
export async function getUserDuelGroupsDb(userId: string): Promise<DuelGroup[]> {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("duel_groups")
      .select(
        `
        *,
        duel_group_participants(user_id)
      `
      )
      .or(`created_by.eq.${userId},duel_group_participants.user_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (error || !data) return [];

    return data.map((group: any) => ({
      id: group.id,
      createdBy: group.created_by,
      name: group.name,
      location: group.location,
      goal: group.goal,
      icon: group.icon,
      photo: group.photo || null,
      createdAt: group.created_at,
      updatedAt: group.updated_at,
      endDate: group.end_date,
    }));
  } catch (error) {
    console.error("Error getting user groups:", error);
    return [];
  }
}

// Upload group cover photo and persist URL to DB
export async function updateGroupPhotoDb(groupId: string, file: File): Promise<string> {
  if (!supabase) throw new Error("Supabase not configured");
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `group-covers/${groupId}/cover.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("posts")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw uploadError;
  const { data: urlData } = supabase.storage.from("posts").getPublicUrl(path);
  const photoUrl = urlData.publicUrl;
  const { error: updateError } = await supabase
    .from("duel_groups")
    .update({ photo: photoUrl })
    .eq("id", groupId);
  if (updateError) throw updateError;
  return photoUrl;
}

// Add check-in to group
export async function addGroupCheckInDb(
  groupId: string,
  userId: string,
  userName: string,
  photo: string,
  description: string,
  workoutInfo: string,
  series: number = 0,
  volume: number = 0,
  muscleGroup: string | null = null,
  exercises: CompletedRoutineExercise[] = [],
  userPhoto: string | null = null,
): Promise<GroupCheckIn> {
  if (!supabase) throw new Error("Supabase not configured");

  try {
    const { data, error } = await supabase
      .from("duel_check_ins")
      .insert({
        group_id: groupId,
        user_id: userId,
        user_name: userName,
        user_photo: userPhoto,
        photo,
        description,
        workout_info: workoutInfo,
        series,
        volume,
        muscle_group: muscleGroup,
        exercises: JSON.stringify(exercises),
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error("Failed to create check-in");

    return {
      id: data.id,
      groupId: data.group_id,
      userId: data.user_id,
      userName: data.user_name,
      userPhoto: userPhoto,
      photo: data.photo || "",
      description: data.description || "",
      workoutInfo: data.workout_info || "",
      muscleGroup: data.muscle_group || null,
      exercises,
      series: data.series || 0,
      volume: data.volume || 0,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error("Error adding check-in:", error);
    throw error;
  }
}

// Get check-ins for a group (optimized: only columns needed for the list, no exercises payload)
export async function getGroupCheckInsDb(groupId: string): Promise<GroupCheckIn[]> {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("duel_check_ins")
      .select("id, group_id, user_id, user_name, user_photo, photo, description, workout_info, muscle_group, created_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !data) return [];

    return data.map((checkIn: any) => ({
      id: checkIn.id,
      groupId: checkIn.group_id,
      userId: checkIn.user_id,
      userName: checkIn.user_name,
      userPhoto: checkIn.user_photo || null,
      photo: checkIn.photo || "",
      description: checkIn.description || "",
      workoutInfo: checkIn.workout_info || "",
      muscleGroup: checkIn.muscle_group || null,
      exercises: [],
      series: 0,
      volume: 0,
      createdAt: checkIn.created_at,
    }));
  } catch (error) {
    console.error("Error getting check-ins:", error);
    return [];
  }
}

// Get full check-in detail (with exercises, description, series, volume and user photo)
export async function getGroupCheckInDetailDb(checkInId: string): Promise<GroupCheckIn | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("duel_check_ins")
      .select("*")
      .eq("id", checkInId)
      .single();

    if (error || !data) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("photo")
      .eq("user_id", data.user_id)
      .single();

    return {
      id: data.id,
      groupId: data.group_id,
      userId: data.user_id,
      userName: data.user_name,
      userPhoto: profile?.photo ?? null,
      photo: data.photo || "",
      description: data.description || "",
      workoutInfo: data.workout_info || "",
      muscleGroup: data.muscle_group || null,
      exercises: (() => {
        try { return JSON.parse(data.exercises || "[]"); } catch { return []; }
      })(),
      series: data.series || 0,
      volume: data.volume || 0,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error("Error getting check-in detail:", error);
    return null;
  }
}

// Update a check-in
export async function updateGroupCheckInDb(
  checkInId: string,
  workoutInfo: string,
  description: string
): Promise<GroupCheckIn> {
  if (!supabase) throw new Error("Supabase not configured");

  try {
    const { data, error } = await supabase
      .from("duel_check_ins")
      .update({
        workout_info: workoutInfo,
        description: description,
      })
      .eq("id", checkInId)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error("Failed to update check-in");

    return {
      id: data.id,
      groupId: data.group_id,
      userId: data.user_id,
      userName: data.user_name,
      userPhoto: null,
      photo: data.photo || "",
      description: data.description || "",
      workoutInfo: data.workout_info || "",
      muscleGroup: data.muscle_group || null,
      exercises: (() => { try { return JSON.parse(data.exercises || "[]"); } catch { return []; } })(),
      series: data.series || 0,
      volume: data.volume || 0,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error("Error updating check-in:", error);
    throw error;
  }
}

// Delete a check-in
export async function deleteGroupCheckInDb(checkInId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");

  try {
    const { error } = await supabase
      .from("duel_check_ins")
      .delete()
      .eq("id", checkInId);

    if (error) throw error;
  } catch (error) {
    console.error("Error deleting check-in:", error);
    throw error;
  }
}

// Add members to a duel group
export async function addMembersToGroupDb(
  groupId: string,
  memberIds: string[]
): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");

  const viewer = await getViewer();

  try {
    // Get existing participants
    const { data: existingParticipants, error: fetchError } = await supabase
      .from("duel_group_participants")
      .select("user_id")
      .eq("group_id", groupId);

    if (fetchError) throw fetchError;

    const existingUserIds = new Set(existingParticipants?.map((p: any) => p.user_id) || []);

    // Filter out members who are already in the group
    const newMembers = memberIds.filter((id) => !existingUserIds.has(id));

    if (newMembers.length === 0) return;

    // Add new members with pending status
    const { error: insertError } = await supabase
      .from("duel_group_participants")
      .insert(
        newMembers.map((userId) => ({
          group_id: groupId,
          user_id: userId,
          status: "pending",
        }))
      );

    if (insertError) throw insertError;

    // Send duel invite notification to each newly invited member
    const { error: notifError } = await supabase.from("notifications").insert(
      newMembers.map((userId) => ({
        user_id: userId,
        follower_id: viewer.id,
        type: 4,
        post_id: groupId,
        read: false,
      }))
    );
    if (notifError) {
      console.error("Error inserting duel invite notifications:", notifError);
    }
  } catch (error) {
    console.error("Error adding members to group:", error);
    throw error;
  }
}

// Leave a duel group (remove current user from participants)
export async function leaveGroupDb(groupId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");

  const viewer = await getViewer();
  if (!viewer) throw new Error("Usuário não autenticado");

  const { error } = await supabase
    .from("duel_group_participants")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", viewer.id);

  if (error) throw error;
}

// Get pending group invites for the current user
export async function getPendingInvitesDb(): Promise<Array<{ groupId: string; groupName: string; groupGoal: string; groupLocation: string }>> {
  if (!supabase) return [];
  const viewer = await getViewer();
  if (!viewer) return [];

  try {
    const { data, error } = await supabase
      .from("duel_group_participants")
      .select("group_id, status")
      .eq("user_id", viewer.id)
      .eq("status", "pending");

    if (error) {
      console.error("getPendingInvitesDb error (status column may not exist in DB):", error);
      return [];
    }
    if (!data || data.length === 0) return [];

    const groupIds = data.map((r: any) => r.group_id);
    const { data: groups, error: groupsError } = await supabase
      .from("duel_groups")
      .select("id, name, goal, location")
      .in("id", groupIds);

    if (groupsError) {
      console.error("getPendingInvitesDb groups error:", groupsError);
      return [];
    }
    if (!groups) return [];

    return groups.map((g: any) => ({
      groupId: String(g.id),
      groupName: String(g.name),
      groupGoal: String(g.goal || ""),
      groupLocation: String(g.location || ""),
    }));
  } catch (err) {
    console.error("Error fetching pending invites:", err);
    return [];
  }
}

// Accept a pending group invite
export async function acceptGroupInviteDb(groupId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const viewer = await getViewer();
  if (!viewer) throw new Error("Usuário não autenticado");

  const { error } = await supabase
    .from("duel_group_participants")
    .update({ status: "accepted" })
    .eq("group_id", groupId)
    .eq("user_id", viewer.id);

  if (error) throw error;
}

// Send a join-request notification to the group creator (type 5 = join request)
export async function sendGroupJoinRequestNotificationDb(groupId: string, creatorId: string): Promise<void> {
  if (!supabase) return;
  const viewer = await getViewer();
  if (!viewer) return;

  const { error } = await supabase.from("notifications").insert({
    user_id: creatorId,
    follower_id: viewer.id,
    type: 5,
    post_id: groupId,
    read: false,
  });
  if (error) {
    console.error("Error sending join request notification:", error);
  }
}

// Decline (delete) a pending group invite
export async function declineGroupInviteDb(groupId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const viewer = await getViewer();
  if (!viewer) throw new Error("Usuário não autenticado");

  const { error } = await supabase
    .from("duel_group_participants")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", viewer.id)
    .eq("status", "pending");

  if (error) throw error;
}

// Get all participants of a duel group with their user details
export async function getGroupParticipantsDb(
  groupId: string
): Promise<Array<{ userId: string; userNickname: string; userPhoto: string | null }>> {
  if (!supabase) return [];

  try {
    // Get accepted participants from duel_group_participants table, then get their user details
    const { data: participants, error: fetchError } = await supabase
      .from("duel_group_participants")
      .select("user_id")
      .eq("group_id", groupId)
      .or("status.eq.accepted,status.is.null");

    if (fetchError) {
      const errorMsg = fetchError?.message || JSON.stringify(fetchError);
      console.error("Error fetching participants:", errorMsg);
      throw fetchError;
    }

    if (!participants || participants.length === 0) return [];

    // Get user details for each participant
    const userIds = participants.map((p: any) => p.user_id);
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, nickname, photo")
      .in("user_id", userIds);

    if (profileError) {
      const errorMsg = profileError?.message || JSON.stringify(profileError);
      console.error("Error fetching user profiles:", errorMsg);
      throw profileError;
    }

    return (profiles || []).map((profile: any) => ({
      userId: profile.user_id,
      userNickname: profile.nickname || "Usuário",
      userPhoto: profile.photo || null,
    }));
  } catch (error: any) {
    const errorMsg = error?.message || JSON.stringify(error);
    console.error("Error getting group participants:", errorMsg);
    console.error("Full error details:", error);
    return [];
  }
}

// Delete a duel group
export async function deleteGroupDb(groupId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");

  const viewer = await getViewer();
  if (!viewer) throw new Error("Not authenticated");

  try {
    // Delete related rows first to avoid FK constraint violations
    await supabase.from("duel_check_ins").delete().eq("group_id", groupId);
    await supabase.from("duel_group_participants").delete().eq("group_id", groupId);

    const { error: deleteError } = await supabase
      .from("duel_groups")
      .delete()
      .eq("id", groupId)
      .eq("created_by", viewer.id);

    if (deleteError) throw deleteError;
  } catch (error) {
    console.error("Error deleting group:", error);
    throw error;
  }
}

// ─── Access Session Tracking ────────────────────────────────────────────────

export async function recordAccessSessionDb(userId: string, durationSeconds: number): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;
  try {
    await supabase.from("access_sessions").insert({
      user_id: userId,
      duration_seconds: durationSeconds,
      session_date: new Date().toISOString().split("T")[0],
    });
  } catch (err) {
    console.error("Error recording access session:", err);
  }
}

// ─── Delete Account ──────────────────────────────────────────────────────────

/**
 * Permanently deletes all data associated with a user across every table.
 * Order respects FK dependencies: dependent rows first, then parent rows.
 */
export async function deleteAllUserDataDb(userId: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) throw new Error("Supabase não configurado");
  assertUUID(userId, "ID do usuário");

  // Helper: delete from a table by a column filter, ignoring "no rows" errors
  const del = async (table: string, column: string, value: string) => {
    const { error } = await (supabase as any).from(table).delete().eq(column, value);
    if (error) console.error(`[deleteAllUserDataDb] ${table}.${column}:`, error.message);
  };

  // ── Batch 1: leaf tables with no children ───────────────────────────────
  await Promise.all([
    del("access_sessions", "user_id", userId),
    del("check_ins", "user_id", userId),
    del("flow_complaint", "user_id", userId),
    del("flow_user_viewed", "user_id", userId),
    del("flow_user_viewed", "follower_id", userId),
    del("post_complaint", "user_id", userId),
    del("shots_complaint", "user_id", userId),
    del("user_complaint", "user_id", userId),
    del("user_complaint", "follower_id", userId),
    del("ranking", "user_id", userId),
    del("user_goals", "user_id", userId),
    del("user_habits_hist", "user_id", userId),
    del("user_diets_hist", "user_id", userId),
    del("user_workouts_hist", "user_id", userId),
    del("duel_check_ins", "user_id", userId),
    del("duel_group_participants", "user_id", userId),
  ]);

  // ── Batch 2: comments, likes and notifications (depend on posts/shots/flow) ─
  await Promise.all([
    del("comments", "user_id", userId),
    del("likes", "user_id", userId),
    del("flow_comments", "user_id", userId),
    del("flow_likes", "user_id", userId),
    del("shots_comments", "user_id", userId),
    del("shots_likes", "user_id", userId),
    del("notifications", "user_id", userId),
    del("notifications", "follower_id", userId),
    del("messages", "id_user", userId),
    del("messages", "id_following", userId),
  ]);

  // ── Batch 3: follow graph ─────────────────────────────────────────────────
  await Promise.all([
    del("following", "user_id", userId),
    del("following", "following_id", userId),
    del("followers", "user_id", userId),
    del("followers", "follower_id", userId),
  ]);

  // ── Batch 4: content owned by user ───────────────────────────────────────
  await Promise.all([
    del("routines", "user_id", userId),
    del("user_workouts", "user_id", userId),
    del("user_diets", "user_id", userId),
    del("user_habits", "user_id", userId),
    del("posts", "user_id", userId),
    del("shots", "user_id", userId),
    del("flow", "user_id", userId),
    del("duel_groups", "created_by", userId),
    del("commercial_profiles", "user_id", userId),
  ]);

  // ── Batch 5: profile (last — other tables may reference it) ──────────────
  await del("profiles", "user_id", userId);
}

// ─── Conversations ───────────────────────────────────────────────────────────

/** Delete all messages in a conversation between the current user and another user */
export async function deleteConversationDb(otherUserId: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) throw new Error("Supabase não configurado");
  assertUUID(otherUserId, "ID do usuário");

  const viewer = await getViewer();
  if (!viewer) throw new Error("Não autenticado");

  const { error } = await supabase
    .from("messages")
    .delete()
    .or(
      `and(id_user.eq.${viewer.id},id_following.eq.${otherUserId}),and(id_user.eq.${otherUserId},id_following.eq.${viewer.id})`
    );

  if (error) throw error;
}

// ─── Group Join Requests (owner view) ────────────────────────────────────────

export type GroupJoinRequest = {
  groupId: string;
  groupName: string;
  userId: string;
  userNickname: string;
  userPhoto: string | null;
  participants: number;
};

/** Returns all pending join requests for groups owned by the current user */
export async function getPendingGroupRequestsDb(): Promise<GroupJoinRequest[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const viewer = await getViewer();
  if (!viewer) return [];

  try {
    // Get my groups
    const { data: myGroups, error: groupsError } = await supabase
      .from("duel_groups")
      .select("id, name")
      .eq("created_by", viewer.id);

    if (groupsError || !myGroups || myGroups.length === 0) return [];

    const myGroupIds = myGroups.map((g: any) => g.id);

    // Get pending participants for those groups + accepted count
    const [pendingResult, countResult] = await Promise.all([
      supabase
        .from("duel_group_participants")
        .select("group_id, user_id")
        .in("group_id", myGroupIds)
        .eq("status", "pending"),
      supabase
        .from("duel_group_participants")
        .select("group_id, user_id, status")
        .in("group_id", myGroupIds),
    ]);

    const pendingRows = pendingResult.data ?? [];
    if (pendingRows.length === 0) return [];

    // Build accepted count map
    const countMap: Record<string, number> = {};
    for (const p of countResult.data ?? []) {
      if (!p.status || p.status === "accepted") {
        countMap[p.group_id] = (countMap[p.group_id] ?? 0) + 1;
      }
    }

    // Fetch profiles for pending users
    const userIds = [...new Set(pendingRows.map((p: any) => p.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nickname, photo")
      .in("user_id", userIds);

    const profileMap: Record<string, { nickname: string; photo: string | null }> = {};
    for (const p of profiles ?? []) {
      profileMap[p.user_id] = { nickname: p.nickname || "Usuário", photo: p.photo || null };
    }

    const groupNameMap: Record<string, string> = {};
    for (const g of myGroups) groupNameMap[g.id] = g.name;

    return pendingRows.map((p: any) => ({
      groupId: p.group_id,
      groupName: groupNameMap[p.group_id] || "Grupo",
      userId: p.user_id,
      userNickname: profileMap[p.user_id]?.nickname || "Usuário",
      userPhoto: profileMap[p.user_id]?.photo || null,
      participants: countMap[p.group_id] ?? 1,
    }));
  } catch (err) {
    console.error("Error getting pending group requests:", err);
    return [];
  }
}

/** Approve a pending group join request */
export async function approveGroupRequestDb(groupId: string, requestUserId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase
    .from("duel_group_participants")
    .update({ status: "accepted" })
    .eq("group_id", groupId)
    .eq("user_id", requestUserId)
    .eq("status", "pending");
  if (error) throw error;
}

/** Reject a pending group join request */
export async function rejectGroupRequestDb(groupId: string, requestUserId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase
    .from("duel_group_participants")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", requestUserId)
    .eq("status", "pending");
  if (error) throw error;
}

/** Remove an accepted member from a group (owner action) */
export async function removeGroupMemberDb(groupId: string, memberUserId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase não configurado");
  const viewer = await getViewer();
  if (!viewer) throw new Error("Não autenticado");

  // Verify caller is the group owner
  const { data: group, error: groupError } = await supabase
    .from("duel_groups")
    .select("created_by")
    .eq("id", groupId)
    .single();

  if (groupError || !group) throw new Error("Grupo não encontrado");
  if (group.created_by !== viewer.id) throw new Error("Apenas o dono pode remover participantes");

  const { error } = await supabase
    .from("duel_group_participants")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", memberUserId);

  if (error) throw error;
}

// ─── Check-in Comments ───────────────────────────────────────────────────────

export type CheckInComment = {
  id: string;
  checkInId: string;
  userId: string;
  userNickname: string;
  userPhoto: string | null;
  text: string;
  createdAt: string;
};

export async function getCheckInCommentsDb(checkInId: string): Promise<CheckInComment[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  assertUUID(checkInId, "ID do check-in");

  try {
    const { data, error } = await supabase
      .from("duel_check_in_comments")
      .select("id, check_in_id, user_id, text, created_at")
      .eq("check_in_id", checkInId)
      .order("created_at", { ascending: true });

    if (error) { console.error("Error fetching check-in comments:", error); return []; }
    if (!data || data.length === 0) return [];

    const userIds = [...new Set(data.map((c: any) => c.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nickname, photo")
      .in("user_id", userIds);

    const profileMap: Record<string, { nickname: string; photo: string | null }> = {};
    for (const p of profiles ?? []) {
      profileMap[p.user_id] = { nickname: p.nickname || "Usuário", photo: p.photo || null };
    }

    return data.map((c: any) => ({
      id: c.id,
      checkInId: c.check_in_id,
      userId: c.user_id,
      userNickname: profileMap[c.user_id]?.nickname || "Usuário",
      userPhoto: profileMap[c.user_id]?.photo || null,
      text: c.text,
      createdAt: c.created_at,
    }));
  } catch (err) {
    console.error("Error fetching check-in comments:", err);
    return [];
  }
}

// ─── Check-in Emoji Reactions ─────────────────────────────────────────────────

export type CheckInReaction = {
  checkInId: string;
  userId: string;
  emoji: string;
};

export async function getCheckInReactionsDb(checkInIds: string[]): Promise<Record<string, CheckInReaction[]>> {
  if (!hasSupabaseConfig || !supabase || checkInIds.length === 0) return {};

  try {
    const { data } = await supabase
      .from("duel_check_in_reactions")
      .select("check_in_id, user_id, emoji")
      .in("check_in_id", checkInIds);

    const result: Record<string, CheckInReaction[]> = {};
    for (const r of data ?? []) {
      if (!result[r.check_in_id]) result[r.check_in_id] = [];
      result[r.check_in_id].push({ checkInId: r.check_in_id, userId: r.user_id, emoji: r.emoji });
    }
    return result;
  } catch {
    return {};
  }
}

export async function setCheckInReactionDb(checkInId: string, emoji: string | null): Promise<void> {
  if (!supabase) return;
  const viewer = await getViewer();
  if (!viewer) return;

  if (emoji === null) {
    await supabase
      .from("duel_check_in_reactions")
      .delete()
      .eq("check_in_id", checkInId)
      .eq("user_id", viewer.id);
  } else {
    await supabase
      .from("duel_check_in_reactions")
      .upsert({ check_in_id: checkInId, user_id: viewer.id, emoji }, { onConflict: "check_in_id,user_id" });
  }
}

export async function addCheckInCommentDb(checkInId: string, text: string): Promise<CheckInComment> {
  if (!supabase) throw new Error("Supabase não configurado");
  assertUUID(checkInId, "ID do check-in");
  assertNotEmpty(text, "Comentário");
  assertMaxLength(text.trim(), 500, "Comentário");

  const viewer = await getViewer();
  if (!viewer) throw new Error("Não autenticado");

  const { data, error } = await supabase
    .from("duel_check_in_comments")
    .insert({ check_in_id: checkInId, user_id: viewer.id, text: text.trim() })
    .select("id, check_in_id, user_id, text, created_at")
    .single();

  if (error) throw error;

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname, photo")
    .eq("user_id", viewer.id)
    .maybeSingle();

  return {
    id: data.id,
    checkInId: data.check_in_id,
    userId: data.user_id,
    userNickname: profile?.nickname || "Usuário",
    userPhoto: profile?.photo || null,
    text: data.text,
    createdAt: data.created_at,
  };
}

// ─── Access Sessions ────────────────────────────────────────────────────────

export async function getAccessSessionsDb(userId: string, days: number = 30): Promise<{ session_date: string; duration_seconds: number; created_at: string }[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const { data, error } = await supabase
      .from("access_sessions")
      .select("session_date, duration_seconds, created_at")
      .eq("user_id", userId)
      .gte("session_date", since.toISOString().split("T")[0])
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.error("Error fetching access sessions:", err);
    return [];
  }
}

// ============================================================
// Badge / Insígnia Functions
// ============================================================

export type Badge = {
  id: string;
  key: string;
  name: string;
  emoji: string;
  description: string;
  required_checkins: number;
  sort_order: number;
};

export type UserBadge = {
  badge_id: string;
  earned_at: string;
  badge: Badge;
};

/** Retorna o total de check-ins acumulados de um usuário (todos os tempos) */
export async function getTotalCheckInsDb(userId: string): Promise<number> {
  if (!hasSupabaseConfig || !supabase) return 0;
  try {
    const { count, error } = await supabase
      .from("check_ins")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (error) throw error;
    return count ?? 0;
  } catch (err) {
    console.error("Error fetching total check-ins:", err);
    return 0;
  }
}

/** Retorna todos os badges do catálogo ordenados por sort_order */
export async function getAllBadgesDb(): Promise<Badge[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  try {
    const { data, error } = await supabase
      .from("badges")
      .select("id, key, name, emoji, description, required_checkins, sort_order")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Badge[];
  } catch (err) {
    console.error("Error fetching badges:", err);
    return [];
  }
}

/** Retorna as insígnias conquistadas por um usuário */
export async function getUserBadgesDb(userId: string): Promise<UserBadge[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  try {
    const { data, error } = await supabase
      .from("user_badges")
      .select("badge_id, earned_at, badges(id, key, name, emoji, description, required_checkins, sort_order)")
      .eq("user_id", userId)
      .order("earned_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      badge_id: String(row.badge_id),
      earned_at: String(row.earned_at),
      badge: row.badges as Badge,
    }));
  } catch (err) {
    console.error("Error fetching user badges:", err);
    return [];
  }
}

/**
 * Avalia o total de check-ins acumulados do usuário e concede os badges
 * que ele ainda não possui mas já merece.
 *
 * Regra: baseado em check-ins TOTAIS (todos os tempos), não só da semana.
 * - 1 check-in total  → Iniciante ⭐
 * - 3 check-ins total → Sequência 🔥
 * - 5 check-ins total → Campeão 💪
 * - 7 check-ins total → Lendário 👑
 *
 * Deve ser chamado após cada check-in.
 */
export async function awardBadgesForCheckInsDb(userId: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;
  try {
    // Busca total de check-ins acumulados (contagem de todas as datas únicas)
    const { count, error: countError } = await supabase
      .from("check_ins")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (countError) throw countError;

    const totalCheckIns = count ?? 0;

    const [allBadges, existingRows] = await Promise.all([
      getAllBadgesDb(),
      supabase.from("user_badges").select("badge_id").eq("user_id", userId),
    ]);

    const alreadyEarned = new Set(
      (existingRows.data ?? []).map((r: any) => String(r.badge_id))
    );

    // Insere apenas badges que o usuário ainda não tem mas já merece
    const toInsert = allBadges
      .filter((b) => totalCheckIns >= b.required_checkins && !alreadyEarned.has(b.id))
      .map((b) => ({ user_id: userId, badge_id: b.id }));

    if (toInsert.length === 0) return;

    const { error } = await supabase
      .from("user_badges")
      .insert(toInsert);

    if (error && error.code !== "23505") {
      // 23505 = unique violation (corrida entre requisições, seguro ignorar)
      console.error("Error awarding badges:", error);
    }
  } catch (err) {
    console.error("Error in awardBadgesForCheckInsDb:", err);
  }
}

/**
 * Retorna o badge mais alto que o usuário possui (maior sort_order).
 * Usado para exibição no feed e perfil.
 *
 * Nota: o Supabase JS v2 não suporta order por coluna de tabela relacionada,
 * então buscamos todos e filtramos no cliente.
 */
export async function getTopUserBadgeDb(userId: string): Promise<Badge | null> {
  if (!hasSupabaseConfig || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from("user_badges")
      .select("badges(id, key, name, emoji, description, required_checkins, sort_order)")
      .eq("user_id", userId);
    if (error) throw error;
    if (!data || data.length === 0) return null;

    // Pega o badge com maior sort_order (mais alto nível)
    const top = data.reduce((best: any, row: any) => {
      const b = row.badges as Badge;
      if (!best) return b;
      return (b?.sort_order ?? 0) > (best?.sort_order ?? 0) ? b : best;
    }, null);

    return top ?? null;
  } catch (err) {
    console.error("Error fetching top user badge:", err);
    return null;
  }
}
