import { getUserSafe, hasSupabaseConfig, supabase } from "@/lib/supabase";
import {
  addComment as addCommentLocal,
  blockUser as blockUserLocal,
  copyRoutine as copyRoutineLocal,
  createGoal as createGoalLocal,
  createRoutine as createRoutineLocal,
  deleteGoal as deleteGoalLocal,
  deleteRoutine as deleteRoutineLocal,
  deleteStoryItem as deleteStoryItemLocal,
  getRitmoFitState as getRitmoFitStateLocal,
  getRoutines as getRoutinesLocal,
  getStories as getStoriesLocal,
  isBlocked as isBlockedLocal,
  addStoryItem as addStoryItemLocal,
  updateGoal as updateGoalLocal,
  updateRoutine as updateRoutineLocal,
  unblockUser as unblockUserLocal,
  type Goal,
  type GoalComment,
  type GoalIncentiveKey,
  type GoalVisibility,
  type Routine,
  type StoryGroup,
  type StorageShape,
} from "@/lib/ritmofit";

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

function goalFromRow(row: any): Goal {
  return {
    id: String(row.id),
    ownerName: String(row.owner_name ?? row.ownerName ?? ""),
    ownerHandle: String(row.owner_handle ?? row.ownerHandle ?? ""),
    title: String(row.title ?? ""),
    caption: String(row.caption ?? ""),
    imageDataUrl: (row.image_url as string | null) ?? undefined,
    imageDataUrls: Array.isArray(row.image_urls)
      ? (row.image_urls as string[])
      : undefined,
    hidden: Boolean(row.hidden),
    category: row.category,
    frequency: String(row.frequency ?? ""),
    durationDays: Number(row.duration_days ?? row.durationDays) as 7 | 21 | 30,
    visibility: row.visibility as GoalVisibility,
    createdAt: String(
      row.created_at ?? row.createdAt ?? new Date().toISOString(),
    ),
    completedDays: Number(row.completed_days ?? row.completedDays ?? 0),
    incentives: {
      apoio: Number(row.apoio_count ?? row.apoio ?? 0),
      continua: Number(row.continua_count ?? row.continua ?? 0),
      orgulho: Number(row.orgulho_count ?? row.orgulho ?? 0),
    },
    attachedRoutineIds: Array.isArray(row.attached_routine_ids)
      ? (row.attached_routine_ids as string[])
      : undefined,
    attachedRoutineTitles: Array.isArray(row.attached_routine_titles)
      ? (row.attached_routine_titles as string[])
      : undefined,
    attachedRoutineId: row.attached_routine_id ?? row.attachedRoutineId,
    attachedRoutineTitle:
      row.attached_routine_title ?? row.attachedRoutineTitle,
    myIncentives: {},
    myProgressToday: String(row.my_progress_today ?? row.myProgressToday ?? ""),
    comments: [],
    commentsCount: Number(row.comments_count ?? row.commentsCount ?? 0),
  };
}

function routineFromRow(r: any, steps: any[] | null): Routine {
  return {
    id: String(r.id),
    ownerName: String(r.owner_name ?? ""),
    ownerHandle: String(r.owner_handle ?? ""),
    title: String(r.title ?? ""),
    description: String(r.description ?? ""),
    category: r.category,
    visibility: r.visibility,
    createdAt: String(r.created_at ?? new Date().toISOString()),
    updatedAt: String(r.updated_at ?? r.created_at ?? new Date().toISOString()),
    steps: Array.isArray(steps)
      ? steps
          .slice()
          .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
          .map((s) => ({
            id: String(s.id),
            title: String(s.title ?? ""),
            detail: String(s.detail ?? ""),
            exerciseId:
              typeof s.exercise_id === "string"
                ? (s.exercise_id as string)
                : undefined,
            muscleGroup:
              typeof s.muscle_group === "string"
                ? (s.muscle_group as string)
                : undefined,
            imageUrl:
              typeof s.image_url === "string"
                ? (s.image_url as string)
                : undefined,
          }))
      : [],
    copiedFromRoutineId:
      typeof r.copied_from_routine_id === "string"
        ? r.copied_from_routine_id
        : undefined,
  };
}

async function applyMyIncentives(goals: Goal[]) {
  const user = await getViewer();
  if (!user || !supabase || !goals.length) return goals;

  const ids = goals.map((g) => g.id);

  const { data } = await supabase
    .from("goal_incentives")
    .select("goal_id, kind")
    .eq("user_id", user.id)
    .in("goal_id", ids);

  const map = new Map<string, Partial<Record<GoalIncentiveKey, boolean>>>();

  (data ?? []).forEach((row: any) => {
    const goalId = String(row.goal_id);
    const kind = String(row.kind) as GoalIncentiveKey;
    const prev = map.get(goalId) ?? {};
    prev[kind] = true;
    map.set(goalId, prev);
  });

  return goals.map((g) => ({
    ...g,
    myIncentives: map.get(g.id) ?? {},
  }));
}

export async function getRitmoFitStateDb(): Promise<StorageShape> {
  if (!hasSupabaseConfig || !supabase) {
    return getRitmoFitStateLocal();
  }

  const { data: goalsRows, error: goalsError } = await supabase
    .from("goals")
    .select("*")
    .order("created_at", { ascending: false });

  if (goalsError) return getRitmoFitStateLocal();

  const { data: blocksRows } = await supabase
    .from("user_blocks")
    .select("blocked_handle");

  const { data: routinesRows } = await supabase
    .from("routines")
    .select("*, routine_steps(*)")
    .order("created_at", { ascending: false });

  const { data: storiesRows } = await supabase
    .from("story_groups")
    .select("*, story_items(*)")
    .order("created_at", { ascending: false });

  const goals = await applyMyIncentives((goalsRows ?? []).map(goalFromRow));

  const routines = (routinesRows ?? []).map((r: any) =>
    routineFromRow(r, (r as any).routine_steps ?? []),
  );

  const stories: StoryGroup[] = (storiesRows ?? []).map((g: any) => ({
    id: String(g.id),
    ownerName: String(g.owner_name ?? ""),
    ownerHandle: String(g.owner_handle ?? ""),
    items: Array.isArray((g as any).story_items)
      ? ((g as any).story_items as any[])
          .slice()
          .sort(
            (a, b) =>
              new Date(String(a.created_at)).getTime() -
              new Date(String(b.created_at)).getTime(),
          )
          .map((it) => ({
            id: String(it.id),
            imageDataUrl: (it.image_url as string | null) ?? undefined,
            text: (it.text as string | null) ?? undefined,
            createdAt: String(it.created_at ?? new Date().toISOString()),
          }))
      : [],
  }));

  return {
    goals,
    routines,
    stories,
    blockedHandles: (blocksRows ?? []).map((r: any) =>
      String(r.blocked_handle),
    ),
  };
}

export async function createGoalDb(input: {
  title: string;
  caption?: string;
  imageDataUrl?: string;
  category: Goal["category"];
  frequency: string;
  durationDays: 7 | 21 | 30;
  visibility: GoalVisibility;
  attachedRoutineIds?: string[];
  attachedRoutineTitles?: string[];
  attachedRoutineId?: string;
  attachedRoutineTitle?: string;
}) {
  if (!hasSupabaseConfig || !supabase) return createGoalLocal(input);

  const profile = await ensureProfile();
  const ownerName = profile?.displayName ?? "Você";
  const ownerHandle = profile?.handle ?? "@voce";

  const { data, error } = await supabase
    .from("goals")
    .insert({
      owner_id: profile?.id ?? null,
      owner_name: ownerName,
      owner_handle: ownerHandle,
      title: input.title,
      caption: input.caption ?? "",
      image_url: input.imageDataUrl ?? null,
      image_urls: input.imageDataUrl ? [input.imageDataUrl] : null,
      category: input.category,
      frequency: input.frequency,
      duration_days: input.durationDays,
      visibility: input.visibility,
      created_at: new Date().toISOString(),
      completed_days: input.imageDataUrl ? 1 : 0,
      my_progress_today: input.imageDataUrl
        ? new Date().toISOString().slice(0, 10)
        : null,
      hidden: false,
      attached_routine_ids: input.attachedRoutineIds ?? null,
      attached_routine_titles: input.attachedRoutineTitles ?? null,
      attached_routine_id: input.attachedRoutineId ?? null,
      attached_routine_title: input.attachedRoutineTitle ?? null,
      apoio_count: 0,
      continua_count: 0,
      orgulho_count: 0,
      comments_count: 0,
    })
    .select("*")
    .single();

  if (error) return createGoalLocal(input);

  const goals = await applyMyIncentives([goalFromRow(data)]);
  return goals[0];
}

export async function updateGoalDb(goalId: string, patch: Partial<Goal>) {
  if (!hasSupabaseConfig || !supabase) {
    const next = updateGoalLocal(goalId, (g) => ({ ...g, ...patch }));
    return next.goals.find((g) => g.id === goalId) ?? null;
  }

  const update: any = {};

  if (patch.title !== undefined) update.title = patch.title;
  if (patch.caption !== undefined) update.caption = patch.caption;
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.frequency !== undefined) update.frequency = patch.frequency;
  if (patch.durationDays !== undefined)
    update.duration_days = patch.durationDays;
  if (patch.visibility !== undefined) update.visibility = patch.visibility;
  if ((patch as any).hidden !== undefined)
    update.hidden = Boolean((patch as any).hidden);

  if (patch.completedDays !== undefined)
    update.completed_days = patch.completedDays;
  if (patch.myProgressToday !== undefined)
    update.my_progress_today = patch.myProgressToday || null;

  if (patch.imageDataUrl !== undefined)
    update.image_url = patch.imageDataUrl || null;
  if ((patch as any).imageDataUrls !== undefined)
    update.image_urls = (patch as any).imageDataUrls ?? null;

  if ((patch as any).attachedRoutineIds !== undefined)
    update.attached_routine_ids = (patch as any).attachedRoutineIds ?? null;
  if ((patch as any).attachedRoutineTitles !== undefined)
    update.attached_routine_titles =
      (patch as any).attachedRoutineTitles ?? null;

  const { data, error } = await supabase
    .from("goals")
    .update(update)
    .eq("id", goalId)
    .select("*")
    .single();

  if (error) {
    const next = updateGoalLocal(goalId, (g) => ({ ...g, ...patch }));
    return next.goals.find((g) => g.id === goalId) ?? null;
  }

  const goals = await applyMyIncentives([goalFromRow(data)]);
  return goals[0];
}

export async function deleteGoalDb(goalId: string) {
  if (!hasSupabaseConfig || !supabase) {
    deleteGoalLocal(goalId);
    return;
  }

  const { error } = await supabase.from("goals").delete().eq("id", goalId);
  if (error) deleteGoalLocal(goalId);
}

export async function listGoalComments(goalId: string) {
  if (!hasSupabaseConfig || !supabase) {
    const goal = getRitmoFitStateLocal().goals.find((g) => g.id === goalId);
    return goal?.comments ?? [];
  }

  const { data, error } = await supabase
    .from("goal_comments")
    .select("*")
    .eq("goal_id", goalId)
    .order("created_at", { ascending: true });

  if (error) {
    const goal = getRitmoFitStateLocal().goals.find((g) => g.id === goalId);
    return goal?.comments ?? [];
  }

  return (data ?? []).map(
    (row: any) =>
      ({
        id: String(row.id),
        authorName: String(row.author_name ?? ""),
        authorHandle: String(row.author_handle ?? ""),
        text: String(row.text ?? ""),
        createdAt: String(row.created_at ?? new Date().toISOString()),
      }) satisfies GoalComment,
  );
}

export async function addGoalCommentDb(goalId: string, text: string) {
  if (!hasSupabaseConfig || !supabase) {
    addCommentLocal(goalId, { text });
    return;
  }

  const profile = await ensureProfile();
  const authorName = profile?.displayName ?? "Você";
  const authorHandle = profile?.handle ?? "@voce";

  const { error } = await supabase.from("goal_comments").insert({
    goal_id: goalId,
    author_id: profile?.id ?? null,
    author_name: authorName,
    author_handle: authorHandle,
    text,
  });

  if (error) {
    addCommentLocal(goalId, { text, authorName, authorHandle });
    return;
  }

  const { data: goalRow } = await supabase
    .from("goals")
    .select("comments_count")
    .eq("id", goalId)
    .maybeSingle();

  const nextCount = Number((goalRow as any)?.comments_count ?? 0) + 1;
  await supabase
    .from("goals")
    .update({ comments_count: nextCount })
    .eq("id", goalId);
}

export async function toggleGoalIncentiveDb(
  goalId: string,
  kind: GoalIncentiveKey,
) {
  if (!hasSupabaseConfig || !supabase) {
    // Local fallback cannot reliably toggle for multi-user; keep existing behavior.
    const next = updateGoalLocal(goalId, (g) => ({ ...g }));
    return next.goals.find((g) => g.id === goalId) ?? null;
  }

  const viewer = await getViewer();
  if (!viewer) return null;

  const { data: existing } = await supabase
    .from("goal_incentives")
    .select("id")
    .eq("goal_id", goalId)
    .eq("user_id", viewer.id)
    .eq("kind", kind)
    .maybeSingle();

  const col = `${kind}_count`;

  const { data: goalRow } = await supabase
    .from("goals")
    .select("apoio_count, continua_count, orgulho_count")
    .eq("id", goalId)
    .maybeSingle();

  const current = Number((goalRow as any)?.[col] ?? 0);

  if (existing?.id) {
    await supabase.from("goal_incentives").delete().eq("id", existing.id);
    await supabase
      .from("goals")
      .update({ [col]: Math.max(0, current - 1) })
      .eq("id", goalId);
  } else {
    await supabase.from("goal_incentives").insert({
      goal_id: goalId,
      user_id: viewer.id,
      kind,
    });
    await supabase
      .from("goals")
      .update({ [col]: current + 1 })
      .eq("id", goalId);
  }

  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("id", goalId)
    .single();

  if (error) return null;

  const goals = await applyMyIncentives([goalFromRow(data)]);
  return goals[0];
}

export async function getStoriesDb() {
  if (!hasSupabaseConfig || !supabase) return getStoriesLocal();

  const { data, error } = await supabase
    .from("story_groups")
    .select("*, story_items(*)")
    .order("created_at", { ascending: false });

  if (error) return getStoriesLocal();

  return (data ?? []).map((g: any) => ({
    id: String(g.id),
    ownerName: String(g.owner_name ?? ""),
    ownerHandle: String(g.owner_handle ?? ""),
    items: Array.isArray((g as any).story_items)
      ? ((g as any).story_items as any[])
          .slice()
          .sort(
            (a, b) =>
              new Date(String(a.created_at)).getTime() -
              new Date(String(b.created_at)).getTime(),
          )
          .map((it) => ({
            id: String(it.id),
            imageDataUrl: (it.image_url as string | null) ?? undefined,
            text: (it.text as string | null) ?? undefined,
            createdAt: String(it.created_at ?? new Date().toISOString()),
          }))
      : [],
  }));
}

export async function addStoryItemDb(input: {
  imageDataUrl?: string;
  text?: string;
}) {
  if (!hasSupabaseConfig || !supabase) {
    addStoryItemLocal(input);
    return;
  }

  const profile = await ensureProfile();
  if (!profile) {
    addStoryItemLocal(input);
    return;
  }

  const { data: group } = await supabase
    .from("story_groups")
    .upsert(
      {
        owner_id: profile.id,
        owner_name: profile.displayName,
        owner_handle: profile.handle,
        created_at: new Date().toISOString(),
      },
      { onConflict: "owner_id" },
    )
    .select("id")
    .maybeSingle();

  const groupId = String(group?.id ?? "");
  if (!groupId) {
    addStoryItemLocal({
      ownerName: profile.displayName,
      ownerHandle: profile.handle,
      imageDataUrl: input.imageDataUrl,
      text: input.text,
    });
    return;
  }

  await supabase.from("story_items").insert({
    group_id: groupId,
    image_url: input.imageDataUrl ?? null,
    text: input.text ?? null,
  });
}

export async function deleteStoryItemDb(
  ownerHandle: string,
  storyItemId: string,
) {
  if (!hasSupabaseConfig || !supabase) {
    deleteStoryItemLocal(ownerHandle, storyItemId);
    return;
  }

  const { error } = await supabase
    .from("story_items")
    .delete()
    .eq("id", storyItemId);
  if (error) deleteStoryItemLocal(ownerHandle, storyItemId);
}

export async function getRoutinesDb() {
  if (!hasSupabaseConfig || !supabase) return getRoutinesLocal();

  const { data, error } = await supabase
    .from("routines")
    .select("*, routine_steps(*)")
    .order("created_at", { ascending: false });

  if (error) return getRoutinesLocal();

  return (data ?? []).map((r: any) =>
    routineFromRow(r, (r as any).routine_steps ?? []),
  );
}

export async function createRoutineDb(input: {
  title: string;
  description: string;
  category: Routine["category"];
  visibility: GoalVisibility;
  steps: Routine["steps"];
  copiedFromRoutineId?: string;
}) {
  if (!hasSupabaseConfig || !supabase) return createRoutineLocal(input);

  const profile = await ensureProfile();
  const ownerName = profile?.displayName ?? "Você";
  const ownerHandle = profile?.handle ?? "@voce";

  const { data: routineRow, error } = await supabase
    .from("routines")
    .insert({
      owner_id: profile?.id ?? null,
      owner_name: ownerName,
      owner_handle: ownerHandle,
      title: input.title,
      description: input.description,
      category: input.category,
      visibility: input.visibility,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      copied_from_routine_id: input.copiedFromRoutineId ?? null,
    })
    .select("*")
    .single();

  if (error) return createRoutineLocal(input);

  const routineId = String(routineRow.id);

  if (input.steps?.length) {
    const rows = input.steps.map((s, idx) => ({
      routine_id: routineId,
      position: idx,
      title: s.title,
      detail: s.detail,
      exercise_id: (s as any).exerciseId ?? null,
      muscle_group: (s as any).muscleGroup ?? null,
      image_url: (s as any).imageUrl ?? null,
    }));

    await supabase.from("routine_steps").insert(rows);
  }

  const { data: withSteps } = await supabase
    .from("routines")
    .select("*, routine_steps(*)")
    .eq("id", routineId)
    .single();

  return routineFromRow(
    withSteps ?? routineRow,
    (withSteps as any)?.routine_steps ?? [],
  );
}

export async function updateRoutineDb(
  routineId: string,
  patch: Partial<Routine>,
) {
  if (!hasSupabaseConfig || !supabase) {
    const next = updateRoutineLocal(routineId, (r) => ({ ...r, ...patch }));
    return next.routines.find((r) => r.id === routineId) ?? null;
  }

  const update: any = {
    updated_at: new Date().toISOString(),
  };

  if (patch.title !== undefined) update.title = patch.title;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.visibility !== undefined) update.visibility = patch.visibility;
  if ((patch as any).copiedFromRoutineId !== undefined)
    update.copied_from_routine_id = (patch as any).copiedFromRoutineId ?? null;

  const { data: routineRow, error } = await supabase
    .from("routines")
    .update(update)
    .eq("id", routineId)
    .select("*")
    .single();

  if (error) {
    const next = updateRoutineLocal(routineId, (r) => ({ ...r, ...patch }));
    return next.routines.find((r) => r.id === routineId) ?? null;
  }

  if (patch.steps) {
    await supabase.from("routine_steps").delete().eq("routine_id", routineId);

    const rows = patch.steps.map((s, idx) => ({
      routine_id: routineId,
      position: idx,
      title: s.title,
      detail: s.detail,
      exercise_id: (s as any).exerciseId ?? null,
      muscle_group: (s as any).muscleGroup ?? null,
      image_url: (s as any).imageUrl ?? null,
    }));

    if (rows.length) await supabase.from("routine_steps").insert(rows);
  }

  const { data: withSteps } = await supabase
    .from("routines")
    .select("*, routine_steps(*)")
    .eq("id", routineId)
    .single();

  return routineFromRow(
    withSteps ?? routineRow,
    (withSteps as any)?.routine_steps ?? [],
  );
}

export async function deleteRoutineDb(routineId: string) {
  if (!hasSupabaseConfig || !supabase) {
    deleteRoutineLocal(routineId);
    return;
  }

  const { error } = await supabase
    .from("routines")
    .delete()
    .eq("id", routineId);
  if (error) deleteRoutineLocal(routineId);
}

export async function copyRoutineDb(routineId: string) {
  if (!hasSupabaseConfig || !supabase) return copyRoutineLocal(routineId);

  const profile = await ensureProfile();
  if (!profile) return copyRoutineLocal(routineId);

  const { data, error } = await supabase
    .from("routines")
    .select("*, routine_steps(*)")
    .eq("id", routineId)
    .single();

  if (error || !data) return copyRoutineLocal(routineId);

  const original = routineFromRow(data, (data as any).routine_steps ?? []);

  return createRoutineDb({
    title: original.title,
    description: original.description,
    category: original.category,
    visibility: original.visibility,
    steps: original.steps,
    copiedFromRoutineId: original.id,
  });
}

export async function isBlockedDb(ownerHandle: string) {
  if (!hasSupabaseConfig || !supabase) return isBlockedLocal(ownerHandle);

  const viewer = await getViewer();
  if (!viewer) return false;

  const { data } = await supabase
    .from("user_blocks")
    .select("id")
    .eq("blocker_id", viewer.id)
    .eq("blocked_handle", ownerHandle)
    .maybeSingle();

  return Boolean(data?.id);
}

export async function blockUserDb(ownerHandle: string) {
  if (!hasSupabaseConfig || !supabase) {
    blockUserLocal(ownerHandle);
    return;
  }

  const viewer = await getViewer();
  if (!viewer) return;

  const { error } = await supabase.from("user_blocks").insert({
    blocker_id: viewer.id,
    blocked_handle: ownerHandle,
  });

  if (error) blockUserLocal(ownerHandle);
}

export async function unblockUserDb(ownerHandle: string) {
  if (!hasSupabaseConfig || !supabase) {
    unblockUserLocal(ownerHandle);
    return;
  }

  const viewer = await getViewer();
  if (!viewer) return;

  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", viewer.id)
    .eq("blocked_handle", ownerHandle);

  if (error) unblockUserLocal(ownerHandle);
}

export async function listReelsDb() {
  const client = sb();

  const { data, error } = await client
    .from("reels")
    .select(
      `
      id,
      description,
      video,
      users:user_id (
        name
      )
    `,
    )
    .order("id", { ascending: false });

  if (error) throw error;

  return (
    data?.map((r: any) => ({
      id: r.id,
      description: r.description,
      video: r.video,
      author: r.users?.name ?? "user",
    })) ?? []
  );
}

export async function listConversationsDb() {
  const client = sb();

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return [];

  const { data, error } = await client
    .from("messages")
    .select(
      `
      id,
      text,
      updated_at,
      users:user_id (
        name
      )
    `,
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (
    data?.map((m: any) => ({
      id: m.id,
      name: m.users?.name ?? "Usuário",
      lastMessage: m.text,
    })) ?? []
  );
}
