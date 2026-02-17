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

    // Award 1 point for interacting with a post
    await addPointsDb(1);
  }
}

export async function getPostLikesDb(postId: string): Promise<PostLikeStats> {
  if (!hasSupabaseConfig || !supabase) {
    return { apoio: 0, continua: 0, ganhador: 0, consegueMais: 0, limiteMaior: 0, maisAlgum: 0 };
  }

  const { data } = await supabase
    .from("likes")
    .select("type")
    .eq("post_id", postId);

  const stats: PostLikeStats = { apoio: 0, continua: 0, ganhador: 0, consegueMais: 0, limiteMaior: 0, maisAlgum: 0 };

  (data ?? []).forEach((row: any) => {
    const incentiveType = Number(row.type) as PostIncentiveType;
    if (incentiveType === 1) stats.apoio += 1;
    else if (incentiveType === 2) stats.continua += 1;
    else if (incentiveType === 3) stats.ganhador += 1;
    else if (incentiveType === 4) stats.consegueMais += 1;
    else if (incentiveType === 5) stats.limiteMaior += 1;
    else if (incentiveType === 6) stats.maisAlgum += 1;
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
      [1, 2, 3, 4, 5, 6].includes(incentiveType),
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

  // Award 1 point for commenting on a post
  await addPointsDb(1);
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

  // Award 5 points for selecting a new goal
  await addPointsDb(5);
}

export async function updateUserGoalDb(
  userGoalId: string,
  duration: number,
  quantity: number,
) {
  if (!hasSupabaseConfig || !supabase) return;

  const { error } = await supabase
    .from("user_goals")
    .update({
      duration,
      quantity,
    })
    .eq("id", userGoalId);

  if (error) {
    console.error("Error updating user goal:", error);
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

  // Get current perc value and duration
  const { data: currentData, error: fetchError } = await supabase
    .from("user_goals")
    .select("perc, duration")
    .eq("id", userGoalId)
    .maybeSingle();

  if (fetchError || !currentData) {
    const errorMsg = fetchError?.message || "Unknown error";
    const errorCode = fetchError?.code || "UNKNOWN";
    console.error(`Error fetching goal progress [${errorCode}]:`, errorMsg);
    return null;
  }

  const currentPerc = Number(currentData.perc ?? 0);
  const duration = Number(currentData.duration ?? 1);
  // Calculate increment based on duration: 100% / duration days
  const increment = duration > 0 ? 100 / duration : 1;
  const newPerc = Math.min(currentPerc + increment, 100); // Cap at 100

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

  // Award 1 point for updating a goal
  await addPointsDb(1);

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
  reps?: number | null;
  calories?: number | null;
  duration?: number | null;
  time_rest?: number | null;
};

export async function createUserWorkoutsDb(
  userId: string,
  workoutIds: string[],
  options?: {
    volume?: number;
    reps?: number;
    calories?: number;
    duration?: number;
    time_rest?: number;
  },
): Promise<UserWorkout[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const workoutsToInsert = workoutIds.map((workoutId) => ({
    workout_id: workoutId,
    user_id: userId,
    volume: options?.volume || null,
    reps: options?.reps || null,
    calories: options?.calories || null,
    duration: options?.duration || null,
    time_rest: options?.time_rest || null,
  }));

  const { data, error } = await supabase
    .from("user_workouts")
    .insert(workoutsToInsert)
    .select(
      "id, workout_id, user_id, volume, reps, calories, duration, time_rest",
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
    reps: row.reps,
    calories: row.calories,
    duration: row.duration,
    time_rest: row.time_rest,
  }));
}

export type UserWorkoutWithDetails = {
  id: string;
  workout_id: string;
  user_id: string;
  volume?: number | null;
  reps?: number | null;
  calories?: number | null;
  duration?: number | null;
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
      "id, workout_id, user_id, volume, reps, calories, duration, time_rest, workouts(name, photo, description)",
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
          "id, workout_id, user_id, volume, reps, calories, duration, time_rest",
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
            reps: row.reps,
            calories: row.calories,
            duration: row.duration,
            time_rest: row.time_rest,
            workoutName: workoutDetails?.name || "Exercício desconhecido",
            workoutPhoto: workoutDetails?.photo || null,
            workoutDescription: workoutDetails?.description || undefined,
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
    volume: row.volume,
    reps: row.reps,
    calories: row.calories,
    duration: row.duration,
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
      } else if (errorFallback) {
        const fallbackMsg = errorFallback?.message || String(errorFallback);
        const fallbackCode = errorFallback?.code || "UNKNOWN";
        console.error(
          `[getUserDietsDb] Fallback also failed [${fallbackCode}]:`,
          fallbackMsg,
        );
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
    .select("id, habit_id, user_id, habits(name, photo, description)")
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
      } else if (errorFallback) {
        const fallbackMsg = errorFallback?.message || String(errorFallback);
        const fallbackCode = errorFallback?.code || "UNKNOWN";
        console.error(
          `[getUserHabitsDb] Fallback also failed [${fallbackCode}]:`,
          fallbackMsg,
        );
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

export async function getAllUsersDb(
  excludeUserId?: string,
): Promise<SearchUser[]> {
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
      .from("storys")
      .select("*")
      .in("user_id", userIdsToShow)
      .gte("created_at", twentyFourHoursAgo)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching stories:", error);
      return [];
    }

    // Enrich stories with user info
    const enrichedStories = await Promise.all(
      (data ?? []).map(async (story: Story) => {
        const userProfile = await getUserProfileDb(story.user_id);
        return {
          ...story,
          userNickname: userProfile?.nickname || "Usuário",
          userPhoto: userProfile?.photo || null,
        };
      }),
    );

    return enrichedStories;
  } catch (err: any) {
    console.error("Error fetching active stories:", err);
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
      .from("storys")
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

    return data;
  } catch (err: any) {
    console.error("Error creating story:", err);
    return null;
  }
}

export async function deleteOldStoriesDb(): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - 24 * 60 * 60 * 1000,
    ).toISOString();

    const { error } = await supabase
      .from("storys")
      .delete()
      .lt("created_at", twentyFourHoursAgo);

    if (error) {
      const errorMsg = error?.message || String(error);
      const errorCode = error?.code || "UNKNOWN";
      console.error(`Error deleting old stories [${errorCode}]:`, errorMsg);
      return false;
    }

    return true;
  } catch (err: any) {
    console.error("Error deleting old stories:", err);
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

  const { data: existing } = await supabase
    .from("story_likes")
    .select("id")
    .eq("story_id", storyId)
    .eq("user_id", viewer.id)
    .eq("type", incentiveType)
    .maybeSingle();

  if (existing?.id) {
    // Remove the like
    await supabase.from("story_likes").delete().eq("id", existing.id);
  } else {
    // Add the like
    await supabase.from("story_likes").insert({
      story_id: storyId,
      user_id: viewer.id,
      type: incentiveType,
    });

    // Award 1 point for interacting with a story
    await addPointsDb(1);
  }
}

export async function getStoryLikesDb(storyId: string): Promise<PostLikeStats> {
  if (!hasSupabaseConfig || !supabase) {
    return { apoio: 0, continua: 0, ganhador: 0, consegueMais: 0, limiteMaior: 0, maisAlgum: 0 };
  }

  const { data } = await supabase
    .from("story_likes")
    .select("type")
    .eq("story_id", storyId);

  const stats: PostLikeStats = { apoio: 0, continua: 0, ganhador: 0, consegueMais: 0, limiteMaior: 0, maisAlgum: 0 };

  (data ?? []).forEach((row: any) => {
    const incentiveType = Number(row.type) as PostIncentiveType;
    if (incentiveType === 1) stats.apoio += 1;
    else if (incentiveType === 2) stats.continua += 1;
    else if (incentiveType === 3) stats.ganhador += 1;
    else if (incentiveType === 4) stats.consegueMais += 1;
    else if (incentiveType === 5) stats.limiteMaior += 1;
    else if (incentiveType === 6) stats.maisAlgum += 1;
  });

  return stats;
}

export async function getUserStoryLikesDb(
  storyId: string,
): Promise<PostIncentiveType[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const viewer = await getViewer();
  if (!viewer) return [];

  const { data } = await supabase
    .from("story_likes")
    .select("type")
    .eq("story_id", storyId)
    .eq("user_id", viewer.id);

  return (data ?? [])
    .map((row: any) => Number(row.type) as PostIncentiveType)
    .filter((incentiveType): incentiveType is PostIncentiveType =>
      [1, 2, 3, 4, 5, 6].includes(incentiveType),
    );
}

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

  const viewer = await getViewer();
  if (!viewer) return null;

  try {
    const userProfile = await getUserProfileDb(viewer.id);
    const userName = userProfile?.nickname || "Usuário";

    const { data, error } = await supabase
      .from("story_comments")
      .insert({
        story_id: storyId,
        user_id: viewer.id,
        text,
      })
      .select()
      .maybeSingle();

    if (error) throw error;

    return {
      id: data?.id || "",
      storyId: storyId,
      userId: viewer.id,
      userName,
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
    const { data, error } = await supabase
      .from("story_comments")
      .select("*")
      .eq("story_id", storyId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const enrichedComments = await Promise.all(
      (data ?? []).map(async (comment: any) => {
        const userProfile = await getUserProfileDb(comment.user_id);
        return {
          id: comment.id,
          storyId: storyId,
          userId: comment.user_id,
          userName: userProfile?.nickname || "Usuário",
          text: comment.text,
          createdAt: comment.created_at,
        };
      }),
    );

    return enrichedComments;
  } catch (err: any) {
    console.error("Error fetching story comments:", err?.message || err);
    return [];
  }
}

export async function deleteStoryCommentDb(commentId: string): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  try {
    const { error } = await supabase
      .from("story_comments")
      .delete()
      .eq("id", commentId);

    if (error) throw error;
    return true;
  } catch (err: any) {
    console.error("Error deleting story comment:", err);
    return false;
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

    // Convert to conversations with user info
    const conversations: Conversation[] = [];

    for (const [userId, msgs] of conversationMap.entries()) {
      const userProfile = await getUserProfileDb(userId);
      const unreadCount = msgs.filter(
        (msg) => msg.id_following === viewer.id && msg.read === 0,
      ).length;

      conversations.push({
        userId,
        userNickname: userProfile?.nickname || "Usuário",
        userPhoto: userProfile?.photo || null,
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

export async function getUnreadMessageCountDb(): Promise<number> {
  if (!hasSupabaseConfig || !supabase) return 0;

  const viewer = await getViewer();
  if (!viewer) return 0;

  try {
    const { count, error } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("id_following", viewer.id)
      .eq("read", 0);

    if (error) {
      console.error("Error fetching unread message count:", error);
      return 0;
    }

    return count ?? 0;
  } catch (err: any) {
    console.error("Error getting unread message count:", err);
    return 0;
  }
}

export async function getFollowersDb(): Promise<SearchUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const viewer = await getViewer();
  if (!viewer) return [];

  try {
    // Get all followers of the current user
    const { data, error } = await supabase
      .from("following")
      .select("user_id")
      .eq("following_id", viewer.id)
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

export type Reel = {
  id: string;
  user_id: string;
  video_url: string;
  description: string;
  created_at: string;
  likes: PostLikeStats;
  userLikes: PostIncentiveType[];
};

export type ReelWithUser = Reel & {
  userNickname: string;
  userPhoto: string | null;
};

export async function getReelsDb(): Promise<ReelWithUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const viewer = await getViewer();
  if (!viewer) return [];

  try {
    // Get reels from current user and followed users
    const followingIds = await getFollowingIdsDb();
    const userIdsToShow = [viewer.id, ...followingIds];

    console.log("[getReelsDb] Fetching reels for users:", userIdsToShow);

    if (userIdsToShow.length === 0) {
      console.log("[getReelsDb] No users to fetch reels for");
      return [];
    }

    const { data: reelsData, error: reelsError } = await supabase
      .from("reels")
      .select("id, user_id, video_url, description, created_at")
      .in("user_id", userIdsToShow)
      .order("created_at", { ascending: false });

    if (reelsError) {
      console.error("[getReelsDb] Error fetching reels:", reelsError);
      return [];
    }

    console.log("[getReelsDb] Found reels:", reelsData?.length || 0);

    if (!reelsData || reelsData.length === 0) {
      return [];
    }

    // Get all unique user IDs to batch fetch profiles
    const uniqueUserIds = [
      ...new Set((reelsData ?? []).map((r: any) => String(r.user_id))),
    ];
    console.log(
      "[getReelsDb] Fetching profiles for users:",
      uniqueUserIds.length,
    );

    let profiles: any[] = [];
    if (uniqueUserIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, nickname, photo")
        .in("user_id", uniqueUserIds);

      if (profilesError) {
        console.error("[getReelsDb] Error fetching profiles:", profilesError);
      } else {
        profiles = profilesData ?? [];
      }
    }

    console.log("[getReelsDb] Found profiles:", profiles.length);

    const profileMap = new Map(
      (profiles ?? []).map((p: any) => [
        p.user_id,
        { nickname: p.nickname, photo: p.photo },
      ]),
    );

    // Get all likes for these reels in one query
    const reelIds = (reelsData ?? []).map((r: any) => String(r.id));
    console.log("[getReelsDb] Fetching likes for reels:", reelIds.length);

    let allLikes: any[] = [];
    if (reelIds.length > 0) {
      const { data: likesData, error: likesError } = await supabase
        .from("reel_likes")
        .select("reel_id, type, user_id")
        .in("reel_id", reelIds);

      if (likesError) {
        console.error(
          "[getReelsDb] Error fetching likes:",
          likesError?.message || JSON.stringify(likesError),
        );
        // Try legacy format if reel_likes table doesn't exist
        const { data: legacyLikes, error: legacyError } = await supabase
          .from("likes")
          .select("post_id, type, user_id")
          .in("post_id", reelIds);

        if (!legacyError && legacyLikes) {
          allLikes = (legacyLikes ?? []).map((like: any) => ({
            ...like,
            reel_id: like.post_id,
          }));
        }
      } else {
        allLikes = likesData ?? [];
      }
    }

    console.log("[getReelsDb] Found likes:", allLikes.length);

    const likesMap = new Map<
      string,
      { likes: PostLikeStats; userLikes: PostIncentiveType[] }
    >();

    (allLikes ?? []).forEach((like: any) => {
      const reelId = String(like.reel_id);
      if (!likesMap.has(reelId)) {
        likesMap.set(reelId, {
          likes: { apoio: 0, continua: 0, ganhador: 0, consegueMais: 0, limiteMaior: 0, maisAlgum: 0 },
          userLikes: [],
        });
      }

      const entry = likesMap.get(reelId)!;
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

    // Build final reel objects
    const reelsWithUserData: ReelWithUser[] = (reelsData ?? []).map(
      (reel: any) => {
        const userProfile = profileMap.get(String(reel.user_id)) || {
          nickname: "Usuário",
          photo: null,
        };
        const likeData = likesMap.get(String(reel.id)) || {
          likes: { apoio: 0, continua: 0, ganhador: 0, consegueMais: 0, limiteMaior: 0, maisAlgum: 0 },
          userLikes: [],
        };

        return {
          id: String(reel.id ?? ""),
          user_id: String(reel.user_id ?? ""),
          video_url: String(reel.video_url ?? ""),
          description: String(reel.description ?? ""),
          created_at: String(reel.created_at ?? new Date().toISOString()),
          likes: likeData.likes,
          userLikes: likeData.userLikes,
          userNickname: String(userProfile.nickname ?? "Usuário"),
          userPhoto: userProfile.photo ? String(userProfile.photo) : null,
        };
      },
    );

    console.log("[getReelsDb] Returning reels:", reelsWithUserData.length);
    return reelsWithUserData;
  } catch (err: any) {
    console.error("Error getting reels:", err?.message || JSON.stringify(err));
    return [];
  }
}

export async function toggleReelIncentiveDb(
  reelId: string,
  incentiveType: PostIncentiveType,
) {
  if (!hasSupabaseConfig || !supabase) return;

  const viewer = await getViewer();
  if (!viewer) return;

  try {
    let { data: existing, error: checkError } = await supabase
      .from("reel_likes")
      .select("id")
      .eq("reel_id", reelId)
      .eq("user_id", viewer.id)
      .eq("type", incentiveType)
      .maybeSingle();

    // If reel_likes table doesn't exist, try legacy likes table
    if (checkError) {
      const { data: legacyExisting } = await supabase
        .from("likes")
        .select("id")
        .eq("post_id", reelId)
        .eq("user_id", viewer.id)
        .eq("type", incentiveType)
        .maybeSingle();

      existing = legacyExisting;
    }

    if (existing?.id) {
      // Remove the like
      const tableName = checkError ? "likes" : "reel_likes";
      await supabase.from(tableName).delete().eq("id", existing.id);
    } else {
      // Add the like - try reel_likes first, then legacy likes
      let insertError = null;
      const { error: reelLikeError } = await supabase
        .from("reel_likes")
        .insert({
          reel_id: reelId,
          user_id: viewer.id,
          type: incentiveType,
        });

      if (reelLikeError) {
        // Try legacy format
        const { error: legacyInsertError } = await supabase
          .from("likes")
          .insert({
            post_id: reelId,
            user_id: viewer.id,
            type: incentiveType,
          });
        insertError = legacyInsertError;
      }

      if (!reelLikeError || !insertError) {
        // Award 1 point for interacting with a reel
        await addPointsDb(1);
      }
    }
  } catch (err: any) {
    console.error(
      "Error toggling reel incentive:",
      err?.message || JSON.stringify(err),
    );
  }
}

export type ReelComment = {
  id: string;
  reelId: string;
  userId: string;
  userName: string;
  userHandle: string;
  text: string;
  createdAt: string;
};

export async function addReelCommentDb(reelId: string, text: string) {
  if (!hasSupabaseConfig || !supabase) return;

  const viewer = await getViewer();
  if (!viewer) return;

  const profile = await ensureProfile();
  const userName = profile?.nickname ?? "Você";
  const userHandle = profile?.handle ?? "@voce";

  try {
    const { error } = await supabase.from("reel_comments").insert({
      reel_id: reelId,
      user_id: viewer.id,
      user_handle: userHandle,
      user_name: userName,
      text: text.trim(),
    });

    if (error) {
      // Try legacy format if reel_comments table doesn't exist
      const { error: legacyError } = await supabase.from("comments").insert({
        post_id: reelId,
        user_id: viewer.id,
        user_handle: userHandle,
        user_name: userName,
        text: text.trim(),
      });

      if (legacyError) {
        console.error(
          "Error adding reel comment:",
          legacyError?.message || JSON.stringify(legacyError),
        );
        throw legacyError;
      }
    }

    // Award 1 point for commenting on a reel
    await addPointsDb(1);
  } catch (err: any) {
    console.error(
      "Error adding reel comment:",
      err?.message || JSON.stringify(err),
    );
    throw err;
  }
}

export async function getReelCommentsDb(
  reelId: string,
): Promise<ReelComment[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  try {
    const { data, error } = await supabase
      .from("reel_comments")
      .select("*")
      .eq("reel_id", reelId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(
        "Error fetching reel comments:",
        error?.message || JSON.stringify(error),
      );
      // Try legacy format if reel_comments table doesn't exist
      const { data: legacyData, error: legacyError } = await supabase
        .from("comments")
        .select("*")
        .eq("post_id", reelId)
        .order("created_at", { ascending: true });

      if (legacyError) {
        console.error(
          "Error fetching reel comments (legacy):",
          legacyError?.message || JSON.stringify(legacyError),
        );
        return [];
      }

      return (legacyData ?? []).map(
        (row: any) =>
          ({
            id: String(row.id),
            reelId: String(row.post_id),
            userId: String(row.user_id),
            userName: String(row.user_name ?? "Usuário"),
            userHandle: String(row.user_handle ?? "@user"),
            text: String(row.text ?? ""),
            createdAt: String(row.created_at ?? new Date().toISOString()),
          }) satisfies ReelComment,
      );
    }

    return (data ?? []).map(
      (row: any) =>
        ({
          id: String(row.id),
          reelId: String(row.reel_id),
          userId: String(row.user_id),
          userName: String(row.user_name ?? "Usuário"),
          userHandle: String(row.user_handle ?? "@user"),
          text: String(row.text ?? ""),
          createdAt: String(row.created_at ?? new Date().toISOString()),
        }) satisfies ReelComment,
    );
  } catch (err: any) {
    console.error(
      "Error getting reel comments:",
      err?.message || JSON.stringify(err),
    );
    return [];
  }
}

export async function deleteReelCommentDb(commentId: string) {
  if (!hasSupabaseConfig || !supabase) return;

  try {
    const { error } = await supabase
      .from("reel_comments")
      .delete()
      .eq("id", commentId);

    if (error) {
      // Try legacy format if reel_comments table doesn't exist
      const { error: legacyError } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId);

      if (legacyError) {
        console.error(
          "Error deleting reel comment:",
          legacyError?.message || JSON.stringify(legacyError),
        );
        throw legacyError;
      }
    }
  } catch (err: any) {
    console.error(
      "Error deleting reel comment:",
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

  const viewer = await getViewer();
  if (!viewer) return [];

  try {
    // Get current user's following
    const followingIds = await getFollowingIdsDb();
    const userIdsToShow = [viewer.id, ...followingIds];

    // Get ranking for these users
    const { data: rankingData, error: rankingError } = await supabase
      .from("ranking")
      .select("user_id, points, level")
      .in("user_id", userIdsToShow)
      .order("points", { ascending: false });

    if (rankingError) {
      console.error("Error fetching ranking:", rankingError);
      return [];
    }

    if (!rankingData || rankingData.length === 0) {
      return [];
    }

    // Get profile data for each user
    const userIds = rankingData.map((r: any) => String(r.user_id));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nickname, photo")
      .in("user_id", userIds);

    const profileMap = new Map(
      (profiles ?? []).map((p: any) => [
        p.user_id,
        { nickname: p.nickname, photo: p.photo },
      ]),
    );

    return (rankingData ?? []).map((row: any) => {
      const profile = profileMap.get(String(row.user_id)) || {
        nickname: "Usuário",
        photo: null,
      };

      return {
        userId: String(row.user_id),
        userNickname: String(profile.nickname),
        userPhoto: profile.photo ? String(profile.photo) : null,
        points: Number(row.points ?? 0),
        level: Number(row.level ?? 1),
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

  const { error } = await supabase
    .from("user_diets")
    .update({ is_completed: isCompleted })
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

  const { error } = await supabase
    .from("user_habits")
    .update({ is_completed: isCompleted })
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

  for (const record of workoutRecords) {
    const { error } = await supabase
      .from("user_workouts")
      .update({
        volume: record.volume || null,
        reps: record.reps || null,
        time_rest: record.time_rest || null,
        duration: record.duration || null,
      })
      .eq("id", record.id);

    if (error) {
      const errorMsg = error?.message || String(error);
      const errorCode = error?.code || "UNKNOWN";
      console.error(
        `Error updating workout series [${errorCode}]:`,
        errorMsg,
      );
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
  type: "like" | "comment" | "post";
  userId: string;
  userNickname: string;
  userPhoto: string | null;
  postId?: string;
  postPhoto?: string;
  text?: string; // For comments
  createdAt: string;
};

export async function getNotificationsDb(): Promise<NotificationItem[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const viewer = await getViewer();
  if (!viewer) return [];

  try {
    const notifications: NotificationItem[] = [];

    // Get likes on user's posts
    const { data: likesData, error: likesError } = await supabase
      .from("likes")
      .select("id, user_id, post_id, type, created_at")
      .in("post_id",
        (await supabase
          .from("posts")
          .select("id")
          .eq("user_id", viewer.id)
          .then(result => (result.data ?? []).map((p: any) => p.id)))
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (!likesError && likesData) {
      // Get user profiles and post photos for likes
      const userIds = [...new Set(likesData.map((l: any) => l.user_id))];
      const postIds = [...new Set(likesData.map((l: any) => l.post_id))];

      const [{ data: profiles }, { data: posts }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, nickname, photo")
          .in("user_id", userIds),
        supabase
          .from("posts")
          .select("id, photo")
          .in("id", postIds),
      ]);

      const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
      const postMap = new Map((posts ?? []).map((p: any) => [p.id, p]));

      likesData.forEach((like: any) => {
        const profile = profileMap.get(like.user_id);
        const post = postMap.get(like.post_id);
        if (profile && post) {
          notifications.push({
            id: `like-${like.id}`,
            type: "like",
            userId: like.user_id,
            userNickname: profile.nickname,
            userPhoto: profile.photo,
            postId: like.post_id,
            postPhoto: post.photo,
            createdAt: like.created_at,
          });
        }
      });
    }

    // Get comments on user's posts
    const { data: commentsData, error: commentsError } = await supabase
      .from("comments")
      .select("id, user_id, post_id, text, created_at")
      .in("post_id",
        (await supabase
          .from("posts")
          .select("id")
          .eq("user_id", viewer.id)
          .then(result => (result.data ?? []).map((p: any) => p.id)))
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (!commentsError && commentsData) {
      const userIds = [...new Set(commentsData.map((c: any) => c.user_id))];
      const postIds = [...new Set(commentsData.map((c: any) => c.post_id))];

      const [{ data: profiles }, { data: posts }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, nickname, photo")
          .in("user_id", userIds),
        supabase
          .from("posts")
          .select("id, photo")
          .in("id", postIds),
      ]);

      const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
      const postMap = new Map((posts ?? []).map((p: any) => [p.id, p]));

      commentsData.forEach((comment: any) => {
        const profile = profileMap.get(comment.user_id);
        const post = postMap.get(comment.post_id);
        if (profile && post) {
          notifications.push({
            id: `comment-${comment.id}`,
            type: "comment",
            userId: comment.user_id,
            userNickname: profile.nickname,
            userPhoto: profile.photo,
            postId: comment.post_id,
            postPhoto: post.photo,
            text: comment.text,
            createdAt: comment.created_at,
          });
        }
      });
    }

    // Get new posts from followed users
    const followingIds = await getFollowingIdsDb();
    if (followingIds.length > 0) {
      const { data: postsData } = await supabase
        .from("posts")
        .select("id, user_id, photo, created_at")
        .in("user_id", followingIds)
        .order("created_at", { ascending: false })
        .limit(50);

      if (postsData) {
        const userIds = [...new Set(postsData.map((p: any) => p.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, nickname, photo")
          .in("user_id", userIds);

        const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

        postsData.forEach((post: any) => {
          const profile = profileMap.get(post.user_id);
          if (profile) {
            notifications.push({
              id: `post-${post.id}`,
              type: "post",
              userId: post.user_id,
              userNickname: profile.nickname,
              userPhoto: profile.photo,
              postId: post.id,
              postPhoto: post.photo,
              createdAt: post.created_at,
            });
          }
        });
      }
    }

    // Sort all notifications by date and return top 100
    return notifications
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 100);
  } catch (err: any) {
    console.error("Error getting notifications:", err);
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
