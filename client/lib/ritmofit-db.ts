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
        nickname : nickname,
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
  const userName = profile?.nickname ?? "Você";
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

  return (data ?? []).map(
    (row: any) =>
      ({
        id: String(row.id),
        description: String(row.description ?? ""),
        duration: Number(row.duration ?? 0),
        quantity: Number(row.quantity ?? 0),
        type: Number(row.type ?? ""),
      }) satisfies ProgrammedGoal,
  );
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
}

export type UserGoal = {
  id: string;
  goal_id: string;
  description: string;
  duration: number;
  quantity: number;
  type_goal: number;
  perc: number;
};

export async function getGoalByIdDb(goalId: string): Promise<UserGoal | null> {
  if (!hasSupabaseConfig || !supabase) return null;

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
  };
}

export async function getUserGoalsByUserIdDb(
  userId: string,
): Promise<UserGoal[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const { data, error } = await supabase
    .from("user_goals")
    .select("id, goal_id, duration, quantity, type_goal, perc")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error fetching user goals [${errorCode}]:`, errorMsg);
    return [];
  }

  const userGoalsData = data ?? [];

  // Fetch goal descriptions for all goal_ids
  const goalIds = userGoalsData.map((row) => row.goal_id);
  const goalsDescriptions: Map<string, string> = new Map();

  if (goalIds.length > 0) {
    const { data: goalsData, error: goalsError } = await supabase
      .from("goals")
      .select("id, description")
      .in("id", goalIds);

    if (!goalsError && goalsData) {
      goalsData.forEach((goal: any) => {
        goalsDescriptions.set(String(goal.id), String(goal.description ?? ""));
      });
    }
  }

  return userGoalsData.map(
    (row: any) =>
      ({
        id: String(row.id),
        goal_id: String(row.goal_id ?? ""),
        description: goalsDescriptions.get(String(row.goal_id)) ?? "",
        duration: Number(row.duration ?? 0),
        quantity: Number(row.quantity ?? 0),
        type_goal: Number(row.type_goal ?? 0),
        perc: Number(row.perc ?? 0),
      }) satisfies UserGoal,
  );
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

  const { data, error } = await supabase
    .from("user_goals")
    .select("id, goal_id, duration, quantity, type_goal, perc")
    .eq("id", userGoalId)
    .maybeSingle();

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error fetching user goal [${errorCode}]:`, errorMsg);
    return null;
  }

  if (!data) return null;

  // Fetch goal description
  const { data: goalData } = await supabase
    .from("goals")
    .select("description")
    .eq("id", data.goal_id)
    .maybeSingle();

  return {
    id: String(data.id),
    goal_id: String(data.goal_id ?? ""),
    description: String(goalData?.description ?? ""),
    duration: Number(data.duration ?? 0),
    quantity: Number(data.quantity ?? 0),
    type_goal: Number(data.type_goal ?? 0),
    perc: Number(data.perc ?? 0),
  };
}

export async function incrementGoalProgressDb(
  userGoalId: string,
): Promise<UserGoal | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const viewer = await getViewer();
  if (!viewer) return null;

  // Get current perc value
  const { data: currentData, error: fetchError } = await supabase
    .from("user_goals")
    .select("perc")
    .eq("id", userGoalId)
    .maybeSingle();

  if (fetchError || !currentData) {
    const errorMsg = fetchError?.message || "Unknown error";
    const errorCode = fetchError?.code || "UNKNOWN";
    console.error(`Error fetching goal progress [${errorCode}]:`, errorMsg);
    return null;
  }

  const currentPerc = Number(currentData.perc ?? 0);
  const newPerc = Math.min(currentPerc + 1, 100); // Cap at 100

  const { data, error } = await supabase
    .from("user_goals")
    .update({ perc: newPerc })
    .eq("id", userGoalId)
    .eq("user_id", viewer.id)
    .select("id, goal_id, duration, quantity, type_goal, perc")
    .maybeSingle();

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error updating goal progress [${errorCode}]:`, errorMsg);
    throw new Error(`Erro ao atualizar progresso: ${errorMsg}`);
  }

  if (!data) return null;

  return {
    id: String(data.id),
    goal_id: String(data.goal_id ?? ""),
    description: "", // Will be fetched separately if needed
    duration: Number(data.duration ?? 0),
    quantity: Number(data.quantity ?? 0),
    type_goal: Number(data.type_goal ?? 0),
    perc: Number(data.perc ?? 0),
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
};

export async function getUserProfileDb(
  userId: string,
): Promise<UserProfile | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, nickname, bio, photo")
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
  created_at: string;
  user_id: string;
  userNickname: string;
  userPhoto: string | null;
};

export async function getUserPostsDb(userId: string): Promise<PostWithUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const { data, error } = await supabase
    .from("posts")
    .select("id, description, photo, created_at, user_id")
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
    created_at: String(row.created_at ?? ""),
    user_id: String(row.user_id ?? ""),
    userNickname,
    userPhoto,
  }));
}

export type UserStats = {
  postsCount: number;
  followersCount: number;
  followingCount: number;
};

export async function getWorkoutsDb(): Promise<Workout[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const { data, error } = await supabase
    .from("workouts")
    .select("id, name, description, photo")
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
  }));
}

export async function getUserStatsDb(userId: string): Promise<UserStats> {
  if (!hasSupabaseConfig || !supabase) {
    return { postsCount: 0, followersCount: 0, followingCount: 0 };
  }

  let postsRes: any = { count: 0, error: null };
  let followersRes: any = { count: 0, error: null };
  let followingRes: any = { count: 0, error: null };

  try {
    postsRes = await supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
  } catch (err) {
    postsRes = { count: 0, error: err };
  }

  try {
    followersRes = await supabase
      .from("following")
      .select("id", { count: "exact", head: true })
      .eq("following_id", userId);
  } catch (err) {
    followersRes = { count: 0, error: err };
  }

  try {
    followingRes = await supabase
      .from("following")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
  } catch (err) {
    followingRes = { count: 0, error: err };
  }

  if (postsRes.error) {
    const errorMsg =
      postsRes.error instanceof Error
        ? postsRes.error.message
        : postsRes.error?.message || postsRes.error?.details || "Unknown error";
    const errorCode = postsRes.error?.code || "UNKNOWN";
    console.error(`Error fetching posts stats [${errorCode}]:`, errorMsg);
  }

  // Silently handle follower/following table errors - these tables may not exist yet
  // Return 0 counts instead of logging errors

  return {
    postsCount: postsRes.count ?? 0,
    followersCount: followersRes.count ?? 0,
    followingCount: followingRes.count ?? 0,
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
  program_id: string | null;
  goal_id: string | null;
};

export type Workout = {
  id: string;
  name: string;
  description: string;
  photo: string | null;
};

export type Diet = {
  id: string;
  name: string;
  description: string;
  photo: string | null;
  calories: number;
};

export async function getDietsDb(): Promise<Diet[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const { data, error } = await supabase
    .from("diets")
    .select("id, name, description, photo, calories")
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
    photo: row.photo ? String(row.photo) : null,
    calories: Number(row.calories ?? 0),
  }));
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
    .select("id, user_id, type, program_id, goal_id")
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
    program_id: row.program_id ? String(row.program_id) : null,
    goal_id: row.goal_id ? String(row.goal_id) : null,
  }));
}

export async function createRoutineDb(
  userId: string,
  type: RoutineTypeCode,
  program_id?: string,
): Promise<Routine | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const { data, error } = await supabase
    .from("routines")
    .insert({
      user_id: userId,
      type,
      program_id: program_id || null,
    })
    .select("id, user_id, type, program_id, goal_id")
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
    program_id: data.program_id ? String(data.program_id) : null,
    goal_id: data.goal_id ? String(data.goal_id) : null,
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
    .select("id, user_id, type, program_id, goal_id")
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
    program_id: data.program_id ? String(data.program_id) : null,
    goal_id: data.goal_id ? String(data.goal_id) : null,
  };
}

export async function getRoutinesByGoalIdDb(
  goalId: string,
): Promise<Routine[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const { data, error } = await supabase
    .from("routines")
    .select("id, user_id, type, program_id, goal_id")
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
    program_id: row.program_id ? String(row.program_id) : null,
    goal_id: row.goal_id ? String(row.goal_id) : null,
  }));
}

export type UserWorkout = {
  id: string;
  workout_id: string;
  user_id: string;
  volume?: number | null;
  calories?: number | null;
  duration?: number | null;
  series?: number | null;
  time_rest?: number | null;
};

export async function createUserWorkoutsDb(
  userId: string,
  workoutIds: string[],
  options?: {
    volume?: number;
    calories?: number;
    duration?: number;
    series?: number;
    time_rest?: number;
  },
): Promise<UserWorkout[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const workoutsToInsert = workoutIds.map((workoutId) => ({
    workout_id: workoutId,
    user_id: userId,
    volume: options?.volume || null,
    calories: options?.calories || null,
    duration: options?.duration || null,
    series: options?.series || null,
    time_rest: options?.time_rest || null,
  }));

  const { data, error } = await supabase
    .from("user_workouts")
    .insert(workoutsToInsert)
    .select(
      "id, workout_id, user_id, volume, calories, duration, series, time_rest",
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
    volume: row.volume,
    calories: row.calories,
    duration: row.duration,
    series: row.series,
    time_rest: row.time_rest,
  }));
}

export type UserWorkoutWithDetails = {
  id: string;
  workout_id: string;
  user_id: string;
  volume?: number | null;
  calories?: number | null;
  duration?: number | null;
  series?: number | null;
  time_rest?: number | null;
  workoutName?: string;
  workoutPhoto?: string | null;
  workoutDescription?: string;
};

export async function getUserWorkoutsDb(
  userId: string,
): Promise<UserWorkoutWithDetails[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const { data, error } = await supabase
    .from("user_workouts")
    .select(
      "id, workout_id, user_id, volume, calories, duration, series, time_rest, workouts(name, photo, description)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    const errorDetails = error?.details || error?.message || "";

    // Silently handle relationship errors - try without join and fetch workouts separately
    if (errorDetails.includes("relationship")) {
      const { data: dataFallback, error: errorFallback } = await supabase
        .from("user_workouts")
        .select(
          "id, workout_id, user_id, volume, calories, duration, series, time_rest",
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
            .select("id, name, photo, description")
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
            volume: row.volume,
            calories: row.calories,
            duration: row.duration,
            series: row.series,
            time_rest: row.time_rest,
            workoutName: workoutDetails?.name || "Exercício desconhecido",
            workoutPhoto: workoutDetails?.photo || null,
            workoutDescription: workoutDetails?.description || undefined,
          };
        });
      }
    }

    console.error(`Error fetching user workouts [${errorCode}]:`, errorMsg);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id ?? ""),
    workout_id: String(row.workout_id ?? ""),
    user_id: String(row.user_id ?? ""),
    volume: row.volume,
    calories: row.calories,
    duration: row.duration,
    series: row.series,
    time_rest: row.time_rest,
    workoutName: (row.workouts as any)?.name || "Exercício desconhecido",
    workoutPhoto: (row.workouts as any)?.photo || null,
    workoutDescription: (row.workouts as any)?.description || undefined,
  }));
}

export type UserDiet = {
  id: string;
  diet_id: string;
  user_id: string;
  quantity?: number | null;
  calories?: number | null;
};

export async function createUserDietsDb(
  userId: string,
  dietIds: string[],
  options?: {
    quantity?: number;
    calories?: number;
  },
): Promise<UserDiet[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const dietsToInsert = dietIds.map((dietId) => ({
    diet_id: dietId,
    user_id: userId,
    quantity: options?.quantity || null,
    calories: options?.calories || null,
  }));

  const { data, error } = await supabase
    .from("user_diets")
    .insert(dietsToInsert)
    .select("id, diet_id, user_id, quantity, calories");

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
    quantity: row.quantity,
    calories: row.calories,
  }));
}

export type UserDietWithDetails = {
  id: string;
  diet_id: string;
  user_id: string;
  quantity?: number | null;
  calories?: number | null;
  dietName?: string;
  dietPhoto?: string | null;
  dietDescription?: string;
  dietCalories?: number;
};

export async function getUserDietsDb(
  userId: string,
): Promise<UserDietWithDetails[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const { data, error } = await supabase
    .from("user_diets")
    .select(
      "id, diet_id, user_id, quantity, calories, diets(name, photo, description, calories)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    const errorDetails = error?.details || error?.message || "";

    // Silently handle relationship errors - try without join and fetch diets separately
    if (errorDetails.includes("relationship")) {
      const { data: dataFallback, error: errorFallback } = await supabase
        .from("user_diets")
        .select("id, diet_id, user_id, quantity, calories")
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
            .select("id, name, photo, description, calories")
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
            quantity: row.quantity,
            calories: row.calories,
            dietName: dietDetails?.name || "Dieta desconhecida",
            dietPhoto: dietDetails?.photo || null,
            dietDescription: dietDetails?.description || undefined,
            dietCalories: dietDetails?.calories || 0,
          };
        });
      }
    }

    console.error(`Error fetching user diets [${errorCode}]:`, errorMsg);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id ?? ""),
    diet_id: String(row.diet_id ?? ""),
    user_id: String(row.user_id ?? ""),
    quantity: row.quantity,
    calories: row.calories,
    dietName: (row.diets as any)?.name || "Dieta desconhecida",
    dietPhoto: (row.diets as any)?.photo || null,
    dietDescription: (row.diets as any)?.description || undefined,
    dietCalories: (row.diets as any)?.calories || 0,
  }));
}

export type UserHabit = {
  id: string;
  habit_id: string;
  user_id: string;
};

export async function createUserHabitsDb(
  userId: string,
  habitIds: string[],
): Promise<UserHabit[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const habitsToInsert = habitIds.map((habitId) => ({
    habit_id: habitId,
    user_id: userId,
  }));

  const { data, error } = await supabase
    .from("user_habits")
    .insert(habitsToInsert)
    .select("id, habit_id, user_id");

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
  }));
}

export type UserHabitWithDetails = {
  id: string;
  habit_id: string;
  user_id: string;
  habitName?: string;
  habitPhoto?: string | null;
  habitDescription?: string;
};

export async function getUserHabitsDb(
  userId: string,
): Promise<UserHabitWithDetails[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const { data, error } = await supabase
    .from("user_habits")
    .select(
      "id, habit_id, user_id, habits(name, photo, description)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    const errorDetails = error?.details || error?.message || "";

    // Silently handle relationship errors - try without join and fetch habits separately
    if (errorDetails.includes("relationship")) {
      const { data: dataFallback, error: errorFallback } = await supabase
        .from("user_habits")
        .select("id, habit_id, user_id")
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
            habitName: habitDetails?.name || "Hábito desconhecido",
            habitPhoto: habitDetails?.photo || null,
            habitDescription: habitDetails?.description || undefined,
          };
        });
      }
    }

    console.error(`Error fetching user habits [${errorCode}]:`, errorMsg);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id ?? ""),
    habit_id: String(row.habit_id ?? ""),
    user_id: String(row.user_id ?? ""),
    habitName: (row.habits as any)?.name || "Hábito desconhecido",
    habitPhoto: (row.habits as any)?.photo || null,
    habitDescription: (row.habits as any)?.description || undefined,
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
        const workoutIds = [...new Set(dataFallback.map((w: any) => w.workout_id))];
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
            const workoutName = workoutDetailsMap[String(row.workout_id)]?.name || "";
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
  dietCalories?: number;
};

export async function searchUserDietsDb(query: string): Promise<SearchDiet[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  if (!query.trim()) return [];

  const searchQuery = `%${query.toLowerCase()}%`;

  const { data, error } = await supabase
    .from("user_diets")
    .select(
      "id, user_id, diet_id, diets(id, name, description, photo, calories), profiles(nickname, photo)",
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
            .select("id, name, description, photo, calories")
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
              dietCalories: Number(diet?.calories ?? 0),
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
    dietCalories: Number((row.diets as any)?.calories ?? 0),
  }));
}

// Following Functions

export async function getAllUsersDb(excludeUserId?: string): Promise<SearchUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, nickname, bio, photo")
      .order("nickname", { ascending: true });

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
