import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  searchUsersDb,
  searchUserWorkoutsDb,
  searchUserDietsDb,
  getAllUsersDb,
  followUserDb,
  unfollowUserDb,
  isFollowingDb,
  type SearchUser,
  type SearchWorkout,
  type SearchDiet,
} from "@/lib/ritmofit-db";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/use-toast";
import { UserPlus, UserCheck } from "lucide-react";

export default function Search() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = React.useState("people");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [allUsers, setAllUsers] = React.useState<SearchUser[]>([]);
  const [searchUsers, setSearchUsers] = React.useState<SearchUser[]>([]);
  const [searchWorkouts, setSearchWorkouts] = React.useState<SearchWorkout[]>(
    [],
  );
  const [searchDiets, setSearchDiets] = React.useState<SearchDiet[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [followingIds, setFollowingIds] = React.useState<Set<string>>(
    new Set(),
  );
  const [isFollowingLoading, setIsFollowingLoading] = React.useState(false);

  // Load all users on mount and when people tab is active
  React.useEffect(() => {
    const loadAllUsers = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const users = await getAllUsersDb(user.id);
        console.log("Loaded users:", users);
        setAllUsers(users);
        setSearchUsers(users);

        // Check following status for all users
        const followingIdsList = new Set<string>();
        for (const u of users) {
          const isFollowing = await isFollowingDb(u.id);
          if (isFollowing) {
            followingIdsList.add(u.id);
          }
        }
        setFollowingIds(followingIdsList);
      } catch (err) {
        console.error("Error loading all users:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadAllUsers();
  }, [user]);

  const handleSearch = React.useCallback(async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      if (activeTab === "people") {
        setSearchUsers(allUsers);
      } else {
        setSearchWorkouts([]);
        setSearchDiets([]);
      }
      return;
    }

    setIsLoading(true);
    try {
      if (activeTab === "people") {
        const users = await searchUsersDb(query);
        setSearchUsers(users);
      } else if (activeTab === "workouts") {
        const workouts = await searchUserWorkoutsDb(query);
        setSearchWorkouts(workouts);
      } else if (activeTab === "diets") {
        const diets = await searchUserDietsDb(query);
        setSearchDiets(diets);
      }
    } catch (err) {
      console.error("Error searching:", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, allUsers]);

  const handleToggleFollow = React.useCallback(
    async (userId: string) => {
      if (!user) return;

      setIsFollowingLoading(true);
      try {
        const isCurrentlyFollowing = followingIds.has(userId);

        if (isCurrentlyFollowing) {
          const success = await unfollowUserDb(userId);
          if (success) {
            setFollowingIds((prev) => {
              const newSet = new Set(prev);
              newSet.delete(userId);
              return newSet;
            });
            toast({
              title: "Deixou de seguir",
              description: "Você deixou de seguir este usuário.",
            });
          }
        } else {
          const success = await followUserDb(userId);
          if (success) {
            setFollowingIds((prev) => new Set(prev).add(userId));
            toast({
              title: "Seguindo!",
              description: "Você começou a seguir este usuário.",
            });
          }
        }
      } catch (err: any) {
        console.error("Error toggling follow:", err);
        toast({
          title: "Erro",
          description: err.message || "Tente novamente.",
          variant: "destructive",
        });
      } finally {
        setIsFollowingLoading(false);
      }
    },
    [followingIds, user],
  );

  return (
    <div className="space-y-4">
      <Input
        placeholder="Buscar pessoas, treinos, dietas..."
        value={searchQuery}
        onChange={(e) => handleSearch(e.target.value)}
        className="rounded-full"
        autoFocus
      />

      <Tabs
        defaultValue="people"
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="people">Pessoas</TabsTrigger>
          <TabsTrigger value="workouts">Treinos</TabsTrigger>
          <TabsTrigger value="diets">Dietas</TabsTrigger>
        </TabsList>

        <TabsContent value="people" className="space-y-3">
          {isLoading && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Carregando...
            </div>
          )}
          {!isLoading && searchUsers.length === 0 && !searchQuery && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Nenhuma pessoa encontrada.
            </div>
          )}
          {!isLoading && searchUsers.length === 0 && searchQuery && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Nenhuma pessoa encontrada.
            </div>
          )}
          {searchUsers.map((u) => (
            <Card
              key={u.id}
              className="border-border/60 hover:bg-muted/50 transition-colors"
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3 justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {u.photo ? (
                      <img
                        src={u.photo}
                        alt={u.nickname}
                        className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-muted flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{u.nickname}</p>
                      {u.bio && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {u.bio}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={
                      followingIds.has(u.id) ? "secondary" : "default"
                    }
                    className="shrink-0 rounded-full gap-2"
                    onClick={() => handleToggleFollow(u.id)}
                    disabled={isFollowingLoading}
                  >
                    {followingIds.has(u.id) ? (
                      <>
                        <UserCheck className="h-4 w-4" />
                        Seguindo
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" />
                        Seguir
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="workouts" className="space-y-3">
          {isLoading && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Buscando...
            </div>
          )}
          {!isLoading && searchWorkouts.length === 0 && searchQuery && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Nenhum treino encontrado.
            </div>
          )}
          {!isLoading && searchWorkouts.length === 0 && !searchQuery && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Digite para buscar treinos.
            </div>
          )}
          {searchWorkouts.map((workout) => (
            <Card
              key={workout.userWorkoutId}
              className="border-border/60 hover:bg-muted/50 transition-colors"
            >
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {workout.userPhoto ? (
                        <img
                          src={workout.userPhoto}
                          alt={workout.userName}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-muted" />
                      )}
                      <p className="text-xs font-medium text-muted-foreground">
                        {workout.userName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    {workout.workoutPhoto ? (
                      <img
                        src={workout.workoutPhoto}
                        alt={workout.workoutName}
                        className="h-12 w-12 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded bg-muted flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">
                        {workout.workoutName}
                      </p>
                      {workout.workoutDescription && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {workout.workoutDescription}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="diets" className="space-y-3">
          {isLoading && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Buscando...
            </div>
          )}
          {!isLoading && searchDiets.length === 0 && searchQuery && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Nenhuma dieta encontrada.
            </div>
          )}
          {!isLoading && searchDiets.length === 0 && !searchQuery && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Digite para buscar dietas.
            </div>
          )}
          {searchDiets.map((diet) => (
            <Card
              key={diet.userDietId}
              className="border-border/60 hover:bg-muted/50 transition-colors"
            >
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {diet.userPhoto ? (
                        <img
                          src={diet.userPhoto}
                          alt={diet.userName}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-muted" />
                      )}
                      <p className="text-xs font-medium text-muted-foreground">
                        {diet.userName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    {diet.dietPhoto ? (
                      <img
                        src={diet.dietPhoto}
                        alt={diet.dietName}
                        className="h-12 w-12 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded bg-muted flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{diet.dietName}</p>
                      <div className="flex gap-2 items-center mt-1">
                        {diet.dietCalories && (
                          <p className="text-xs font-medium text-brand">
                            {diet.dietCalories} cal
                          </p>
                        )}
                        {diet.dietDescription && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {diet.dietDescription}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
