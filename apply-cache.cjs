// Script to wrap DB functions with cached() calls
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client/lib/ritmofit-db.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// Functions to cache: [functionName, cacheKey, ttl, needsArgs]
// needsArgs = array of param names to include in cache key, or null for no-arg functions
const functionsToCache = [
  // LONG TTL (5min) — catalogs, rarely change
  ['getProgrammedGoalsDb', 'programmedGoals', 'CACHE_TTL_LONG', null],
  ['getWorkoutsDb', 'workouts', 'CACHE_TTL_LONG', null],
  ['getDietsDb', 'diets', 'CACHE_TTL_LONG', null],
  ['getHabitsDb', 'habits', 'CACHE_TTL_LONG', null],
  ['getAllBadgesDb', 'allBadges', 'CACHE_TTL_LONG', null],
  ['getCatalogWorkoutsFromDb', 'catalogWorkouts', 'CACHE_TTL_LONG', null],
  ['getCatalogDietsFromDb', 'catalogDiets', 'CACHE_TTL_LONG', null],

  // MEDIUM TTL (60s) — user lists that change occasionally
  ['getUserGoalsDb', 'userGoals', 'CACHE_TTL_MEDIUM', null],
  ['getUserSelectedGoalIdsDb', 'selectedGoalIds', 'CACHE_TTL_MEDIUM', null],
  ['getFollowingIdsDb', 'followingIds', 'CACHE_TTL_MEDIUM', null],
  ['getConversationsDb', 'conversations', 'CACHE_TTL_MEDIUM', null],
  ['getActiveStoriesDb', 'activeStories', 'CACHE_TTL_MEDIUM', null],
  ['getShotsDb', 'shots', 'CACHE_TTL_MEDIUM', null],
  ['getRankingDb', 'ranking', 'CACHE_TTL_MEDIUM', null],
  ['getNotificationsDb', 'notifications', 'CACHE_TTL_MEDIUM', null],
  ['getPendingInvitesDb', 'pendingInvites', 'CACHE_TTL_MEDIUM', null],
  ['getPendingGroupRequestsDb', 'pendingGroupRequests', 'CACHE_TTL_MEDIUM', null],
  ['getFollowingGroupsDb', 'followingGroups', 'CACHE_TTL_MEDIUM', null],
  ['getAllUsersDb', 'allUsers', 'CACHE_TTL_MEDIUM', null],

  // SHORT TTL (30s) — per-user/per-entity data
  ['getUserStatsDb', 'userStats', 'CACHE_TTL_SHORT', ['userId']],
  ['getUserPostsDb', 'userPosts', 'CACHE_TTL_SHORT', ['userId']],
  ['getUserRoutinesDb', 'userRoutines', 'CACHE_TTL_SHORT', ['userId']],
  ['getUserWorkoutsDb', 'userWorkouts', 'CACHE_TTL_SHORT', ['userId']],
  ['getUserDietsDb', 'userDiets', 'CACHE_TTL_SHORT', ['userId']],
  ['getUserHabitsDb', 'userHabits', 'CACHE_TTL_SHORT', ['userId']],
  ['getUserBadgesDb', 'userBadges', 'CACHE_TTL_SHORT', ['userId']],
  ['getUserShotsDb', 'userShots', 'CACHE_TTL_SHORT', ['userId']],
  ['getUserDuelGroupsDb', 'userDuelGroups', 'CACHE_TTL_SHORT', ['userId']],
  ['getFollowersDb', 'followers', 'CACHE_TTL_SHORT', ['userId']],
  ['getFollowingDb', 'following', 'CACHE_TTL_SHORT', ['userId']],
  ['getUnreadMessageCountDb', 'unreadMsgCount', 'CACHE_TTL_SHORT', null],
  ['getUnreadNotificationsCountDb', 'unreadNotifCount', 'CACHE_TTL_SHORT', null],
  ['getPostByIdDb', 'post', 'CACHE_TTL_SHORT', ['postId']],
  ['getPostCommentsDb', 'postComments', 'CACHE_TTL_SHORT', ['postId']],
  ['getPostLikesDb', 'postLikes', 'CACHE_TTL_SHORT', ['postId']],
  ['getEnrichedDuelGroupsDb', 'enrichedDuelGroups', 'CACHE_TTL_SHORT', ['userId']],
  ['getCompletedRoutinesTodayDb', 'completedRoutines', 'CACHE_TTL_SHORT', ['userId']],
  ['getTodayCheckInDb', 'todayCheckIn', 'CACHE_TTL_SHORT', ['userId']],
  ['getWeekCheckInsDb', 'weekCheckIns', 'CACHE_TTL_SHORT', ['userId']],
  ['getCheckInHistoryDb', 'checkInHistory', 'CACHE_TTL_SHORT', ['userId']],
  ['getWorkoutHistoryDb', 'workoutHistory', 'CACHE_TTL_SHORT', ['userId']],
  ['getGroupCheckInsDb', 'groupCheckIns', 'CACHE_TTL_SHORT', ['groupId']],
  ['getGroupParticipantsDb', 'groupParticipants', 'CACHE_TTL_SHORT', ['groupId']],
  ['getCheckInCommentsDb', 'checkInComments', 'CACHE_TTL_SHORT', ['checkInId']],
  ['getCommercialProfileDb', 'commercialProfile', 'CACHE_TTL_SHORT', ['userId']],
  ['getTodayHydrationDb', 'todayHydration', 'CACHE_TTL_SHORT', ['userId']],
  ['getTodayMoodDb', 'todayMood', 'CACHE_TTL_SHORT', ['userId']],
  ['getShotCommentsDb', 'shotComments', 'CACHE_TTL_SHORT', ['shotId']],
  ['getMessageReactionsDb', 'msgReactions', 'CACHE_TTL_SHORT', ['messageIds']],
  ['getCheckInReactionsDb', 'checkInReactions', 'CACHE_TTL_SHORT', ['checkInIds']],
];

let applied = 0;
let skipped = 0;

for (const [fnName, cacheKey, ttl, args] of functionsToCache) {
  // Find the function declaration
  // Pattern: "export async function fnName(" possibly with params, then "): Promise<...> {"
  // We want to insert the cache line right after the opening brace of the function

  const fnRegex = new RegExp(
    `(export async function ${fnName}\\([^)]*\\):\\s*Promise<[^>]+(?:<[^>]+>)*>\\s*\\{)`,
    's'
  );

  const match = content.match(fnRegex);
  if (!match) {
    console.log(`SKIP: ${fnName} — pattern not found`);
    skipped++;
    continue;
  }

  // Check if already cached
  if (content.includes(`cached("${cacheKey}`)) {
    console.log(`SKIP: ${fnName} — already cached`);
    skipped++;
    continue;
  }

  const fnHeader = match[1];
  const insertPos = content.indexOf(fnHeader) + fnHeader.length;

  // Build the cache key expression
  let cacheKeyExpr;
  if (!args || args.length === 0) {
    cacheKeyExpr = `"${cacheKey}"`;
  } else if (args.length === 1) {
    cacheKeyExpr = `\`${cacheKey}:\${${args[0]}}\``;
  } else {
    const parts = args.map(a => `\${${a}}`).join(':');
    cacheKeyExpr = `\`${cacheKey}:${parts}\``;
  }

  // Find the guard clauses (if (!hasSupabaseConfig...) and viewer check)
  // We need to find what comes after the opening brace
  const afterHeader = content.substring(insertPos);

  // Find the closing brace of this function by counting braces
  let braceCount = 1;
  let funcEndIdx = -1;
  for (let i = 0; i < afterHeader.length; i++) {
    if (afterHeader[i] === '{') braceCount++;
    if (afterHeader[i] === '}') braceCount--;
    if (braceCount === 0) {
      funcEndIdx = insertPos + i;
      break;
    }
  }

  if (funcEndIdx === -1) {
    console.log(`SKIP: ${fnName} — couldn't find end of function`);
    skipped++;
    continue;
  }

  const funcBody = content.substring(insertPos, funcEndIdx);

  // Find guard clauses to keep outside the cache
  // Pattern: lines starting with "if (!hasSupabaseConfig" or "const viewer" or "if (!viewer"
  const lines = funcBody.split('\n');
  let guardEndLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '') continue;
    if (trimmed.startsWith('if (!hasSupabaseConfig')) { guardEndLine = i; continue; }
    if (trimmed.startsWith('return [];') || trimmed.startsWith('return 0;') || trimmed.startsWith('return null;') || trimmed.startsWith('return { ') || trimmed.startsWith('}')) {
      if (i === guardEndLine + 1 || (i === guardEndLine + 2 && lines[guardEndLine + 1].trim() === '')) {
        guardEndLine = i;
        continue;
      }
    }
    break;
  }

  // Reconstruct: guards + cached wrapper around the rest
  const guardPart = lines.slice(0, guardEndLine + 1).join('\n');
  const bodyPart = lines.slice(guardEndLine + 1).join('\n');

  const newFuncBody = `${guardPart}\n  return cached(${cacheKeyExpr}, ${ttl}, async () => {${bodyPart}\n  });\n`;

  // Also need to fix `supabase` references inside cached to use `supabase!` since we checked above
  content = content.substring(0, insertPos) + newFuncBody + content.substring(funcEndIdx);

  console.log(`OK: ${fnName} → cached(${cacheKeyExpr}, ${ttl})`);
  applied++;
}

console.log(`\nDone: ${applied} applied, ${skipped} skipped`);
fs.writeFileSync(filePath, content, 'utf-8');
