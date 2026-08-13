import React from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  searchUsersDb,
  searchRoutinesDb,
  searchContentByHashtagDb,
  getAllUsersDb,
  getFollowingIdsDb,
  getRoutineWorkoutsDb,
  getRoutineDietsDb,
  copyRoutineToUserDb,
  getCopiedRoutineKeysDb,
  type SearchUser,
  type RoutineResult,
  type RoutineItemRow,
  type HashtagItem,
} from "@/lib/ritmofit-db";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/use-toast";
import { ChevronDown, ChevronUp, Copy, Dumbbell, Users, Salad, SearchX, Hash, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/lib/language-context";
import { UserAvatar } from "@/components/shared/user-avatar";
import { FollowButton } from "@/components/shared/follow-button";
import { SearchResultsSkeleton, GridSkeleton } from "@/components/shared/animated-loading";
import { getPostGradient } from "@/lib/post-visuals";
import { ShotThumb } from "@/components/shared/shot-thumb";

// Tags reais mais usadas nas legendas de posts e Shots — dão um ponto de partida
// para quem abre a aba sem saber o que buscar (levantado via consulta na base em
// 2026-07-16). Lista estática: é um empurrão inicial, não um ranking ao vivo.
const SUGGESTED_HASHTAGS = ["linka", "fitness", "recordepessoal", "treino", "caminhada"];

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
  const [hashtagItems, setHashtagItems] = React.useState<HashtagItem[]>([]);
  const [isLoadingHashtags, setIsLoadingHashtags] = React.useState(false);
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
        else if (activeTab === "hashtags") setHashtagItems([]);
        return;
      }

      if (activeTab === "people") setIsLoadingPeople(true);
      else if (activeTab === "workouts") setIsLoadingWorkouts(true);
      else if (activeTab === "diets") setIsLoadingDiets(true);
      else if (activeTab === "hashtags") setIsLoadingHashtags(true);

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
        } else if (activeTab === "hashtags") {
          // Aceita "#treino" ou "treino" — a busca do banco espera a tag sem "#".
          const items = await searchContentByHashtagDb(query.trim().replace(/^#/, ""));
          setHashtagItems(items);
        }
      } catch (err) {
        console.error("Error searching:", err);
      } finally {
        if (activeTab === "people") setIsLoadingPeople(false);
        else if (activeTab === "workouts") setIsLoadingWorkouts(false);
        else if (activeTab === "diets") setIsLoadingDiets(false);
        else if (activeTab === "hashtags") setIsLoadingHashtags(false);
      }
    },
    [activeTab, allUsers, allWorkouts, allDiets, user?.id],
  );

  const handleSuggestedTagClick = (tag: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setSearchQuery(`#${tag}`);
    handleSearch(tag);
  };

  const handleTabChange = (tab: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setActiveTab(tab);
    setSearchQuery("");
    if (tab === "people") setSearchUsers(allUsers);
    else if (tab === "workouts") setSearchWorkouts(allWorkouts);
    else if (tab === "diets") setSearchDiets(allDiets);
    else if (tab === "hashtags") setHashtagItems([]);
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
        : activeTab === "hashtags"
          ? t("search_placeholder_hashtags")
          : t("search_placeholder_diets");

  return (
    <div className="space-y-4 px-4">
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
        {/* Tabs — segmented control style (igual à tela de Comunidade) */}
        <div
          className="flex rounded-xl overflow-hidden py-1 px-1 gap-1 mb-4"
          style={{
            background: "linear-gradient(rgba(255,255,255,.07),rgba(255,255,255,.02))",
            backdropFilter: "blur(20px) saturate(160%)",
            WebkitBackdropFilter: "blur(20px) saturate(160%)",
            border: "1px solid rgba(255,255,255,.10)",
          }}
        >
          <button
            onClick={() => handleTabChange("people")}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-lg transition-colors ${activeTab === "people" ? "bg-brand text-white" : "text-white/50 hover:text-white/80"}`}
          >
            <Users className="h-4 w-4" />
            {t("search_people")}
          </button>
          <button
            onClick={() => handleTabChange("workouts")}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-lg transition-colors ${activeTab === "workouts" ? "bg-brand text-white" : "text-white/50 hover:text-white/80"}`}
          >
            <Dumbbell className="h-4 w-4" />
            {t("search_workouts")}
          </button>
          <button
            onClick={() => handleTabChange("diets")}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-lg transition-colors ${activeTab === "diets" ? "bg-brand text-white" : "text-white/50 hover:text-white/80"}`}
          >
            <Salad className="h-4 w-4" />
            {t("search_diets")}
          </button>
          <button
            onClick={() => handleTabChange("hashtags")}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-lg transition-colors ${activeTab === "hashtags" ? "bg-brand text-white" : "text-white/50 hover:text-white/80"}`}
          >
            <Hash className="h-4 w-4" />
            {t("search_hashtags")}
          </button>
        </div>

        {/* People */}
        <TabsContent value="people" className="space-y-3">
          {isLoadingPeople && <SearchResultsSkeleton />}
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
          {isLoadingWorkouts && <SearchResultsSkeleton rows={4} />}
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
          {isLoadingDiets && <SearchResultsSkeleton rows={4} />}
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

        {/* Hashtags — mesma grade da página /tag/:tag */}
        <TabsContent value="hashtags">
          {isLoadingHashtags ? (
            <GridSkeleton />
          ) : hashtagItems.length === 0 ? (
            <div className="relative flex flex-col items-center justify-center py-16 text-center overflow-hidden">
              <Hash className="absolute opacity-[0.04] h-48 w-48 text-foreground" aria-hidden="true" />
              <div className="relative flex flex-col items-center gap-3">
                <div className="flex items-center justify-center h-14 w-14 rounded-full bg-muted/60">
                  <Hash className="h-7 w-7 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    {searchQuery.trim() ? t("search_no_hashtags") : t("search_hashtags_hint_title")}
                  </p>
                  <p className="text-xs text-muted-foreground max-w-[220px]">
                    {t("search_hashtags_hint")}
                  </p>
                </div>
                {!searchQuery.trim() && (
                  <div className="w-full space-y-2 pt-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                      {t("search_hashtags_suggestions_label")}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {SUGGESTED_HASHTAGS.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => handleSuggestedTagClick(tag)}
                          className="rounded-full px-3 py-1.5 text-xs font-medium text-white/80 hover:text-white transition-colors active:scale-95"
                          style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)" }}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-[5px]">
              {hashtagItems.map((item) => {
                const isShot = item.kind === "shot";
                const thumb = item.photo || item.photos?.[0] || "";
                return (
                  <button
                    key={`${item.kind}-${item.id}`}
                    onClick={() =>
                      isShot
                        ? navigate("/shots", { state: { shotId: item.id } })
                        : navigate(`/post/${item.id}`)
                    }
                    className="relative aspect-square overflow-hidden rounded-[14px] bg-muted active:opacity-80 transition-opacity"
                  >
                    {isShot ? (
                      <ShotThumb
                        videoUrl={item.video_url}
                        className="h-full w-full bg-black object-cover"
                      />
                    ) : thumb ? (
                      <img
                        src={thumb}
                        alt={item.description}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center"
                        style={{ background: getPostGradient(item.id) }}
                      >
                        <Hash className="h-6 w-6 text-white/70" />
                      </div>
                    )}
                    {isShot && (
                      <div className="absolute right-1.5 top-1.5 rounded-md bg-black/55 p-1">
                        <Video className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
