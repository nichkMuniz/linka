import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  searchUsersDb,
  searchRoutinesDb,
  getAllUsersDb,
  followUserDb,
  unfollowUserDb,
  isFollowingDb,
  getRoutineWorkoutsDb,
  getRoutineDietsDb,
  copyRoutineToUserDb,
  type SearchUser,
  type RoutineResult,
  type RoutineItemRow,
} from "@/lib/ritmofit-db";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/use-toast";
import { UserPlus, UserCheck, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/lib/language-context";

type RoutineCardProps = {
  routine: RoutineResult;
  isExpanded: boolean;
  isLoadingItems: boolean;
  items: RoutineItemRow[];
  isCopying: boolean;
  isOwn: boolean;
  loadingText: string;
  onToggleExpand: (routine: RoutineResult) => void;
  onCopy: (routine: RoutineResult) => void;
  onNavigate: (userId: string) => void;
};

function RoutineCard({
  routine,
  isExpanded,
  isLoadingItems,
  items,
  isCopying,
  isOwn,
  loadingText,
  onToggleExpand,
  onCopy,
  onNavigate,
}: RoutineCardProps) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        {/* Routine name — prominent */}
        <p className="font-semibold text-sm mb-2">{routine.routineName}</p>

        {/* User info row + action buttons */}
        <div className="flex items-center gap-2">
          {/* Small user avatar + name */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {routine.userPhoto ? (
              <img
                src={routine.userPhoto}
                alt={routine.userNickname}
                className="h-5 w-5 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="h-5 w-5 rounded-full bg-muted flex-shrink-0" />
            )}
            <button
              onClick={() => onNavigate(routine.userId)}
              className="text-xs text-muted-foreground hover:text-brand transition-colors truncate"
            >
              {routine.userNickname}
            </button>
          </div>

          {/* Copy button */}
          <Button
            size="sm"
            variant="outline"
            className="rounded-full h-7 px-2.5 gap-1 text-xs flex-shrink-0"
            onClick={() => onCopy(routine)}
            disabled={isCopying || isOwn}
          >
            <Copy className="h-3 w-3" />
            {isCopying ? "Copiando..." : "Copiar"}
          </Button>

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
          <div className="mt-3 border-t border-border/40 pt-3 space-y-1">
            {isLoadingItems ? (
              <p className="text-xs text-muted-foreground text-center py-2">{loadingText}</p>
            ) : items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">Nenhum item encontrado</p>
            ) : (
              items.map((item) => (
                <div key={item.id} className="flex items-center gap-2 py-1 px-2 rounded-md bg-muted/30">
                  <span className="text-xs font-medium flex-1 truncate">{item.itemName}</span>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
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
  const [isLoading, setIsLoading] = React.useState(false);
  const [followingIds, setFollowingIds] = React.useState<Set<string>>(new Set());
  const [followingLoadingIds, setFollowingLoadingIds] = React.useState<Set<string>>(new Set());

  // Expanded dropdown state: key = "userId::routineName"
  const [expandedKeys, setExpandedKeys] = React.useState<Set<string>>(new Set());
  // Cached items per userId
  const [itemsCache, setItemsCache] = React.useState<Map<string, RoutineItemRow[]>>(new Map());
  const [itemsLoading, setItemsLoading] = React.useState<Set<string>>(new Set());
  const [copyingKeys, setCopyingKeys] = React.useState<Set<string>>(new Set());
  const searchDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load all users on mount
  React.useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    getAllUsersDb(user.id)
      .then(async (users) => {
        setAllUsers(users);
        setSearchUsers(users);
        // Check all follow statuses in parallel instead of sequentially
        const followResults = await Promise.all(users.map((u) => isFollowingDb(u.id)));
        const ids = new Set<string>();
        users.forEach((u, i) => { if (followResults[i]) ids.add(u.id); });
        setFollowingIds(ids);
      })
      .catch((err) => console.error("Error loading users:", err))
      .finally(() => setIsLoading(false));
  }, [user]);

  // Load all routines when switching to workouts/diets tabs
  React.useEffect(() => {
    if (activeTab === "workouts" && allWorkouts.length === 0) {
      setIsLoading(true);
      searchRoutinesDb("", 1, user?.id)
        .then((data) => { setAllWorkouts(data); setSearchWorkouts(data); })
        .catch((err) => console.error("Error loading workouts:", err))
        .finally(() => setIsLoading(false));
    } else if (activeTab === "diets" && allDiets.length === 0) {
      setIsLoading(true);
      searchRoutinesDb("", 2, user?.id)
        .then((data) => { setAllDiets(data); setSearchDiets(data); })
        .catch((err) => console.error("Error loading diets:", err))
        .finally(() => setIsLoading(false));
    }
  }, [activeTab]);

  const handleSearch = React.useCallback(
    async (query: string) => {
      if (!query.trim()) {
        if (activeTab === "people") setSearchUsers(allUsers);
        else if (activeTab === "workouts") setSearchWorkouts(allWorkouts);
        else if (activeTab === "diets") setSearchDiets(allDiets);
        return;
      }

      setIsLoading(true);
      try {
        if (activeTab === "people") {
          const users = await searchUsersDb(query);
          setSearchUsers(users);
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
        setIsLoading(false);
      }
    },
    [activeTab, allUsers, allWorkouts, allDiets],
  );

  const handleToggleFollow = React.useCallback(
    async (userId: string) => {
      if (!user || followingLoadingIds.has(userId)) return;
      setFollowingLoadingIds((prev) => new Set(prev).add(userId));
      const isCurrentlyFollowing = followingIds.has(userId);
      try {
        if (isCurrentlyFollowing) {
          await unfollowUserDb(userId);
          setFollowingIds((prev) => { const s = new Set(prev); s.delete(userId); return s; });
          toast({ title: "Deixou de seguir", description: "Você deixou de seguir este usuário." });
        } else {
          await followUserDb(userId);
          setFollowingIds((prev) => new Set(prev).add(userId));
          toast({ title: "Seguindo!", description: "Você começou a seguir este usuário." });
        }
      } catch (err: any) {
        // Rollback optimistic state
        if (isCurrentlyFollowing) {
          setFollowingIds((prev) => new Set(prev).add(userId));
        } else {
          setFollowingIds((prev) => { const s = new Set(prev); s.delete(userId); return s; });
        }
        toast({ title: "Erro", description: err.message || "Tente novamente.", variant: "destructive" });
      } finally {
        setFollowingLoadingIds((prev) => { const s = new Set(prev); s.delete(userId); return s; });
      }
    },
    [followingIds, followingLoadingIds, user],
  );

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchQuery("");
    if (tab === "people") setSearchUsers(allUsers);
    else if (tab === "workouts") setSearchWorkouts(allWorkouts);
    else if (tab === "diets") setSearchDiets(allDiets);
  };

  const handleToggleExpand = React.useCallback(
    async (routine: RoutineResult) => {
      const key = `${routine.userId}::${routine.routineName}`;
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
      const key = `${routine.userId}::${routine.routineName}`;
      setCopyingKeys((prev) => new Set(prev).add(key));
      try {
        await copyRoutineToUserDb(routine.userId, user.id, routine.routineType as 1 | 2, routine.routineName);
        toast({
          title: routine.routineType === 1 ? "Treino copiado!" : "Dieta copiada!",
          description: `"${routine.routineName}" foi adicionado(a) à sua conta.`,
        });
      } catch (err: any) {
        toast({ title: "Erro ao copiar", description: err.message || "Tente novamente.", variant: "destructive" });
      } finally {
        setCopyingKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });
      }
    },
    [user],
  );

  return (
    <div className="space-y-4">
      <Input
        placeholder={t("search_placeholder")}
        value={searchQuery}
        onChange={(e) => {
          const value = e.target.value;
          setSearchQuery(value);
          if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
          searchDebounceRef.current = setTimeout(() => handleSearch(value), 350);
        }}
        className="rounded-full"
        autoFocus
      />

      <Tabs defaultValue="people" value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="people">{t("search_people")}</TabsTrigger>
          <TabsTrigger value="workouts">{t("search_workouts")}</TabsTrigger>
          <TabsTrigger value="diets">{t("search_diets")}</TabsTrigger>
        </TabsList>

        {/* People */}
        <TabsContent value="people" className="space-y-3">
          {isLoading && <div className="text-center py-6 text-sm text-muted-foreground">{t("search_loading")}</div>}
          {!isLoading && searchUsers.length === 0 && (
            <div className="text-center py-6 text-sm text-muted-foreground">{t("search_no_people")}</div>
          )}
          {searchUsers.map((u) => (
            <Card key={u.id} className="border-border/60 hover:bg-muted/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-3 justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {u.photo ? (
                      <img src={u.photo} alt={u.nickname} className="h-12 w-12 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-muted flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => navigate(`/usuario/${u.id}`)}
                        className="font-medium text-sm hover:text-brand transition-colors text-left"
                      >
                        {u.nickname}
                      </button>
                      {u.bio && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{u.bio}</p>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={followingIds.has(u.id) ? "secondary" : "default"}
                    className="shrink-0 rounded-full gap-2"
                    onClick={() => handleToggleFollow(u.id)}
                    disabled={followingLoadingIds.has(u.id)}
                  >
                    {followingIds.has(u.id) ? (
                      <><UserCheck className="h-4 w-4" />{t("search_following")}</>
                    ) : (
                      <><UserPlus className="h-4 w-4" />{t("search_follow")}</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Workouts */}
        <TabsContent value="workouts" className="space-y-3">
          {isLoading && <div className="text-center py-6 text-sm text-muted-foreground">{t("search_loading")}</div>}
          {!isLoading && searchWorkouts.length === 0 && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              {t("search_no_workouts")}
            </div>
          )}
          {searchWorkouts.map((routine) => (
            <RoutineCard
              key={`${routine.userId}-${routine.routineName}`}
              routine={routine}
              isExpanded={expandedKeys.has(`${routine.userId}::${routine.routineName}`)}
              isLoadingItems={itemsLoading.has(`${routine.userId}::${routine.routineName}`)}
              items={itemsCache.get(`${routine.userId}::${routine.routineName}`) ?? []}
              isCopying={copyingKeys.has(`${routine.userId}::${routine.routineName}`)}
              isOwn={routine.userId === user?.id}
              loadingText={t("loading")}
              onToggleExpand={handleToggleExpand}
              onCopy={handleCopy}
              onNavigate={(id) => navigate(`/usuario/${id}`)}
            />
          ))}
        </TabsContent>

        {/* Diets */}
        <TabsContent value="diets" className="space-y-3">
          {isLoading && <div className="text-center py-6 text-sm text-muted-foreground">{t("search_loading")}</div>}
          {!isLoading && searchDiets.length === 0 && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              {t("search_no_diets")}
            </div>
          )}
          {searchDiets.map((routine) => (
            <RoutineCard
              key={`${routine.userId}-${routine.routineName}`}
              routine={routine}
              isExpanded={expandedKeys.has(`${routine.userId}::${routine.routineName}`)}
              isLoadingItems={itemsLoading.has(`${routine.userId}::${routine.routineName}`)}
              items={itemsCache.get(`${routine.userId}::${routine.routineName}`) ?? []}
              isCopying={copyingKeys.has(`${routine.userId}::${routine.routineName}`)}
              isOwn={routine.userId === user?.id}
              loadingText={t("loading")}
              onToggleExpand={handleToggleExpand}
              onCopy={handleCopy}
              onNavigate={(id) => navigate(`/usuario/${id}`)}
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
