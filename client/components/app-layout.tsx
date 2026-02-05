import { cn } from "@/lib/utils";
import { Home, PlusSquare, Dumbbell, Moon, Sun, User, Search } from "lucide-react";
import * as React from "react";
import { useTheme } from "next-themes";
import { Link, Outlet, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  searchUsersDb,
  searchUserWorkoutsDb,
  searchUserDietsDb,
  type SearchUser,
  type SearchWorkout,
  type SearchDiet,
} from "@/lib/ritmofit-db";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/postar", label: "Nova", icon: PlusSquare },
  { to: "/metas", label: "Metas", icon: Dumbbell },
  { to: "/perfil", label: "Perfil", icon: User },
];

function isActivePath(currentPath: string, to: string) {
  if (to === "/") return currentPath === "/";
  return currentPath === to || currentPath.startsWith(`${to}/`);
}

function BrandMark({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative grid h-9 w-9 place-items-center rounded-xl bg-brand shadow-sm ring-1 ring-brand/30",
        className,
      )}
    >
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-foreground">
        <Dumbbell className="h-5 w-5 text-white" />
      </div>
      <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-brand-2 ring-2 ring-background" />
    </div>
  );
}

function SearchContent({ onClose }: { onClose: () => void }) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchUsers, setSearchUsers] = React.useState<SearchUser[]>([]);
  const [searchWorkouts, setSearchWorkouts] = React.useState<SearchWorkout[]>([]);
  const [searchDiets, setSearchDiets] = React.useState<SearchDiet[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSearch = React.useCallback(async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchUsers([]);
      setSearchWorkouts([]);
      setSearchDiets([]);
      return;
    }

    setIsLoading(true);
    try {
      const [users, workouts, diets] = await Promise.all([
        searchUsersDb(query),
        searchUserWorkoutsDb(query),
        searchUserDietsDb(query),
      ]);
      setSearchUsers(users);
      setSearchWorkouts(workouts);
      setSearchDiets(diets);
    } catch (err) {
      console.error("Error searching:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="space-y-4">
      <Input
        placeholder="Buscar pessoas, treinos, dietas..."
        value={searchQuery}
        onChange={(e) => handleSearch(e.target.value)}
        className="rounded-full"
        autoFocus
      />

      <Tabs defaultValue="people" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="people">Pessoas</TabsTrigger>
          <TabsTrigger value="workouts">Treinos</TabsTrigger>
          <TabsTrigger value="diets">Dietas</TabsTrigger>
        </TabsList>

        <TabsContent value="people" className="space-y-3 max-h-[60vh] overflow-y-auto">
          {isLoading && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Buscando...
            </div>
          )}
          {!isLoading && searchUsers.length === 0 && searchQuery && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Nenhuma pessoa encontrada.
            </div>
          )}
          {searchUsers.map((user) => (
            <Card
              key={user.id}
              className="border-border/60 cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {user.photo ? (
                    <img
                      src={user.photo}
                      alt={user.nickname}
                      className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-muted flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{user.nickname}</p>
                    {user.bio && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {user.bio}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="workouts" className="space-y-3 max-h-[60vh] overflow-y-auto">
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
          {searchWorkouts.map((workout) => (
            <Card
              key={workout.userWorkoutId}
              className="border-border/60 cursor-pointer hover:bg-muted/50 transition-colors"
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
                      <p className="font-medium text-sm">{workout.workoutName}</p>
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

        <TabsContent value="diets" className="space-y-3 max-h-[60vh] overflow-y-auto">
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
          {searchDiets.map((diet) => (
            <Card
              key={diet.userDietId}
              className="border-border/60 cursor-pointer hover:bg-muted/50 transition-colors"
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

export function AppLayout() {
  const location = useLocation();

  const desktopNavItems = React.useMemo(() => navItems, []);

  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDark = (resolvedTheme ?? theme) === "dark";

  const [headerHidden, setHeaderHidden] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;

      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;

        // evita ficar piscando quando está bem no topo
        const shouldHide = y > 96 && delta > 10;
        const shouldShow = delta < -10;

        if (shouldHide) setHeaderHidden(true);
        if (shouldShow) setHeaderHidden(false);

        lastY = y;
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-dvh bg-background">
      <header
        className={cn(
          "sticky top-0 z-50 border-b border-border/60 bg-background/75 backdrop-blur supports-[backdrop-filter]:bg-background/55 transition-transform duration-200",
          headerHidden
            ? "-translate-y-full pointer-events-none"
            : "translate-y-0",
        )}
      >
        <div className="relative mx-auto flex h-16 w-full max-w-6xl items-center justify-center gap-4 px-4 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:justify-stretch">
          <Link
            to="/"
            aria-label="Ir para Home"
            className="flex items-center gap-3 rounded-2xl px-2 py-1 transition hover:bg-muted/50 lg:justify-start"
          >
            <BrandMark />
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-tight text-foreground">
                  Ritmo
                  <span className="text-brand">Fit</span>
                </span>
                <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  MVP
                </span>
              </div>
            </div>
          </Link>

          <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-1 lg:hidden">
            <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 rounded-full"
                  aria-label="Buscar pessoas, treinos e dietas"
                >
                  <Search className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <SearchContent onClose={() => setSearchOpen(false)} />
              </DialogContent>
            </Dialog>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-full"
              aria-label={isDark ? "Ativar modo claro" : "Ativar modo noturno"}
              onClick={() => setTheme(isDark ? "light" : "dark")}
            >
              {isDark ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
          </div>

          <nav className="hidden items-center justify-center gap-2 lg:flex">
            {desktopNavItems.map((item) => {
              const active = isActivePath(location.pathname, item.to);
              const Icon = item.icon;

              return (
                <Button
                  key={item.to}
                  asChild
                  variant={active ? "secondary" : "ghost"}
                  className="h-11 w-11 rounded-full p-0"
                >
                  <Link to={item.to} aria-label={item.label}>
                    <span className="relative">
                      <Icon className="h-5 w-5" />
                    </span>
                  </Link>
                </Button>
              );
            })}
          </nav>

          <div className="hidden justify-end lg:flex lg:items-center lg:gap-2">
            <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 rounded-full"
                  aria-label="Buscar pessoas, treinos e dietas"
                >
                  <Search className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <SearchContent onClose={() => setSearchOpen(false)} />
              </DialogContent>
            </Dialog>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-full"
              aria-label={isDark ? "Ativar modo claro" : "Ativar modo noturno"}
              onClick={() => setTheme(isDark ? "light" : "dark")}
            >
              {isDark ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-[calc(4.25rem+env(safe-area-inset-bottom)+0.5rem)] pt-6 lg:pb-10">
        <Outlet />
      </main>

      <nav className="fixed bottom-[env(safe-area-inset-bottom)] left-0 right-0 z-50 border-t border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65 lg:hidden">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-4 px-1">
          {navItems.map((item) => {
            const active = isActivePath(location.pathname, item.to);
            const Icon = item.icon;

            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2 text-[11px] transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-2xl ring-1 transition",
                    active
                      ? "bg-brand text-white ring-brand/30"
                      : "bg-transparent ring-transparent",
                  )}
                >
                  <span className="relative">
                    <Icon className="h-5 w-5" />
                  </span>
                </span>
                <span className="hidden md:block">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
