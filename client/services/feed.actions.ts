import type { Goal, GoalIncentiveKey, Routine } from "@/lib/ritmofit";
import {
  addGoalCommentDb,
  blockUserDb,
  copyRoutineDb,
  listGoalComments as listGoalCommentsDb,
  toggleGoalIncentiveDb,
  updateGoalDb,
} from "@/lib/ritmofit-db";

export async function listGoalComments(goalId: string) {
  return listGoalCommentsDb(goalId);
}

export async function addGoalComment(goalId: string, text: string) {
  return addGoalCommentDb(goalId, text);
}

export async function toggleGoalIncentive(
  goalId: string,
  kind: GoalIncentiveKey,
): Promise<Goal | null> {
  return toggleGoalIncentiveDb(goalId, kind);
}

export async function updateGoal(
  goalId: string,
  patch: Partial<Goal>,
): Promise<Goal | null> {
  return updateGoalDb(goalId, patch);
}

export async function copyRoutine(routineId: string): Promise<Routine | null> {
  return copyRoutineDb(routineId);
}

export async function blockUser(ownerHandle: string) {
  return blockUserDb(ownerHandle);
}
