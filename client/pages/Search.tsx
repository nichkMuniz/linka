import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
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
  onToggleExpand,
  onCopy,
  onNavigate,
  onGoToRoutines,
}: RoutineCardProps) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        {/* Routine name — prominent */}
        <p className="font-semibold text-sm mb-2">{routine.routineName ?? "Rotina sem nome"}</p>

        {/* User info row + action buttons */}
        <div className="flex items-center gap-2">
          {/* Small user avatar + name */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <UserAvatar
              photo={routine.userPhoto}
              gender={routine.userGender}
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
              {isCopying ? "Copiando..." : "Copiar"}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="default"
              className="rounded-full h-7 px-2.5 gap-1 text-xs flex-shrink-0"
              onClick={onGoToRoutines}
            >
              Ver rotina
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
        await copyRoutineToUserDb(routine.userId, user.id, routine.routineType as 1 | 2, routine.routineName);
        setCopiedKeys((prev) => new Set(prev).add(key));
        toast({
          title: routine.routineType === 1 ? "Treino copiado!" : "Dieta copiada!",
          description: `"${routine.routineName ?? "Rotina sem nome"}" foi adicionado(a) à sua conta.`,
        });
      } catch (err: any) {
        toast({ title: "Erro ao copiar", description: err.message || "Tente novamente.", variant: "destructive" });
      } finally {
        setCopyingKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });
      }
    },
    [user],
  );

  const searchPlaceholder =
    activeTab === "people"
      ? "Busque por pessoas"
      : activeTab === "workouts"
        ? "Busque por treinos"
        : "Busque por dietas";

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
                  <p className="text-sm font-semibold text-foreground">Nenhuma pessoa encontrada</p>
                  <p className="text-xs text-muted-foreground max-w-[220px]">
                    Tente buscar por um nome ou @nickname diferente
                  </p>
                </div>
              </div>
            </div>
          )}
          {searchUsers.map((u) => (
            <Card key={u.id} className="border-border/60 hover:bg-muted/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-3 justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <UserAvatar
                      photo={u.photo}
                      gender={u.gender}
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
                      {u.bio && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{u.bio}</p>}
                    </div>
                  </div>
                  {u.id !== user?.id && (
                    <FollowButton
                      targetUserId={u.id}
                      initialIsFollowing={followingIds.has(u.id)}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
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
                  <p className="text-sm font-semibold text-foreground">Nenhum treino cadastrado ainda</p>
                  <p className="text-xs text-muted-foreground max-w-[220px]">
                    Quando alguém compartilhar um treino, ele aparece aqui para você copiar
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
              loadingText={t("loading")}
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
                  <p className="text-sm font-semibold text-foreground">Nenhuma dieta cadastrada ainda</p>
                  <p className="text-xs text-muted-foreground max-w-[220px]">
                    Quando alguém compartilhar uma dieta, ela aparece aqui para você copiar
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
              loadingText={t("loading")}
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
