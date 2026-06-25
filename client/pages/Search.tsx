import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  searchUsersDb,
  searchRoutinesDb,
  getAllUsersDb,
  getFollowingIdsDb,
  getRoutineWorkoutsDb,
  getRoutineDietsDb,
  copyRoutineToUserDb,
  getCopiedRoutineKeysDb,
  type SearchUser,
  type RoutineResult,
  type RoutineItemRow,
} from "@/lib/ritmofit-db";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/use-toast";
import { ChevronDown, ChevronUp, Copy, Dumbbell, Users, Salad, SearchX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/lib/language-context";
import { UserAvatar } from "@/components/shared/user-avatar";
import { FollowButton } from "@/components/shared/follow-button";

type RoutineCardProps = {
  routine: RoutineResult;
  isExpanded: boolean;
  isLoadingItems: boolean;
  items: RoutineItemRow[];
  isCopying: boolean;
  isCopied: boolean;
  isOwn: boolean;
  loadingText: string;
  unnamedText: string;
  copyingText: string;
  copyBtnText: string;
  viewRoutineText: string;
  noItemsText: string;
  onToggleExpand: (routine: RoutineResult) => void;
  onCopy: (routine: RoutineResult) => void;
  onNavigate: (userId: string) => void;
  onGoToRoutines: () => void;
};

function RoutineCard({
  routine,
  isExpanded,
  isLoadingItems,
  items,
  isCopying,
  isCopied,
  isOwn,
  loadingText,
  unnamedText,
  copyingText,
  copyBtnText,
  viewRoutineText,
  noItemsText,
  onToggleExpand,
  onCopy,
  onNavigate,
  onGoToRoutines,
}: RoutineCardProps) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "linear-gradient(rgba(255,255,255,.09),rgba(255,255,255,.03))",
        backdropFilter: "blur(20px) saturate(170%)",
        WebkitBackdropFilter: "blur(20px) saturate(170%)",
        border: "1px solid rgba(255,255,255,.10)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.18)",
      }}
    >
        {/* Routine name — prominent */}
        <p className="font-semibold text-sm mb-2">{routine.routineName ?? unnamedText}</p>

        {/* User info row + action buttons */}
        <div className="flex items-center gap-2">
          {/* Small user avatar + name */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <UserAvatar
              photo={routine.userPhoto}
              nickname={routine.userNickname}
              className="h-5 w-5 flex-shrink-0"
            />
            <button
              onClick={() => onNavigate(routine.userId)}
              className="text-xs text-muted-foreground hover:text-brand transition-colors truncate"
            >
              {routine.userNickname}
            </button>
          </div>

          {/* Copy button */}
          {!isCopied ? (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full h-7 px-2.5 gap-1 text-xs flex-shrink-0"
              onClick={() => onCopy(routine)}
              disabled={isCopying || isOwn}
            >
              <Copy className="h-3 w-3" />
              {isCopying ? copyingText : copyBtnText}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="default"
              className="rounded-full h-7 px-2.5 gap-1 text-xs flex-shrink-0"
              onClick={onGoToRoutines}
            >
              {viewRoutineText}
            </Button>
          )}

          {/* Expand toggle */}
          <button
            onClick={() => onToggleExpand(routine)}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 p-1"
            aria-label="Ver itens"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Dropdown items */}
        {isExpanded && (
          <div className="mt-3 pt-3 space-y-1" style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
            {isLoadingItems ? (
              <p className="text-xs text-white/40 text-center py-2">{loadingText}</p>
            ) : items.length === 0 ? (
              <p className="text-xs text-white/40 text-center py-2">{noItemsText}</p>
            ) : (
              items.map((item) => (
                <div key={item.id} className="flex items-center gap-2 py-1 px-2 rounded-md" style={{ background: "rgba(255,255,255,.06)" }}>
                  <span className="text-xs font-medium flex-1 truncate">{item.itemName}</span>
                </div>
              ))
            )}
          </div>
        )}
    </div>
  );
}

export default function Search() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = React.useState("people");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [allUsers, setAllUsers] = React.useState<SearchUser[]>([]);
  const [searchUsers, setSearchUsers] = React.useState<SearchUser[]>([]);
  const [searchWorkouts, setSearchWorkouts] = React.useState<RoutineResult[]>([]);
  const [allWorkouts, setAllWorkouts] = React.useState<RoutineResult[]>([]);
  const [searchDiets, setSearchDiets] = React.useState<RoutineResult[]>([]);
  const [allDiets, setAllDiets] = React.useState<RoutineResult[]>([]);
  const [isLoadingPeople, setIsLoadingPeople] = React.useState(false);
  const [isLoadingWorkouts, setIsLoadingWorkouts] = React.useState(false);
  const [isLoadingDiets, setIsLoadingDiets] = React.useState(false);
  const [followingIds, setFollowingIds] = React.useState<Set<string>>(new Set());

  // Expanded dropdown state: key = "userId::routineName"
  const [expandedKeys, setExpandedKeys] = React.useState<Set<string>>(new Set());
  // Cached items per userId
  const [itemsCache, setItemsCache] = React.useState<Map<string, RoutineItemRow[]>>(new Map());
  const [itemsLoading, setItemsLoading] = React.useState<Set<string>>(new Set());
  const [copyingKeys, setCopyingKeys] = React.useState<Set<string>>(new Set());
  const [copiedKeys, setCopiedKeys] = React.useState<Set<string>>(new Set());
  const searchDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load all users on mount
  React.useEffect(() => {
    if (!user) return;
    setIsLoadingPeople(true);
    Promise.all([getAllUsersDb(user.id), getFollowingIdsDb(), getCopiedRoutineKeysDb(user.id)])
      .then(([users, followingIdsList, copiedKeys]) => {
        setAllUsers(users);
        setSearchUsers(users);
        setFollowingIds(new Set(followingIdsList));
        setCopiedKeys(copiedKeys);
      })
      .catch((err) => console.error("Error loading users:", err))
      .finally(() => setIsLoadingPeople(false));
  }, [user]);

  // Load all routines when switching to workouts/diets tabs
  React.useEffect(() => {
    if (activeTab === "workouts" && allWorkouts.length === 0) {
      setIsLoadingWorkouts(true);
      searchRoutinesDb("", 1, user?.id)
        .then((data) => { setAllWorkouts(data); setSearchWorkouts(data); })
        .catch((err) => console.error("Error loading workouts:", err))
        .finally(() => setIsLoadingWorkouts(false));
    } else if (activeTab === "diets" && allDiets.length === 0) {
      setIsLoadingDiets(true);
      searchRoutinesDb("", 2, user?.id)
        .then((data) => { setAllDiets(data); setSearchDiets(data); })
        .catch((err) => console.error("Error loading diets:", err))
        .finally(() => setIsLoadingDiets(false));
    }
  }, [activeTab, user?.id]);

  const handleSearch = React.useCallback(
    async (query: string) => {
      if (!query.trim()) {
        if (activeTab === "people") setSearchUsers(allUsers);
        else if (activeTab === "workouts") setSearchWorkouts(allWorkouts);
        else if (activeTab === "diets") setSearchDiets(allDiets);
        return;
      }

      if (activeTab === "people") setIsLoadingPeople(true);
      else if (activeTab === "workouts") setIsLoadingWorkouts(true);
      else if (activeTab === "diets") setIsLoadingDiets(true);

      try {
        if (activeTab === "people") {
          const users = await searchUsersDb(query);
          setSearchUsers(users.filter((u) => u.id !== user?.id));
        } else if (activeTab === "workouts") {
          const workouts = await searchRoutinesDb(query, 1, user?.id);
          setSearchWorkouts(workouts);
        } else if (activeTab === "diets") {
          const diets = await searchRoutinesDb(query, 2, user?.id);
          setSearchDiets(diets);
        }
      } catch (err) {
        console.error("Error searching:", err);
      } finally {
        if (activeTab === "people") setIsLoadingPeople(false);
        else if (activeTab === "workouts") setIsLoadingWorkouts(false);
        else if (activeTab === "diets") setIsLoadingDiets(false);
      }
    },
    [activeTab, allUsers, allWorkouts, allDiets, user?.id],
  );

  const handleTabChange = (tab: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setActiveTab(tab);
    setSearchQuery("");
    if (tab === "people") setSearchUsers(allUsers);
    else if (tab === "workouts") setSearchWorkouts(allWorkouts);
    else if (tab === "diets") setSearchDiets(allDiets);
  };

  const handleToggleExpand = React.useCallback(
    async (routine: RoutineResult) => {
      const key = `${routine.userId}::${routine.routineId ?? routine.routineName}`;
      const isExpanded = expandedKeys.has(key);

      if (isExpanded) {
        setExpandedKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });
        return;
      }

      setExpandedKeys((prev) => new Set(prev).add(key));

      if (!itemsCache.has(key)) {
        setItemsLoading((prev) => new Set(prev).add(key));
        try {
          const items = routine.routineType === 1
            ? await getRoutineWorkoutsDb(routine.userId, routine.routineName)
            : await getRoutineDietsDb(routine.userId, routine.routineName);
          setItemsCache((prev) => new Map(prev).set(key, items));
        } catch {
          setItemsCache((prev) => new Map(prev).set(key, []));
        } finally {
          setItemsLoading((prev) => { const s = new Set(prev); s.delete(key); return s; });
        }
      }
    },
    [expandedKeys, itemsCache],
  );

  const handleCopy = React.useCallback(
    async (routine: RoutineResult) => {
      if (!user) return;
      const key = `${routine.userId}::${routine.routineId ?? routine.routineName}`;
      setCopyingKeys((prev) => new Set(prev).add(key));
      try {
        await copyRoutineToUserDb(routine.userId, user.id, routine.routineType as 1 | 2 | 3, routine.routineName);
        setCopiedKeys((prev) => new Set(prev).add(key));
        toast({
          title: routine.routineType === 1 ? t("search_copy_workout_success") : t("search_copy_diet_success"),
          description: t("search_copy_desc").replace("{name}", routine.routineName ?? t("search_routine_unnamed")),
        });
      } catch (err: any) {
        toast({ title: t("search_copy_error"), description: err.message || t("search_copy_error_retry"), variant: "destructive" });
      } finally {
        setCopyingKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });
      }
    },
    [user, t],
  );

  const searchPlaceholder =
    activeTab === "people"
      ? t("search_placeholder_people")
      : activeTab === "workouts"
        ? t("search_placeholder_workouts")
        : t("search_placeholder_diets");

  return (
    <div className="space-y-4">
      <Input
        placeholder={searchPlaceholder}
        value={searchQuery}
        onChange={(e) => {
          const value = e.target.value;
          setSearchQuery(value);
          if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
          searchDebounceRef.current = setTimeout(() => handleSearch(value), 350);
        }}
        className="rounded-full"
      />

      <Tabs defaultValue="people" value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="people">{t("search_people")}</TabsTrigger>
          <TabsTrigger value="workouts">{t("search_workouts")}</TabsTrigger>
          <TabsTrigger value="diets">{t("search_diets")}</TabsTrigger>
        </TabsList>

        {/* People */}
        <TabsContent value="people" className="space-y-3">
          {isLoadingPeople && <div className="text-center py-6 text-sm text-muted-foreground">{t("search_loading")}</div>}
          {!isLoadingPeople && searchUsers.length === 0 && (
            <div className="relative flex flex-col items-center justify-center py-16 text-center overflow-hidden">
              <Users className="absolute opacity-[0.04] h-48 w-48 text-foreground" aria-hidden="true" />
              <div className="relative flex flex-col items-center gap-3">
                <div className="flex items-center justify-center h-14 w-14 rounded-full bg-muted/60">
                  <SearchX className="h-7 w-7 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{t("search_no_people")}</p>
                  <p className="text-xs text-muted-foreground max-w-[220px]">
                    {t("search_no_people_hint")}
                  </p>
                </div>
              </div>
            </div>
          )}
          {searchUsers.map((u) => (
            <div
              key={u.id}
              className="rounded-xl p-4 transition-all active:opacity-80"
              style={{
                background: "linear-gradient(rgba(255,255,255,.09),rgba(255,255,255,.03))",
                backdropFilter: "blur(20px) saturate(170%)",
                WebkitBackdropFilter: "blur(20px) saturate(170%)",
                border: "1px solid rgba(255,255,255,.10)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.18)",
              }}
            >
                <div className="flex items-start gap-3 justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <UserAvatar
                      photo={u.photo}
                      nickname={u.nickname}
                      size="lg"
                      className="flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => navigate(`/usuario/${u.id}`)}
                        className="font-medium text-sm hover:text-brand transition-colors text-left"
                      >
                        {u.nickname}
                      </button>
                      {u.bio && <p className="text-xs text-white/50 line-clamp-2 mt-1">{u.bio}</p>}
                    </div>
                  </div>
                  {u.id !== user?.id && (
                    <FollowButton
                      targetUserId={u.id}
                      initialIsFollowing={followingIds.has(u.id)}
                    />
                  )}
                </div>
            </div>
          ))}
        </TabsContent>

        {/* Workouts */}
        <TabsContent value="workouts" className="space-y-3">
          {isLoadingWorkouts && <div className="text-center py-6 text-sm text-muted-foreground">{t("search_loading")}</div>}
          {!isLoadingWorkouts && searchWorkouts.length === 0 && (
            <div className="relative flex flex-col items-center justify-center py-16 text-center overflow-hidden">
              <Dumbbell className="absolute opacity-[0.04] h-48 w-48 text-foreground" aria-hidden="true" />
              <div className="relative flex flex-col items-center gap-3">
                <div className="flex items-center justify-center h-14 w-14 rounded-full bg-muted/60">
                  <Dumbbell className="h-7 w-7 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{t("search_no_workouts")}</p>
                  <p className="text-xs text-muted-foreground max-w-[220px]">
                    {t("search_no_workouts_hint")}
                  </p>
                </div>
              </div>
            </div>
          )}
          {searchWorkouts.map((routine) => (
            <RoutineCard
              key={`${routine.userId}-${routine.routineName ?? "__unnamed__"}`}
              routine={routine}
              isExpanded={expandedKeys.has(`${routine.userId}::${routine.routineId ?? routine.routineName}`)}
              isLoadingItems={itemsLoading.has(`${routine.userId}::${routine.routineId ?? routine.routineName}`)}
              items={itemsCache.get(`${routine.userId}::${routine.routineId ?? routine.routineName}`) ?? []}
              isCopying={copyingKeys.has(`${routine.userId}::${routine.routineId ?? routine.routineName}`)}
              isCopied={copiedKeys.has(`${routine.userId}::${routine.routineId ?? routine.routineName}`)}
              isOwn={routine.userId === user?.id}
              loadingText={t("search_loading")}
              unnamedText={t("search_routine_unnamed")}
              copyingText={t("search_copying")}
              copyBtnText={t("search_copy_btn")}
              viewRoutineText={t("search_view_routine")}
              noItemsText={t("search_no_items")}
              onToggleExpand={handleToggleExpand}
              onCopy={handleCopy}
              onNavigate={(id) => navigate(`/usuario/${id}`)}
              onGoToRoutines={() => navigate("/metas?tab=rotinas")}
            />
          ))}
        </TabsContent>

        {/* Diets */}
        <TabsContent value="diets" className="space-y-3">
          {isLoadingDiets && <div className="text-center py-6 text-sm text-muted-foreground">{t("search_loading")}</div>}
          {!isLoadingDiets && searchDiets.length === 0 && (
            <div className="relative flex flex-col items-center justify-center py-16 text-center overflow-hidden">
              <Salad className="absolute opacity-[0.04] h-48 w-48 text-foreground" aria-hidden="true" />
              <div className="relative flex flex-col items-center gap-3">
                <div className="flex items-center justify-center h-14 w-14 rounded-full bg-muted/60">
                  <Salad className="h-7 w-7 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{t("search_no_diets")}</p>
                  <p className="text-xs text-muted-foreground max-w-[220px]">
                    {t("search_no_diets_hint")}
                  </p>
                </div>
              </div>
            </div>
          )}
          {searchDiets.map((routine) => (
            <RoutineCard
              key={`${routine.userId}-${routine.routineName ?? "__unnamed__"}`}
              routine={routine}
              isExpanded={expandedKeys.has(`${routine.userId}::${routine.routineId ?? routine.routineName}`)}
              isLoadingItems={itemsLoading.has(`${routine.userId}::${routine.routineId ?? routine.routineName}`)}
              items={itemsCache.get(`${routine.userId}::${routine.routineId ?? routine.routineName}`) ?? []}
              isCopying={copyingKeys.has(`${routine.userId}::${routine.routineId ?? routine.routineName}`)}
              isCopied={copiedKeys.has(`${routine.userId}::${routine.routineId ?? routine.routineName}`)}
              isOwn={routine.userId === user?.id}
              loadingText={t("search_loading")}
              unnamedText={t("search_routine_unnamed")}
              copyingText={t("search_copying")}
              copyBtnText={t("search_copy_btn")}
              viewRoutineText={t("search_view_routine")}
              noItemsText={t("search_no_items")}
              onToggleExpand={handleToggleExpand}
              onCopy={handleCopy}
              onNavigate={(id) => navigate(`/usuario/${id}`)}
              onGoToRoutines={() => navigate("/metas?tab=rotinas")}
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
