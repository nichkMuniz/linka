import * as React from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getProgrammedGoalsDb,
  createUserGoalDb,
  createCustomWorkoutDb,
  createCustomDietDb,
  updateUserGoalDb,
  getUserSelectedGoalIdsDb,
  getWorkoutsDb,
  getDietsDb,
  getHabitsDb,
  createUserWorkoutsDb,
  createUserDietsDb,
  createUserHabitsDb,
  getUserRoutinesDb,
  getUserWorkoutsDb,
  getUserDietsDb,
  getUserHabitsDb,
  updateWorkoutSeriesDb,
  getUserGoalsDb,
  deleteRoutinesOfTypeDb,
  createCheckInDb,
  awardBadgesForCheckInsDb,
  getUserBadgesDb,
  getAllBadgesDb,
  getTotalCheckInsDb,
  getTodayCheckInDb,
  getWeekCheckInsDb,
  getCheckInHistoryDb,
  getWorkoutHistoriesBatchDb,
  saveWorkoutHistoryDb,
  getWorkoutHistoryDb,
  toggleUserDietCompletionDb,
  toggleUserHabitCompletionDb,
  saveDietHistoryDb,
  saveHabitHistoryDb,
  updateRoutineGoalDb,
  hasCompletedRoutineToday,
  getRoutineTypeName,
  createPostDb,
  addGroupCheckInDb,
  getEnrichedDuelGroupsDb,
  getUserProfileDb,
  getTodayHydrationDb,
  addHydrationDb,
  undoLastHydrationDb,
  getTodayMacroSummaryDb,
  awardNutritionBadgesDb,
  getTodayMoodDb,
  type MoodValue,
  type CompletedRoutineExercise,
  type ProgrammedGoal,
  type Workout,
  type Diet,
  type Habit,
  type Routine,
  type UserWorkoutWithDetails,
  type UserDietWithDetails,
  type UserHabitWithDetails,
  type UserGoal,
  type RoutineTypeCode,
  type WorkoutHistoryRecord,
  type Badge,
  type UserBadge,
} from "@/lib/ritmofit-db";
import { supabase } from "@/lib/supabase";
import { fetchExerciseCatalog, type CatalogExercise } from "@/lib/exercise-catalog";
import { ExerciseImage } from "@/components/shared/exercise-image";
import { DietImage } from "@/components/shared/diet-image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Play,
  CheckCircle2,
  Circle,
  Plus,
  X,
  ChevronUp,
  Search,
  Filter,
  Pause,
  MoreVertical,
  Trash2,
  Edit2,
  Check,
  Clock,
  Share2,
  Flame,
  Dumbbell,
  Timer,
  TrendingUp,
  Camera,
  Tag,
  Swords,
  Droplets,
  Minus,
  Salad,
  Zap,
  Apple,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Bell,
  BellOff,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { LoadingSpinner } from "@/components/shared/animated-loading";
import { InsigniasDrawer } from "@/components/profile/insignias-drawer";
import { EditGoalDrawer } from "@/components/goals/edit-goal-drawer";
import { MoodDialog } from "@/components/goals/mood-dialog";
import { RenameRoutineDialog } from "@/components/goals/rename-routine-dialog";
import { ImageZoomDrawer } from "@/components/shared/image-zoom-drawer";
import { CreateWorkoutDrawer } from "@/components/goals/create-workout-drawer";
import { CreateGoalDrawer } from "@/components/goals/create-goal-drawer";
import { LinkGoalDrawer } from "@/components/goals/link-goal-drawer";
import { ExecuteAtDrawer } from "@/components/goals/execute-at-drawer";
import { ScheduledTimeDrawer } from "@/components/goals/scheduled-time-drawer";
import { useRoutineNotifications, requestNotificationPermission, formatScheduledTime } from "@/hooks/use-routine-notifications";
import {
  updateRoutineScheduledTimeDb,
  type RoutineType,
} from "@/lib/ritmofit-db";
import { useLanguage } from "@/lib/language-context";
import { useWorkout } from "@/lib/workout-context";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

export default function Goals() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { syncAll: syncRoutineNotifications } = useRoutineNotifications(user?.id ?? null);
  const { t } = useLanguage();
  const {
    workoutMinimized, setWorkoutMinimized,
    pendingReopen, setPendingReopen,
    workoutModalOpen, setWorkoutModalOpen,
    workoutSeries, setWorkoutSeries,
    workoutDuration, setWorkoutDuration,
    workoutStartTime, setWorkoutStartTime,
    selectedRoutineName, setSelectedRoutineName,
    workoutExerciseRestTimes, setWorkoutExerciseRestTimes,
    currentWorkoutIndex, setCurrentWorkoutIndex,
    resetWorkoutState,
    globalRestTimerRemaining, setGlobalRestTimerRemaining,
    globalRestTimerActive, setGlobalRestTimerActive,
    globalRestTimerTotal, setGlobalRestTimerTotal,
    setGlobalRestTimerKey,
  } = useWorkout();

  // Abre o modal de treino quando o FAB global disparar pendingReopen
  React.useEffect(() => {
    if (pendingReopen && !workoutModalOpen) {
      setPendingReopen(false);
      setWorkoutMinimized(false);
      setWorkoutModalOpen(true);
    } else if (pendingReopen && workoutModalOpen) {
      // Modal já está aberto (navegou para /metas com modal aberto), só limpa o flag
      setPendingReopen(false);
      setWorkoutMinimized(false);
    }
  }, [pendingReopen, workoutModalOpen]);

  const initialTab = searchParams.get("tab") === "metas" ? "metas" : "rotinas";

  // Metas tab state
  const [goals, setGoals] = React.useState<ProgrammedGoal[]>([]);
  const [selectedGoalIds, setSelectedGoalIds] = React.useState<string[]>([]);
  const [userGoals, setUserGoals] = React.useState<UserGoal[]>([]);

  // Add routine modal state
  const [addRoutineModalOpen, setAddRoutineModalOpen] = React.useState(false);
  const [selectedRoutineType, setSelectedRoutineType] = React.useState<
    number | null
  >(null);
  const [selectedItems, setSelectedItems] = React.useState<Set<string>>(
    new Set(),
  );
  const [isAddingRoutine, setIsAddingRoutine] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedMuscleGroups, setSelectedMuscleGroups] = React.useState<
    Set<string>
  >(new Set());
  const [selectedWorkoutType, setSelectedWorkoutType] = React.useState<number | null>(null);
  const [selectedDietCategories, setSelectedDietCategories] = React.useState<Set<string>>(new Set());
  const [routineName, setRoutineName] = React.useState("");
  const [showExecuteAtStep, setShowExecuteAtStep] = React.useState(false);

  // Base data for lookups
  const [workouts, setWorkouts] = React.useState<Workout[]>([]);
  const [catalogExercises, setCatalogExercises] = React.useState<CatalogExercise[]>([]);
  const [diets, setDiets] = React.useState<Diet[]>([]);
  const [habits, setHabits] = React.useState<Habit[]>([]);

  // Routines data
  const [routines, setRoutines] = React.useState<Routine[]>([]);
  const [userWorkouts, setUserWorkouts] = React.useState<
    UserWorkoutWithDetails[]
  >([]);
  const [userDiets, setUserDiets] = React.useState<UserDietWithDetails[]>([]);
  const [userHabits, setUserHabits] = React.useState<UserHabitWithDetails[]>(
    [],
  );
  const [expandedRoutineId, setExpandedRoutineId] = React.useState<
    string | null
  >(null); // Start with all routines closed

  const [restTimerModalOpen, setRestTimerModalOpen] = React.useState(false);
  const [restTimerExerciseId, setRestTimerExerciseId] = React.useState<
    string | null
  >(null);
  const [restTimerRemaining, setRestTimerRemaining] = React.useState(0);
  const [restTimerPaused, setRestTimerPaused] = React.useState(false);
  const [swipedSeriesId, setSwipedSeriesId] = React.useState<string | null>(null);
  const [finishWorkoutConfirmOpen, setFinishWorkoutConfirmOpen] = React.useState(false);
  const [workoutModalSearchQuery, setWorkoutModalSearchQuery] = React.useState("");
  const [workoutModalMuscleFilter, setWorkoutModalMuscleFilter] = React.useState<string | null>(null);
  const [workoutSummaryOpen, setWorkoutSummaryOpen] = React.useState(false);
  const [workoutRating, setWorkoutRating] = React.useState(0);
  const [workoutSummaryData, setWorkoutSummaryData] = React.useState<{
    duration: number;
    totalVolume: number;
    totalSeries: number;
    exerciseNames: string[];
    exercises: CompletedRoutineExercise[];
    routineName: string | null;
    prs: Array<{ exerciseName: string; kg: number; reps: number }>;
    isAllCardio: boolean;
    totalKm: number;
  } | null>(null);

  const [isDuelShareModalOpen, setIsDuelShareModalOpen] = React.useState(false);
  const [isSharingDuel, setIsSharingDuel] = React.useState(false);
  const [duelGroups, setDuelGroups] = React.useState<Array<{ id: string; name: string; goal: string }>>([]);
  const [selectedDuelGroupId, setSelectedDuelGroupId] = React.useState<string | null>(null);
  const [workoutPostDescription, setWorkoutPostDescription] = React.useState<string>("");
  const [workoutLinkedUserGoalId, setWorkoutLinkedUserGoalId] = React.useState<string | null>(null);

  // Goal completion celebration state
  const [goalCompletedModal, setGoalCompletedModal] = React.useState<{
    description: string;
    userGoalId: string;
  } | null>(null);
  const [isSharingGoalCompletion, setIsSharingGoalCompletion] = React.useState(false);
  const [goalCompletionPostText, setGoalCompletionPostText] = React.useState("");
  const [goalCompletionCanvasUrl, setGoalCompletionCanvasUrl] = React.useState<string | null>(null);
  const goalCompletionCanvasRef = React.useRef<HTMLCanvasElement>(null);

  // PR celebration state
  const [prCelebration, setPrCelebration] = React.useState<{
    exerciseName: string;
    kg: number;
    reps: number;
  } | null>(null);
  const [isSharingWorkout, setIsSharingWorkout] = React.useState(false);
  const [workoutCoverFiles, setWorkoutCoverFiles] = React.useState<File[]>([]);
  const [workoutCoverPreviews, setWorkoutCoverPreviews] = React.useState<string[]>([]);
  const [coverCarouselIndex, setCoverCarouselIndex] = React.useState(0);
  const [canvasPreviewUrl, setCanvasPreviewUrl] = React.useState<string | null>(null);
  const [prCanvasPreviewUrl, setPrCanvasPreviewUrl] = React.useState<string | null>(null);
  const workoutCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const prCanvasRef = React.useRef<HTMLCanvasElement>(null);

  // Edit goal modal state
  const [editGoalModalOpen, setEditGoalModalOpen] = React.useState(false);
  const [editingGoal, setEditingGoal] = React.useState<UserGoal | null>(null);

  // Check-in system state
  const [dailyCheckInDone, setDailyCheckInDone] = React.useState(false);
  const [isProcessingCheckIn, setIsProcessingCheckIn] = React.useState(false);
  const [weekCheckIns, setWeekCheckIns] = React.useState<Set<number>>(new Set()); // 0=dom, 1=seg, etc
  const [streakCount, setStreakCount] = React.useState(0);
  const [checkInHistory, setCheckInHistory] = React.useState<{ check_in_date: string }[]>([]);
  const [checkInWeekOffset, setCheckInWeekOffset] = React.useState(0); // 0 = current week, -1 = last week, etc
  const [routineCompletedTodayStatus, setRoutineCompletedTodayStatus] = React.useState(false);
  const [badgesModalOpen, setBadgesModalOpen] = React.useState(false);
  const [userBadges, setUserBadges] = React.useState<UserBadge[]>([]);
  const [allBadges, setAllBadges] = React.useState<Badge[]>([]);
  const [totalCheckIns, setTotalCheckIns] = React.useState<number>(0);
  const [hasNewBadge, setHasNewBadge] = React.useState(false);
  const lastSeenBadgeCountRef = React.useRef<number | null>(null);
  // Mutex ref to prevent concurrent check-ins from parallel calls (diet/habit toggles, workout finish)
  const checkInInProgressRef = React.useRef(false);

  // ─── Hidratação ───────────────────────────────────────────────────────────
  const [hydrationMl, setHydrationMl] = React.useState(0);
  const [hydrationGoalMl] = React.useState(2000); // meta padrão: 2L/dia
  const [isAddingHydration, setIsAddingHydration] = React.useState(false);

  // ─── Humor do Dia ─────────────────────────────────────────────────────────
  const [moodModalOpen, setMoodModalOpen] = React.useState(false);
  const [todayMood, setTodayMood] = React.useState<MoodValue | null>(null);
  // Ref para garantir que o modal de humor seja exibido apenas uma vez por sessão
  const moodModalShownRef = React.useRef(false);

  // ─── Macro diário ─────────────────────────────────────────────────────────
  const [todayMacro, setTodayMacro] = React.useState<{
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    quality_counts: { in_natura: number; processado: number; ultraprocessado: number };
  } | null>(null);

  // ─── Timing nutricional pós-treino ────────────────────────────────────────
  const [showPostWorkoutNutrition, setShowPostWorkoutNutrition] = React.useState(false);
  const [nutritionExpanded, setNutritionExpanded] = React.useState(true);

  const getBadgeCount = (size: number) =>
    [1, 3, 5, 7].filter((t) => size >= t).length;

  React.useEffect(() => {
    if (!user) return;
    const storageKey = `ritmofit_badges_seen_${user.id}`;
    const currentBadgeCount = getBadgeCount(weekCheckIns.size);

    if (lastSeenBadgeCountRef.current === null) {
      const stored = localStorage.getItem(storageKey);
      const storedCount = stored ? parseInt(stored, 10) : 0;
      lastSeenBadgeCountRef.current = currentBadgeCount;
      if (currentBadgeCount > storedCount) {
        setHasNewBadge(true);
      }
    } else if (currentBadgeCount > lastSeenBadgeCountRef.current) {
      setHasNewBadge(true);
      lastSeenBadgeCountRef.current = currentBadgeCount;
    }
  }, [weekCheckIns.size, user?.id]);

  // Available goals accordion state
  const [availableGoalsOpen, setAvailableGoalsOpen] = React.useState(false);

  // Create custom workout drawer state
  const [createWorkoutDrawerOpen, setCreateWorkoutDrawerOpen] = React.useState(false);
  const [createWorkoutInitialName, setCreateWorkoutInitialName] = React.useState("");

  // Create custom goal drawer state
  const [createGoalDrawerOpen, setCreateGoalDrawerOpen] = React.useState(false);

  // Goal completion celebration modal state
  const [celebrationGoal, setCelebrationGoal] = React.useState<UserGoal | null>(null);

  // Workout history modal state
  const [workoutHistoryModalOpen, setWorkoutHistoryModalOpen] = React.useState(false);
  const [selectedWorkoutForHistory, setSelectedWorkoutForHistory] = React.useState<Workout | null>(null);
  const [workoutHistory, setWorkoutHistory] = React.useState<WorkoutHistoryRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);

  // Workout history for displaying in series (during registration)
  const [workoutHistoriesMap, setWorkoutHistoriesMap] = React.useState<Record<string, WorkoutHistoryRecord[]>>({});


  // Image zoom modal
  const [imageZoom, setImageZoom] = React.useState<{ src: string | null; name: string; description?: string } | null>(null);

  // Link goal from routines tab
  const [linkGoalForRoutineOpen, setLinkGoalForRoutineOpen] = React.useState(false);
  const [linkGoalRoutineKey, setLinkGoalRoutineKey] = React.useState<{ typeCode: number; name: string | null } | null>(null);

  // Routine selection for goal card state
  const [goalRoutineModalOpen, setGoalRoutineModalOpen] = React.useState(false);
  const [goalRoutineModalMode, setGoalRoutineModalMode] = React.useState<"link" | "view">("link");
  const [selectedGoalForRoutines, setSelectedGoalForRoutines] = React.useState<any>(null);
  const [goalRoutineSelection, setGoalRoutineSelection] = React.useState<Set<string>>(new Set());
  const [routineSearchQuery, setRoutineSearchQuery] = React.useState("");
  const [goalRoutineMuscleGroups, setGoalRoutineMuscleGroups] = React.useState<
    Set<string>
  >(new Set());
  const [openRoutineTypes, setOpenRoutineTypes] = React.useState<Set<number>>(new Set());
  const [openRoutineItems, setOpenRoutineItems] = React.useState<Set<string>>(new Set());

  // Completion tracking for Rotinas tab items
  const [completedDietIds, setCompletedDietIds] = React.useState<Set<string>>(new Set());
  const [completedHabitIds, setCompletedHabitIds] = React.useState<Set<string>>(new Set());
  // Keys of routine cards that should show completed items
  const [showCompletedForRoutine, setShowCompletedForRoutine] = React.useState<Set<string>>(new Set());

  // Collapsed section state for Rotinas tab (stores type codes of collapsed sections)
  const [collapsedSections, setCollapsedSections] = React.useState<Set<number>>(new Set());

  // Muscle/diet filter panel expand state in add-routine modal
  const [showMuscleFilterPanel, setShowMuscleFilterPanel] = React.useState(false);

  // Rename routine state
  const [renameRoutineOpen, setRenameRoutineOpen] = React.useState(false);
  const [renameRoutineData, setRenameRoutineData] = React.useState<{ typeCode: number; oldName: string | null } | null>(null);
  const [renameRoutineValue, setRenameRoutineValue] = React.useState("");

  // Scheduled time (notification) state
  const [scheduledTimeDrawerOpen, setScheduledTimeDrawerOpen] = React.useState(false);
  const [scheduledTimeTarget, setScheduledTimeTarget] = React.useState<{ id: string; type: RoutineType; name: string; currentTime: string | null } | null>(null);
  const [isSavingScheduledTime, setIsSavingScheduledTime] = React.useState(false);

  // Tracks which existing routine card we're adding items to (for pre-fill name context)
  const [addToRoutineCardName, setAddToRoutineCardName] = React.useState<string | null>(null);

  const handleToggleSection = React.useCallback((sType: number) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sType)) {
        next.delete(sType);
      } else {
        next.add(sType);
      }
      return next;
    });
  }, []);

  const REST_TIME_OPTIONS = [10, 20, 30, 40, 50, 60, 90, 120]; // in seconds

  // General state
  const [loading, setLoading] = React.useState(true);
  const [selectingGoalId, setSelectingGoalId] = React.useState<string | null>(
    null,
  );
  const [editingAvailableGoalId, setEditingAvailableGoalId] = React.useState<string | null>(null);
  const [editAvailableGoalDuration, setEditAvailableGoalDuration] = React.useState(30);
  const [editAvailableGoalQuantity, setEditAvailableGoalQuantity] = React.useState(1);
  const [isAddingGoal, setIsAddingGoal] = React.useState(false);

  // Timer effect moved to WorkoutContext — runs even when Goals is unmounted

  // Draw workout cover on canvas when summary opens
  React.useEffect(() => {
    if (!workoutSummaryOpen || !workoutSummaryData) return;
    const canvas = workoutCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { duration, totalVolume, totalSeries, exerciseNames, routineName } = workoutSummaryData;
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    const durationStr = mins > 0 ? `${mins}m ${secs > 0 ? `${secs}s` : ""}`.trim() : `${secs}s`;
    // Background
    const grad = ctx.createLinearGradient(0, 0, 800, 800);
    grad.addColorStop(0, "#0f172a");
    grad.addColorStop(1, "#1e3a2f");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 800);
    // Accent circles
    ctx.beginPath(); ctx.arc(700, 100, 220, 0, Math.PI * 2); ctx.fillStyle = "rgba(34,197,94,0.08)"; ctx.fill();
    ctx.beginPath(); ctx.arc(100, 700, 180, 0, Math.PI * 2); ctx.fillStyle = "rgba(34,197,94,0.06)"; ctx.fill();
    // Emoji
    ctx.font = "120px serif"; ctx.textAlign = "center";
    ctx.fillText("💪", 400, 220);
    // Title
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 52px system-ui, sans-serif";
    ctx.fillText("Treino Concluído!", 400, 320);
    // Routine name
    if (routineName) { ctx.fillStyle = "#86efac"; ctx.font = "32px system-ui, sans-serif"; ctx.fillText(routineName, 400, 375); }
    // Divider
    ctx.strokeStyle = "rgba(34,197,94,0.3)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(100, 420); ctx.lineTo(700, 420); ctx.stroke();
    // Stats
    const statsData = [
      { label: "Duração", value: durationStr },
      { label: "Volume", value: totalVolume > 0 ? `${totalVolume} kg` : "—" },
      { label: "Séries", value: String(totalSeries) },
    ];
    statsData.forEach((s, i) => {
      const x = 170 + i * 230;
      ctx.fillStyle = "#86efac"; ctx.font = "bold 44px system-ui, sans-serif"; ctx.fillText(s.value, x, 510);
      ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "24px system-ui, sans-serif"; ctx.fillText(s.label, x, 548);
    });
    // Exercises
    if (exerciseNames.length > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = "26px system-ui, sans-serif";
      ctx.fillText(exerciseNames.slice(0, 4).join("  ·  "), 400, 630);
    }
    // Branding
    ctx.fillStyle = "rgba(134,239,172,0.6)"; ctx.font = "bold 28px system-ui, sans-serif"; ctx.fillText("Linka", 400, 720);
    ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.font = "22px system-ui, sans-serif"; ctx.fillText("#Fitness #Treino", 400, 758);
    // Capture preview URL after drawing
    setCanvasPreviewUrl(canvas.toDataURL("image/png"));
  }, [workoutSummaryOpen, workoutSummaryData]);

  // Draw PR cover on canvas when summary opens and PRs exist
  React.useEffect(() => {
    if (!workoutSummaryOpen || !workoutSummaryData?.prs.length) return;
    const canvas = prCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { prs } = workoutSummaryData;

    // Background: dark gold gradient
    const grad = ctx.createLinearGradient(0, 0, 800, 800);
    grad.addColorStop(0, "#1a1200");
    grad.addColorStop(1, "#2d1f00");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 800);

    // Glow circles (gold tones)
    ctx.beginPath(); ctx.arc(700, 120, 250, 0, Math.PI * 2); ctx.fillStyle = "rgba(251,191,36,0.07)"; ctx.fill();
    ctx.beginPath(); ctx.arc(80, 680, 200, 0, Math.PI * 2); ctx.fillStyle = "rgba(251,191,36,0.05)"; ctx.fill();

    // Top badge band
    ctx.fillStyle = "rgba(251,191,36,0.15)";
    ctx.fillRect(0, 0, 800, 8);
    ctx.fillRect(0, 792, 800, 8);

    // Trophy emoji
    ctx.font = "110px serif"; ctx.textAlign = "center";
    ctx.fillText("🏆", 400, 195);

    // "NOVO RECORDE" tag
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.roundRect(240, 218, 320, 52, 26);
    ctx.fill();
    ctx.fillStyle = "#1a1200";
    ctx.font = "bold 26px system-ui, sans-serif";
    ctx.fillText("NOVO RECORDE PESSOAL", 400, 251);

    // Divider
    ctx.strokeStyle = "rgba(251,191,36,0.35)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(80, 300); ctx.lineTo(720, 300); ctx.stroke();

    // PR list
    const maxPRs = Math.min(prs.length, 4);
    const startY = prs.length === 1 ? 430 : 340;
    const lineH = prs.length === 1 ? 0 : Math.min(100, (600 - startY) / (maxPRs - 1 || 1));

    for (let i = 0; i < maxPRs; i++) {
      const pr = prs[i];
      const y = startY + i * lineH;
      // Exercise name (truncate if long)
      const nameText = pr.exerciseName.length > 28 ? pr.exerciseName.slice(0, 26) + "…" : pr.exerciseName;
      ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.font = "30px system-ui, sans-serif";
      ctx.fillText(nameText, 400, y);
      // kg value
      const valueText = `${pr.kg} kg${pr.reps > 0 ? ` × ${pr.reps} reps` : ""}`;
      ctx.fillStyle = "#fbbf24"; ctx.font = "bold 38px system-ui, sans-serif";
      ctx.fillText(valueText, 400, y + 46);
    }

    // Branding
    ctx.fillStyle = "rgba(251,191,36,0.6)"; ctx.font = "bold 28px system-ui, sans-serif"; ctx.fillText("Linka", 400, 730);
    ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.font = "22px system-ui, sans-serif"; ctx.fillText("#PR #RecordePessoal #Fitness", 400, 766);
    // Capture PR canvas preview URL for carousel
    setPrCanvasPreviewUrl(canvas.toDataURL("image/png"));
  }, [workoutSummaryOpen, workoutSummaryData]);

  // Draw goal completion celebration canvas
  React.useEffect(() => {
    if (!goalCompletedModal) return;
    const canvas = goalCompletionCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background: dark purple → brand green gradient
    const grad = ctx.createLinearGradient(0, 0, 800, 800);
    grad.addColorStop(0, "#0d1117");
    grad.addColorStop(0.5, "#0f2a1a");
    grad.addColorStop(1, "#1a3a0d");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 800);

    // Glow circles
    ctx.beginPath(); ctx.arc(650, 130, 280, 0, Math.PI * 2); ctx.fillStyle = "rgba(34,197,94,0.10)"; ctx.fill();
    ctx.beginPath(); ctx.arc(150, 670, 220, 0, Math.PI * 2); ctx.fillStyle = "rgba(34,197,94,0.07)"; ctx.fill();
    ctx.beginPath(); ctx.arc(400, 400, 350, 0, Math.PI * 2); ctx.fillStyle = "rgba(34,197,94,0.04)"; ctx.fill();

    // Top accent bar
    const barGrad = ctx.createLinearGradient(0, 0, 800, 0);
    barGrad.addColorStop(0, "rgba(34,197,94,0)");
    barGrad.addColorStop(0.5, "rgba(34,197,94,0.8)");
    barGrad.addColorStop(1, "rgba(34,197,94,0)");
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, 0, 800, 6);
    ctx.fillRect(0, 794, 800, 6);

    // Trophy + confetti emojis
    ctx.font = "130px serif"; ctx.textAlign = "center";
    ctx.fillText("🏆", 400, 210);

    // "META CONCLUÍDA" badge
    const badgeGrad = ctx.createLinearGradient(200, 230, 600, 290);
    badgeGrad.addColorStop(0, "#166534");
    badgeGrad.addColorStop(1, "#15803d");
    ctx.fillStyle = badgeGrad;
    ctx.beginPath();
    ctx.roundRect(195, 230, 410, 58, 29);
    ctx.fill();
    ctx.strokeStyle = "rgba(134,239,172,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(195, 230, 410, 58, 29);
    ctx.stroke();
    ctx.fillStyle = "#86efac";
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.fillText("✓  META CONCLUÍDA  ✓", 400, 268);

    // Divider
    ctx.strokeStyle = "rgba(134,239,172,0.25)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(80, 320); ctx.lineTo(720, 320); ctx.stroke();

    // 100% label
    ctx.fillStyle = "#22c55e"; ctx.font = "bold 96px system-ui, sans-serif";
    ctx.fillText("100%", 400, 430);
    ctx.fillStyle = "rgba(134,239,172,0.55)"; ctx.font = "26px system-ui, sans-serif";
    ctx.fillText("de progresso concluído", 400, 472);

    // Divider
    ctx.strokeStyle = "rgba(134,239,172,0.25)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(80, 510); ctx.lineTo(720, 510); ctx.stroke();

    // Goal description (truncate if too long)
    const desc = goalCompletedModal.description;
    const maxChars = 42;
    const displayDesc = desc.length > maxChars ? desc.slice(0, maxChars - 1) + "…" : desc;
    ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.font = "italic 32px system-ui, sans-serif";
    ctx.fillText(`"${displayDesc}"`, 400, 580);

    // Motivational text
    ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.font = "24px system-ui, sans-serif";
    ctx.fillText("Consistência e dedicação valeram a pena! 💪", 400, 632);

    // Branding
    ctx.fillStyle = "rgba(134,239,172,0.7)"; ctx.font = "bold 30px system-ui, sans-serif";
    ctx.fillText("Linka", 400, 722);
    ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.font = "22px system-ui, sans-serif";
    ctx.fillText("#MetaConcluída #Fitness #Linka", 400, 760);

    setGoalCompletionCanvasUrl(canvas.toDataURL("image/png"));
  }, [goalCompletedModal]);

  // Load all data on mount
  React.useEffect(() => {
    (async () => {
      try {
        // Batch 1 — user's goals and routines: critical, show first
        const criticalFetches: Promise<any>[] = [getProgrammedGoalsDb(), getUserSelectedGoalIdsDb()];
        if (user) {
          criticalFetches.push(
            getUserRoutinesDb(user.id),
            getUserWorkoutsDb(user.id),
            getUserDietsDb(user.id),
            getUserHabitsDb(user.id),
            getUserGoalsDb(),
          );
        }
        const criticalResults = await Promise.all(criticalFetches);

        const standardGoals: ProgrammedGoal[] = criticalResults[0];
        setSelectedGoalIds(criticalResults[1]);
        if (user) {
          setRoutines(criticalResults[2]);
          setUserWorkouts(criticalResults[3]);
          const loadedDiets = criticalResults[4];
          const loadedHabits = criticalResults[5];
          setUserDiets(loadedDiets);
          setUserHabits(loadedHabits);
          const loadedUserGoals: UserGoal[] = criticalResults[6];
          setUserGoals(loadedUserGoals);

          // Inclui metas customizadas do usuário (created_by_user = 1) que não estão no catálogo padrão
          const standardGoalIds = new Set(standardGoals.map((g) => g.id));
          const customGoals: ProgrammedGoal[] = loadedUserGoals
            .filter((ug) => !standardGoalIds.has(ug.goal_id))
            .map((ug) => ({
              id: ug.goal_id,
              description: ug.description,
              duration: ug.duration,
              quantity: ug.quantity,
              type: ug.type_goal,
              created_by_user: 1,
            }));
          setGoals([...standardGoals, ...customGoals]);

          // Populate completed sets — only count completions from today
          // Usa data local (YYYY-MM-DD) para evitar bug de timezone: completed_at é UTC,
          // então um item marcado às 23:30 BRT tem timestamp UTC do dia seguinte.
          const localDateStr = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            return `${y}-${m}-${day}`;
          };
          const todayLocalStr = localDateStr(new Date());
          const initCompletedDiets = new Set<string>(
            loadedDiets
              .filter((d: any) => d.is_completed && d.completed_at && localDateStr(new Date(d.completed_at)) === todayLocalStr)
              .map((d: any) => d.id)
          );
          const initCompletedHabits = new Set<string>(
            loadedHabits
              .filter((h: any) => h.is_completed && h.completed_at && localDateStr(new Date(h.completed_at)) === todayLocalStr)
              .map((h: any) => h.id)
          );
          setCompletedDietIds(initCompletedDiets);
          setCompletedHabitIds(initCompletedHabits);

          // Reset is_completed for items marked on a previous day (fire-and-forget)
          const staleCompletedDiets = loadedDiets.filter(
            (d: any) => d.is_completed && (!d.completed_at || localDateStr(new Date(d.completed_at)) !== todayLocalStr)
          );
          const staleCompletedHabits = loadedHabits.filter(
            (h: any) => h.is_completed && (!h.completed_at || localDateStr(new Date(h.completed_at)) !== todayLocalStr)
          );
          // Batch reset stale completions in parallel (instead of sequential loop)
          const staleResets = [
            ...staleCompletedDiets.map((d: any) => toggleUserDietCompletionDb(d.id, false)),
            ...staleCompletedHabits.map((h: any) => toggleUserHabitCompletionDb(h.id, false)),
          ];
          if (staleResets.length > 0) {
            Promise.all(staleResets).catch(() => { });
          }
        }
        // Carrega hidratação, macro e humor do dia (fire-and-forget — não bloqueia UI)
        if (user) {
          getTodayHydrationDb(user.id).then(setHydrationMl).catch(() => { });
          getTodayMacroSummaryDb(user.id).then(setTodayMacro).catch(() => { });
          getTodayMoodDb(user.id).then((log) => {
            if (log) setTodayMood(log.mood);
          }).catch(() => { });
        }

        setLoading(false); // unblock UI immediately after critical data
      } catch (err: any) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Erro ao carregar dados:", errorMessage);
        toast({
          title: "Erro ao carregar dados",
          description: errorMessage || "Tente novamente.",
          variant: "destructive",
        });
        setLoading(false);
      }
    })();
  }, [user]);

  // Load catalog data (workouts/diets/habits base lists) — isolated so errors don't break main load
  React.useEffect(() => {
    (async () => {
      try {
        const [workoutsBaseData, dietsBaseData, habitsBaseData] = await Promise.all([
          getWorkoutsDb(),
          getDietsDb(),
          getHabitsDb(),
        ]);
        setWorkouts(workoutsBaseData);
        setDiets(dietsBaseData);
        setHabits(habitsBaseData);
      } catch (err: any) {
        console.error("Erro ao carregar catálogo base:", err?.message || err);
      }
      try {
        const catalogData = await fetchExerciseCatalog().catch(() => [] as CatalogExercise[]);
        setCatalogExercises(catalogData);
      } catch (err: any) {
        console.error("Erro ao carregar catálogo externo:", err?.message || err);
      }
    })();
  }, []);


  // Load today's check-in status and week check-ins from database (all in parallel)
  React.useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const [todayCheckIn, weekCheckInDays, hasCompleted, checkInHistory, earnedBadges, catalog, total] = await Promise.all([
          getTodayCheckInDb(user.id),
          getWeekCheckInsDb(user.id),
          hasCompletedRoutineToday(user.id),
          getCheckInHistoryDb(user.id, 60),
          getUserBadgesDb(user.id),
          getAllBadgesDb(),
          getTotalCheckInsDb(user.id),
        ]);
        setDailyCheckInDone(todayCheckIn !== null);
        setWeekCheckIns(new Set(weekCheckInDays));
        setRoutineCompletedTodayStatus(hasCompleted);
        setCheckInHistory(checkInHistory);
        setUserBadges(earnedBadges);
        setAllBadges(catalog);
        setTotalCheckIns(total);

        // Calculate consecutive streak using local timezone dates
        if (checkInHistory.length > 0) {
          const sorted = [...checkInHistory].sort((a, b) =>
            new Date(b.check_in_date).getTime() - new Date(a.check_in_date).getTime()
          );
          const localDateStr = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            return `${y}-${m}-${day}`;
          };
          const today = localDateStr(new Date());
          const yesterdayDate = new Date();
          yesterdayDate.setDate(yesterdayDate.getDate() - 1);
          const yesterday = localDateStr(yesterdayDate);
          const mostRecent = sorted[0]?.check_in_date;
          if (mostRecent === today || mostRecent === yesterday) {
            let streak = 0;
            let current = mostRecent;
            for (const ci of sorted) {
              if (ci.check_in_date === current) {
                streak++;
                const d = new Date(current + "T12:00:00");
                d.setDate(d.getDate() - 1);
                current = localDateStr(d);
              } else break;
            }
            setStreakCount(streak);
          }
        }
      } catch (err) {
        console.error("Error loading check-in data:", err);
        setDailyCheckInDone(false);
        setWeekCheckIns(new Set());
        setRoutineCompletedTodayStatus(false);
      }
    })();
  }, [user]);

  // Reload completed routine status only when the user changes (not on every routine data update)
  // Completion status is updated optimistically after handleConfirmFinishWorkout/Diet/Habit
  React.useEffect(() => {
    if (!user) return;

    hasCompletedRoutineToday(user.id)
      .then(setRoutineCompletedTodayStatus)
      .catch(() => setRoutineCompletedTodayStatus(false));
  }, [user]);

  // Initialize workoutSeries with one series for each exercise when modal opens
  React.useEffect(() => {
    if (workoutModalOpen && userWorkouts.length > 0) {
      const initialSeries: Record<string, Array<{ series: number; kg: number; reps: number; completed: boolean }>> = {};
      userWorkouts.forEach((workout) => {
        if (!workoutSeries[workout.workout_id] || workoutSeries[workout.workout_id].length === 0) {
          initialSeries[workout.workout_id] = [
            {
              series: 1,
              kg: 0,
              reps: 0,
              completed: false,
            },
          ];
        }
      });
      if (Object.keys(initialSeries).length > 0) {
        setWorkoutSeries((prev) => ({
          ...prev,
          ...initialSeries,
        }));
      }

      // Load workout histories for all exercises in a single batch query
      if (user) {
        const workoutIds = userWorkouts.map((w) => w.workout_id).filter(Boolean);
        getWorkoutHistoriesBatchDb(user.id, workoutIds)
          .then(setWorkoutHistoriesMap)
          .catch((err) => console.error("Error loading workout histories:", err));
      }
    }
  }, [workoutModalOpen, userWorkouts]);

  const handleSelectGoal = async (goal: ProgrammedGoal) => {
    if (!user) {
      toast({
        title: "Faça login",
        description: "Você precisa estar logado para selecionar uma meta.",
        variant: "destructive",
      });
      return;
    }

    if (selectedGoalIds.includes(goal.id)) {
      toast({
        title: "Meta já selecionada",
        description: "Você já escolheu esta meta.",
        variant: "default",
      });
      return;
    }

    if (isAddingGoal) return;
    setIsAddingGoal(true);
    setSelectingGoalId(goal.id);

    try {
      await createUserGoalDb(
        goal.id,
        user.id,
        goal.type,
        goal.duration > 0 ? goal.duration : 30,
        goal.quantity > 0 ? goal.quantity : 1,
      );

      toast({
        title: "Meta selecionada!",
        description: goal.description,
      });

      setSelectedGoalIds([...selectedGoalIds, goal.id]);

      // Refresh userGoals so editingGoal.id picks up the new user_goal row
      const freshUserGoals = await getUserGoalsDb();
      setUserGoals(freshUserGoals);
    } catch (err: any) {
      console.error("Erro ao selecionar meta:", err);
      toast({
        title: "Erro ao selecionar meta",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSelectingGoalId(null);
      setIsAddingGoal(false);
    }
  };


  const handleAddRoutineClick = () => {
    setAddRoutineModalOpen(true);
    setSelectedRoutineType(null);
    setSelectedItems(new Set());
    setSearchQuery("");
    setSelectedMuscleGroups(new Set());
    setSelectedDietCategories(new Set());
  };

  const [isAddingFromWorkout, setIsAddingFromWorkout] = React.useState(false);

  const handleAddExerciseFromWorkout = () => {
    // When called from workout modal, automatically select exercises type and pre-check existing items
    setIsAddingFromWorkout(true);
    setAddRoutineModalOpen(true);
    setSelectedRoutineType(1); // 1 = Exercises
    const existingWorkoutIds = new Set(userWorkouts.map((w) => w.workout_id));
    setSelectedItems(existingWorkoutIds);
    setSearchQuery("");
    setSelectedMuscleGroups(new Set());
    setSelectedDietCategories(new Set());
    // Pre-fill routine name so custom exercises inherit it
    const routineLabel = selectedRoutineName && selectedRoutineName !== "__unnamed__" ? selectedRoutineName : "";
    setRoutineName(routineLabel);
    setAddToRoutineCardName(routineLabel || null);
  };

  const handleDeleteExercise = async (userWorkoutId: string) => {
    try {
      const { error } = await supabase
        .from("user_workouts")
        .delete()
        .eq("id", userWorkoutId);

      if (error) throw error;

      // Update local state
      setUserWorkouts((prev) => prev.filter((w) => w.id !== userWorkoutId));

      // Refresh routines data
      if (user) {
        Promise.all([getUserRoutinesDb(user.id), getUserWorkoutsDb(user.id)]).then(([routinesData, workoutsData]) => {
          setRoutines(routinesData);
          setUserWorkouts(workoutsData);
        });
      }

      toast({
        title: "Exercício removido",
        description: "O exercício foi removido da sua lista.",
      });
    } catch (err: any) {
      console.error("Error deleting exercise:", err);
      toast({
        title: "Erro ao remover exercício",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleSaveScheduledTime = async (scheduledTime: string | null) => {
    if (!scheduledTimeTarget) return;
    setIsSavingScheduledTime(true);
    try {
      const granted = scheduledTime ? await requestNotificationPermission() : true;
      if (scheduledTime && !granted) {
        toast({
          title: "Permissão necessária",
          description: "Ative as notificações nas configurações do navegador para receber lembretes.",
          variant: "destructive",
        });
        return;
      }
      await updateRoutineScheduledTimeDb(scheduledTimeTarget.type, scheduledTimeTarget.id, scheduledTime);
      // Update local state optimistically
      if (scheduledTimeTarget.type === "workout") {
        setUserWorkouts((prev) =>
          prev.map((w) => w.id === scheduledTimeTarget.id ? { ...w, scheduled_time: scheduledTime } : w)
        );
      } else if (scheduledTimeTarget.type === "diet") {
        setUserDiets((prev) =>
          prev.map((d) => d.id === scheduledTimeTarget.id ? { ...d, scheduled_time: scheduledTime } : d)
        );
      } else {
        setUserHabits((prev) =>
          prev.map((h) => h.id === scheduledTimeTarget.id ? { ...h, scheduled_time: scheduledTime } : h)
        );
      }
      await syncRoutineNotifications();
      toast({
        title: scheduledTime
          ? `Lembrete definido para ${formatScheduledTime(scheduledTime)}`
          : "Lembrete removido",
      });
    } catch {
      toast({ title: "Erro ao salvar lembrete", variant: "destructive" });
    } finally {
      setIsSavingScheduledTime(false);
    }
  };

  // routineCardName = the card's display label if named, null if it's the unnamed group
  const handleDeleteRoutineType = async (typeCode: number, routineCardName: string | null) => {
    try {
      if (!user || !supabase) return;

      const table =
        typeCode === 1 ? "user_workouts" : typeCode === 2 ? "user_diets" : "user_habits";
      const histTable =
        typeCode === 1 ? "user_workouts_hist" : typeCode === 2 ? "user_diets_hist" : "user_habits_hist";
      const histFk =
        typeCode === 1 ? "user_workout_id" : typeCode === 2 ? "user_diet_id" : "user_habit_id";

      // Step 1: fetch IDs of the user_* rows that will be deleted
      const idsQuery = routineCardName
        ? supabase.from(table).select("id").eq("user_id", user.id).eq("name", routineCardName)
        : supabase.from(table).select("id").eq("user_id", user.id).is("name", null);
      const { data: idsData } = await idsQuery;
      const rowIds = (idsData ?? []).map((r: any) => String(r.id));

      // Step 2: delete history records that reference those IDs
      if (rowIds.length > 0) {
        const { error: histError } = await supabase
          .from(histTable)
          .delete()
          .in(histFk, rowIds);
        if (histError) console.error("Erro ao deletar histórico:", histError);
      }

      // Step 3: Delete matching items from user_* table
      if (routineCardName) {
        // Named routine: delete only items with this name
        const { error } = await supabase
          .from(table)
          .delete()
          .eq("user_id", user.id)
          .eq("name", routineCardName);
        if (error) throw error;
      } else {
        // Unnamed routine group: delete items with no name
        const { error } = await supabase
          .from(table)
          .delete()
          .eq("user_id", user.id)
          .is("name", null);
        if (error) throw error;
      }

      // Delete matching entry from routines table
      if (routineCardName) {
        const { error } = await supabase
          .from("routines")
          .delete()
          .eq("user_id", user.id)
          .eq("type", typeCode)
          .eq("name", routineCardName);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("routines")
          .delete()
          .eq("user_id", user.id)
          .eq("type", typeCode)
          .is("name", null);
        if (error) throw error;
      }

      // Update local state — remove only matching items
      if (typeCode === 1) {
        setUserWorkouts((prev) =>
          prev.filter((w) =>
            routineCardName ? w.name !== routineCardName : Boolean(w.name),
          ),
        );
      } else if (typeCode === 2) {
        setUserDiets((prev) =>
          prev.filter((d) =>
            routineCardName ? d.name !== routineCardName : Boolean(d.name),
          ),
        );
      } else if (typeCode === 3) {
        setUserHabits((prev) =>
          prev.filter((h) =>
            routineCardName ? h.name !== routineCardName : Boolean(h.name),
          ),
        );
      }

      // Remove matching entries from routines list
      setRoutines((prev) =>
        prev.filter((r) => {
          if (r.type !== typeCode) return true;
          if (routineCardName) return r.name !== routineCardName;
          return Boolean(r.name); // keep named, remove unnamed
        }),
      );

      toast({
        title: "Rotina removida",
        description: routineCardName
          ? `"${routineCardName}" foi removida.`
          : "Rotina sem nome removida.",
      });
    } catch (err: any) {
      console.error("Error deleting routine:", err);
      toast({
        title: "Erro ao remover rotina",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Unified exercise list: local workouts + catalog (deduped by name)
  type UnifiedExercise = {
    key: string;
    id: string;
    name: string;
    description: string;
    photo: string | null;
    muscleGroup: string | null;
    workoutType: number | null;
    isLocal: boolean;
    catalogId?: number;
    catalogImage?: string | null;
  };

  const unifiedExercises = React.useMemo<UnifiedExercise[]>(() => {
    const localNames = new Set(workouts.map((w) => w.name.toLowerCase()));
    const catalogFiltered = catalogExercises.filter(
      (c) => !localNames.has(c.name.toLowerCase())
    );
    return [
      ...workouts.map((w) => ({
        key: `local-${w.id}`,
        id: w.id,
        name: w.name,
        description: w.description,
        photo: w.photo,
        muscleGroup: w.muscle_group || null,
        workoutType: w.type ?? null,
        isLocal: true,
      })),
      ...catalogFiltered.map((c) => ({
        key: `catalog-${c.id}`,
        id: `catalog-${c.id}`,
        name: c.name,
        description: c.description,
        photo: c.image,
        muscleGroup: c.category || null,
        workoutType: null,
        isLocal: false,
        catalogId: c.id,
        catalogImage: c.image,
      })),
    ];
  }, [workouts, catalogExercises]);

  // Get unique muscle groups from workouts
  const uniqueMuscleGroups = React.useMemo(() => {
    const groups = new Set<string>();
    unifiedExercises.forEach((ex) => {
      if (ex.muscleGroup) groups.add(ex.muscleGroup);
    });
    return Array.from(groups).sort();
  }, [unifiedExercises]);

  // Filter workouts based on search, muscle groups, and workout type
  const filteredWorkouts = React.useMemo(() => {
    return unifiedExercises.filter((ex) => {
      const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ex.description && ex.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesMuscleGroup =
        selectedMuscleGroups.size === 0 ||
        selectedMuscleGroups.has(ex.muscleGroup || "");
      const matchesType =
        selectedWorkoutType === null ||
        ex.workoutType === selectedWorkoutType;
      return matchesSearch && matchesMuscleGroup && matchesType;
    });
  }, [unifiedExercises, searchQuery, selectedMuscleGroups, selectedWorkoutType]);

  const uniqueDietCategories = React.useMemo(() => {
    const cats = new Set<string>();
    diets.forEach((d) => { if (d.category && d.category.trim()) cats.add(d.category.trim()); });
    return Array.from(cats).sort();
  }, [diets]);

  const filteredDiets = React.useMemo(() => {
    return diets.filter((d) => {
      const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedDietCategories.size === 0 ||
        selectedDietCategories.has(d.category || "");
      return matchesSearch && matchesCategory;
    });
  }, [diets, searchQuery, selectedDietCategories]);

  const handleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleToggleMuscleGroup = (muscleGroup: string) => {
    const newSelected = new Set(selectedMuscleGroups);
    if (newSelected.has(muscleGroup)) {
      newSelected.delete(muscleGroup);
    } else {
      newSelected.add(muscleGroup);
    }
    setSelectedMuscleGroups(newSelected);
  };

  const handleToggleDietCategory = (category: string) => {
    const newSelected = new Set(selectedDietCategories);
    if (newSelected.has(category)) {
      newSelected.delete(category);
    } else {
      newSelected.add(category);
    }
    setSelectedDietCategories(newSelected);
  };

  const handleAddSerie = (workoutId: string) => {
    const currentSeries = workoutSeries[workoutId] || [];
    const nextSeriesNumber = currentSeries.length + 1;

    // Pre-fill with last serie values, or with last history record if no series yet
    const lastSerie = currentSeries[currentSeries.length - 1];
    const lastHistory = workoutHistoriesMap[workoutId]?.[0];
    const defaultKg = lastSerie?.kg || lastHistory?.kilos || 0;
    const defaultReps = lastSerie?.reps || (lastHistory?.volume ? parseInt(lastHistory.volume) || 0 : 0);

    setWorkoutSeries({
      ...workoutSeries,
      [workoutId]: [
        ...currentSeries,
        {
          series: nextSeriesNumber,
          kg: defaultKg,
          reps: defaultReps,
          completed: false,
        },
      ],
    });
  };

  const handleUpdateSerie = (
    workoutId: string,
    seriesIndex: number,
    field: "kg" | "reps",
    value: number | string,
  ) => {
    const currentSeries = workoutSeries[workoutId] || [];
    const updated = [...currentSeries];

    // Handle empty values for numeric fields
    let numValue: number;
    if (value === "" || value === null) {
      numValue = 0;
    } else {
      numValue = typeof value === "string" ? parseFloat(value) || 0 : value;
    }

    updated[seriesIndex] = {
      ...updated[seriesIndex],
      [field]: numValue,
    };
    setWorkoutSeries({
      ...workoutSeries,
      [workoutId]: updated,
    });
  };

  const handleSetExerciseRestTime = (workoutId: string, seconds: number) => {
    setWorkoutExerciseRestTimes({
      ...workoutExerciseRestTimes,
      [workoutId]: seconds,
    });
  };

  const handleToggleSerieCompleted = (
    workoutId: string,
    seriesIndex: number,
  ) => {
    const currentSeries = workoutSeries[workoutId] || [];
    const updated = [...currentSeries];
    const isMarking = !updated[seriesIndex].completed;

    updated[seriesIndex] = {
      ...updated[seriesIndex],
      completed: isMarking,
    };
    setWorkoutSeries({
      ...workoutSeries,
      [workoutId]: updated,
    });

    // PR detection: check if this series beats the historical record
    if (isMarking) {
      const serie = updated[seriesIndex];
      const history = workoutHistoriesMap[workoutId] || [];
      const bestHistoricalKg = Math.max(0, ...history.map((h) => h.kilos || 0));
      // It's a PR if kg > 0 and exceeds all historical records
      if (serie.kg > 0 && serie.kg > bestHistoricalKg && bestHistoricalKg > 0) {
        const workout = userWorkouts.find((w) => w.workout_id === workoutId);
        if (workout?.workoutName) {
          setPrCelebration({ exerciseName: workout.workoutName, kg: serie.kg, reps: serie.reps });
          setTimeout(() => setPrCelebration(null), 4000);
        }
      }
    }

    // If marking as completed, open rest timer only if user set a time
    if (isMarking) {
      const restSeconds = workoutExerciseRestTimes[workoutId] || 0;
      if (restSeconds > 0) {
        setRestTimerExerciseId(workoutId);
        setRestTimerRemaining(restSeconds);
        setRestTimerModalOpen(true);
        // Sync to global context so FAB can show timer
        setGlobalRestTimerRemaining(restSeconds);
        setGlobalRestTimerTotal(restSeconds);
        setGlobalRestTimerActive(true);
        setGlobalRestTimerKey((prev) => prev + 1);
      }
    }
  };

  const handleDeleteSerie = (workoutId: string, seriesIndex: number) => {
    const currentSeries = workoutSeries[workoutId] || [];
    const updated = currentSeries.filter((_, idx) => idx !== seriesIndex);

    // Renumber the series
    const renumbered = updated.map((serie, idx) => ({
      ...serie,
      series: idx + 1,
    }));

    setWorkoutSeries({
      ...workoutSeries,
      [workoutId]: renumbered,
    });
  };

  const handleReorderExercises = (draggedIndex: number, targetIndex: number) => {
    const reordered = [...userWorkouts];
    const [dragged] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, dragged);
    setUserWorkouts(reordered);
  };

  // Sync local restTimerRemaining display from global context countdown
  React.useEffect(() => {
    setRestTimerRemaining(globalRestTimerRemaining);
  }, [globalRestTimerRemaining]);

  // When rest timer finishes: show toast and reopen dialog (only when workout modal is open, not minimized)
  React.useEffect(() => {
    if (!globalRestTimerActive && globalRestTimerTotal > 0 && globalRestTimerRemaining === 0 && workoutModalOpen) {
      toast({
        title: "Tempo de descanso terminou!",
        description: "Pronto para a próxima série?",
      });
      setRestTimerModalOpen(true);
    }
  }, [globalRestTimerActive]);


  const handleFinishWorkout = () => {
    if (!user) return;

    // Check if any exercises have completed series
    const hasCompletedSeries = userWorkouts.some((workout) => {
      const series = workoutSeries[workout.workout_id] || [];
      return series.some((s) => s.completed);
    });

    if (!hasCompletedSeries) {
      toast({
        title: "Nenhum exercício marcado como feito",
        description: "Marque pelo menos um exercício como concluído antes de finalizar.",
        variant: "destructive",
      });
      return;
    }

    // Show confirmation dialog
    setFinishWorkoutConfirmOpen(true);
  };

  const performAutoCheckIn = async () => {
    if (!user || dailyCheckInDone || checkInInProgressRef.current) return;
    checkInInProgressRef.current = true;
    try {
      await createCheckInDb(user.id);
      setDailyCheckInDone(true);
      setRoutineCompletedTodayStatus(true);
      const dayOfWeek = new Date().getDay();
      setWeekCheckIns((prev) => new Set(prev).add(dayOfWeek));

      // Award badges based on total check-ins and refresh local state
      try {
        await awardBadgesForCheckInsDb(user.id);
        const [earned, catalog, total] = await Promise.all([
          getUserBadgesDb(user.id),
          getAllBadgesDb(),
          getTotalCheckInsDb(user.id),
        ]);
        setUserBadges(earned);
        setAllBadges(catalog);
        setTotalCheckIns(total);
      } catch (badgeErr) {
        console.error("Error awarding badges:", badgeErr);
      }

      // Recalcula streak com dados reais do banco (evita incremento otimista incorreto)
      try {
        const freshHistory = await getCheckInHistoryDb(user.id, 60);
        setCheckInHistory(freshHistory);
        if (freshHistory.length > 0) {
          const sorted = [...freshHistory].sort((a, b) =>
            new Date(b.check_in_date).getTime() - new Date(a.check_in_date).getTime()
          );
          const localDateStr = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            return `${y}-${m}-${day}`;
          };
          const today = localDateStr(new Date());
          const yesterdayDate = new Date();
          yesterdayDate.setDate(yesterdayDate.getDate() - 1);
          const yesterday = localDateStr(yesterdayDate);
          const mostRecent = sorted[0]?.check_in_date;
          if (mostRecent === today || mostRecent === yesterday) {
            let streak = 0;
            let current = mostRecent;
            for (const ci of sorted) {
              if (ci.check_in_date === current) {
                streak++;
                const d = new Date(current + "T12:00:00");
                d.setDate(d.getDate() - 1);
                current = localDateStr(d);
              } else break;
            }
            setStreakCount(streak);
          } else {
            setStreakCount(0);
          }
        }
      } catch (historyErr) {
        console.error("Error refreshing streak:", historyErr);
      }

      // Update progress for all active goals
      const activeGoals = userGoals.filter((g) => g.perc < 100);
      const justCompletedGoals: typeof activeGoals = [];
      for (const goal of activeGoals) {
        const newProgress = goal.duration > 0
          ? Math.min(goal.duration, goal.days_completed + 1)
          : goal.days_completed + 1;
        const newPercentage = goal.duration > 0 ? Math.min(100, (newProgress / goal.duration) * 100) : 0;
        await updateUserGoalDb(goal.id, { days_completed: newProgress, perc: newPercentage });
        if (newPercentage >= 100) {
          justCompletedGoals.push(goal);
        }
      }
      if (activeGoals.length > 0) {
        const updatedGoals = await getUserGoalsDb();
        setUserGoals(updatedGoals);
      }

      // Show goal completion celebration for the first completed goal
      if (justCompletedGoals.length > 0) {
        const completedGoal = justCompletedGoals[0];
        const goalInfo = goals.find((g) => g.id === completedGoal.goal_id);
        const description = goalInfo?.description || "Meta";
        setGoalCompletionPostText(`🏆 Meta concluída: "${description}"\n\nFinalizei 100% dos meus check-ins nesta meta! Consistência e dedicação valeram a pena. 💪`);
        setGoalCompletedModal({ description, userGoalId: completedGoal.id });
      }

      toast({
        title: "Check-in automático realizado! ✓",
        description: "Sua rotina foi concluída e o check-in do dia foi registrado.",
      });
    } catch (err) {
      console.error("Auto check-in failed:", err);
    } finally {
      checkInInProgressRef.current = false;
    }
  };

  // Verifica se todas as dietas OU todos os hábitos foram concluídos e exibe o modal de humor
  const checkAndShowMoodModal = React.useCallback(
    (newDietIds: Set<string>, newHabitIds: Set<string>) => {
      if (moodModalShownRef.current || todayMood) return;

      const hasDiets = userDiets.length > 0;
      const hasHabits = userHabits.length > 0;
      if (!hasDiets && !hasHabits) return;

      const allDietsCompleted = hasDiets && userDiets.every((d) => newDietIds.has(d.id));
      const allHabitsCompleted = hasHabits && userHabits.every((h) => newHabitIds.has(h.id));

      if (allDietsCompleted || allHabitsCompleted) {
        moodModalShownRef.current = true;
        setMoodModalOpen(true);
      }
    },
    [userDiets, userHabits, todayMood],
  );

  const handleConfirmFinishWorkout = async () => {
    if (!user) return;

    try {
      // Check if at least one series is completed
      let hasCompletedSeries = false;
      for (const series of Object.values(workoutSeries)) {
        if (series.some((s) => s.completed)) {
          hasCompletedSeries = true;
          break;
        }
      }

      if (!hasCompletedSeries) {
        toast({
          title: "Nenhuma série registrada",
          description:
            "Adicione e preencha pelo menos uma série para salvar o treino.",
          variant: "destructive",
        });
        return;
      }

      // Save workout history for each exercise with completed series
      for (const [workoutId, series] of Object.entries(workoutSeries)) {
        const completedSeries = series.filter((s) => s.completed);
        if (completedSeries.length > 0) {
          // Find the user_workout row to get its PK (user_workout_id)
          const userWorkoutRow = userWorkouts.find((w) => w.workout_id === workoutId);
          const userWorkoutId = userWorkoutRow?.id ?? null;
          const isCardioExercise = (userWorkoutRow?.muscle_group || "").toLowerCase() === "cardio";
          for (let i = 0; i < completedSeries.length; i++) {
            const serie = completedSeries[i];
            try {
              await saveWorkoutHistoryDb(
                user.id,
                userWorkoutId,
                workoutId,
                serie.kg || null,
                isCardioExercise
                  ? (serie.reps ? String(serie.reps) : null)
                  : (serie.reps ? `${serie.reps} reps` : null),
              );
            } catch (historyErr) {
              console.error("Error saving workout history:", historyErr);
              // Continue even if history save fails
            }
          }
        }
      }

      // Calculate summary stats from completed series + detect PRs
      let totalVolume = 0;
      let totalKm = 0;
      let totalSeries = 0;
      const exerciseNames: string[] = [];
      const exercises: CompletedRoutineExercise[] = [];
      const prs: Array<{ exerciseName: string; kg: number; reps: number }> = [];
      let allCardio = true;

      for (const [workoutId, series] of Object.entries(workoutSeries)) {
        const completed = series.filter((s) => s.completed);
        if (completed.length > 0) {
          totalSeries += completed.length;
          const match = userWorkouts.find((w) => w.workout_id === workoutId);
          const isCardioExercise = (match?.muscle_group || "").toLowerCase() === "cardio";
          if (!isCardioExercise) allCardio = false;

          const bestKg = Math.max(...completed.map((s) => s.kg || 0));
          const totalExVol = completed.reduce((sum, s) => sum + (s.kg || 0) * (s.reps || 0), 0);

          for (const s of completed) {
            if (isCardioExercise) {
              totalKm += (s.kg || 0);
            } else {
              totalVolume += (s.kg || 0) * (s.reps || 0);
            }
          }
          if (match?.workoutName) {
            exerciseNames.push(match.workoutName);
            exercises.push({
              workoutId,
              workoutName: match.workoutName,
              muscleGroup: match.muscle_group || null,
              kilos: bestKg > 0 ? bestKg : null,
              volume: totalExVol > 0 ? String(Math.round(totalExVol * 10) / 10) : null,
            });
          }

          // PR detection: best set in this session vs best historical
          const bestSessionKg = bestKg;
          const history = workoutHistoriesMap[workoutId] || [];
          const bestHistoricalKg = history.length > 0 ? Math.max(...history.map((h) => h.kilos || 0)) : 0;
          if (bestSessionKg > 0 && bestSessionKg > bestHistoricalKg && match?.workoutName) {
            const bestSet = completed.find((s) => s.kg === bestSessionKg)!;
            prs.push({ exerciseName: match.workoutName, kg: bestSessionKg, reps: bestSet.reps || 0 });
          }
        }
      }

      // Show summary screen instead of closing immediately
      setWorkoutSummaryData({
        duration: workoutDuration,
        totalVolume: Math.round(totalVolume * 10) / 10,
        totalSeries,
        exerciseNames,
        exercises,
        routineName: selectedRoutineName === "__unnamed__" ? null : selectedRoutineName,
        prs,
        isAllCardio: allCardio && exerciseNames.length > 0,
        totalKm: Math.round(totalKm * 10) / 10,
      });
      setFinishWorkoutConfirmOpen(false);
      setWorkoutModalOpen(false);
      setWorkoutMinimized(false);
      setWorkoutSummaryOpen(true);
      setShowPostWorkoutNutrition(true);

      // Pre-build post description with linked goal if any
      if (user) {
        const rName = selectedRoutineName === "__unnamed__" ? null : selectedRoutineName;
        const rStr = rName ? `Treino de ${rName}` : "Treino concluído";
        const mins2 = Math.floor(workoutDuration / 60);
        const secs2 = workoutDuration % 60;
        const dStr = mins2 > 0 ? `${mins2}m ${secs2 > 0 ? `${secs2}s` : ""}`.trim() : `${secs2}s`;
        const exList = exerciseNames.length > 0 ? `\n🏋️ ${exerciseNames.join(" · ")}` : "";
        const volStr = Math.round(totalVolume * 10) / 10 > 0 ? `\n📦 Volume: ${Math.round(totalVolume * 10) / 10} kg` : "";
        if (prs.length > 0) {
          const prLines = prs
            .map((pr) => `🏆 ${pr.exerciseName}: ${pr.kg} kg${pr.reps > 0 ? ` × ${pr.reps} reps` : ""}`)
            .join("\n");
          const prVolumeStr = (allCardio && exerciseNames.length > 0)
            ? (Math.round(totalKm * 10) / 10 > 0 ? `📍 Distância: ${Math.round(totalKm * 10) / 10} km` : "")
            : (Math.round(totalVolume * 10) / 10 > 0 ? `📦 Volume: ${Math.round(totalVolume * 10) / 10} kg` : "");
          const prStats = [`⏱️ Duração: ${dStr}`, prVolumeStr, `✅ Séries: ${Math.round(totalSeries)}`]
            .filter(Boolean)
            .join("  ·  ");
          setWorkoutPostDescription(`🔥 Novo recorde pessoal!\n\n${prLines}\n\n${prStats}\n\n#Linka #PR #RecordePessoal #Fitness`);
        } else {
          setWorkoutPostDescription(`💪 ${rStr}!\n⏱️ ${dStr}${volStr}\n✅ ${Math.round(totalSeries)} séries${exList}\n\n#Linka #Fitness #Treino`);
        }
        // Find user_goal id linked to this routine (for post goal bar)
        const linkedRoutine = routines.find((r) => r.type === 1 && (rName ? r.name === rName : !r.name) && r.goal_id);
        const linkedUserGoal = linkedRoutine?.goal_id
          ? userGoals.find((ug) => String(ug.goal_id) === String(linkedRoutine.goal_id))
          : null;
        setWorkoutLinkedUserGoalId(linkedUserGoal?.id ?? null);
        getEnrichedDuelGroupsDb(user.id).then(({ myGroups }) => {
          setDuelGroups(myGroups.map((g) => ({ id: g.id, name: g.name, goal: g.goal })));
        }).catch(() => setDuelGroups([]));
      }

      // Reset workout state
      resetWorkoutState();

      // Refresh data in background
      Promise.all([
        getUserRoutinesDb(user.id),
        getUserWorkoutsDb(user.id),
        getUserDietsDb(user.id),
        getUserHabitsDb(user.id),
      ]).then(([routinesData, userWorkoutsData, userDietsData, userHabitsData]) => {
        setRoutines(routinesData);
        setUserWorkouts(userWorkoutsData);
        setUserDiets(userDietsData);
        setUserHabits(userHabitsData);
      });

      await performAutoCheckIn();
    } catch (err: any) {
      console.error("Error finishing workout:", err);
      toast({
        title: "Erro ao finalizar treino",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  const handleOpenWorkoutHistory = async (workout: Workout) => {
    if (!user) return;

    setSelectedWorkoutForHistory(workout);
    setWorkoutHistoryModalOpen(true);
    setIsLoadingHistory(true);

    try {
      const history = await getWorkoutHistoryDb(user.id, workout.id);
      setWorkoutHistory(history);
    } catch (err: any) {
      console.error("Error loading workout history:", err);
      toast({
        title: "Erro ao carregar histórico",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
      setWorkoutHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSaveRoutines = async (executeAtOverrides?: (string | null)[]) => {
    if (!user || selectedRoutineType === null || selectedItems.size === 0) {
      toast({
        title: "Selecione pelo menos um item",
        description: "Escolha um ou mais itens para adicionar.",
        variant: "destructive",
      });
      return;
    }

    setIsAddingRoutine(true);
    try {
      // When adding from workout modal, only insert IDs that don't already exist in user_workouts
      const existingWorkoutIds = new Set(userWorkouts.map((w) => w.workout_id));
      const allItemIds = Array.from(selectedItems);
      const itemIds = isAddingFromWorkout
        ? allItemIds.filter((id) => !existingWorkoutIds.has(id))
        : allItemIds;

      if (itemIds.length === 0 && !isAddingFromWorkout) {
        toast({ title: "Selecione pelo menos um item", description: "Escolha um ou mais itens para adicionar.", variant: "destructive" });
        setIsAddingRoutine(false);
        return;
      }

      const datesToSave = executeAtOverrides && executeAtOverrides.length > 0 ? executeAtOverrides : [null];

      if (selectedRoutineType === 1) {
        // Save workouts — only new ones
        if (itemIds.length > 0) {
          await createUserWorkoutsDb(user.id, itemIds, {
            name: routineName.trim() || undefined,
          });
        }
      } else if (selectedRoutineType === 2) {
        // Save diets — one entry per selected date
        for (const executeAt of datesToSave) {
          await createUserDietsDb(user.id, itemIds, {
            name: routineName.trim() || undefined,
            execute_at: executeAt ?? null,
          });
        }
      } else if (selectedRoutineType === 3) {
        // Save habits — one entry per selected date
        for (const executeAt of datesToSave) {
          await createUserHabitsDb(user.id, itemIds, {
            name: routineName.trim() || undefined,
            execute_at: executeAt ?? null,
          });
        }
      }

      const typeLabel =
        selectedRoutineType === 1
          ? "Exercício(s)"
          : selectedRoutineType === 2
            ? "Dieta(s)"
            : "Hábito(s)";

      toast({
        title: "Rotinas adicionadas!",
        description: `${itemIds.length} ${typeLabel} adicionado(s) com sucesso.`,
      });
      setAddRoutineModalOpen(false);
      setSelectedRoutineType(null);
      setSelectedItems(new Set());
      setRoutineName("");
      setSearchQuery("");
      setAddToRoutineCardName(null);
      setShowMuscleFilterPanel(false);
      setShowExecuteAtStep(false);

      // Refresh routines and items data to show newly added items
      if (user) {
        try {
          const [
            routinesData,
            userWorkoutsData,
            userDietsData,
            userHabitsData,
          ] = await Promise.all([
            getUserRoutinesDb(user.id),
            getUserWorkoutsDb(user.id),
            getUserDietsDb(user.id),
            getUserHabitsDb(user.id),
          ]);
          setRoutines(routinesData);
          setUserWorkouts(userWorkoutsData);
          setUserDiets(userDietsData);
          setUserHabits(userHabitsData);
        } catch (err) {
          console.error("Error refreshing routines and items:", err);
        }
      }
    } catch (err: any) {
      console.error("Error adding routines:", err);
      toast({
        title: "Erro ao adicionar rotinas",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsAddingRoutine(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <LoadingSpinner className="h-12 w-12" />
        <p className="text-sm text-muted-foreground">Carregando dados...</p>
      </div>
    );
  }

  const hasWaterHabit = userHabits.some((h) => String(h.habit_id) === "1");

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 overflow-x-hidden">
      <div className="flex items-start justify-between overflow-visible">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("goals_title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie suas metas e rotinas.
          </p>
        </div>

        {/* Badges Icon */}
        <div className="relative flex-shrink-0" style={{ width: 44, height: 44 }}>
          <button
            onClick={() => {
              setBadgesModalOpen(true);
              setHasNewBadge(false);
              if (user) {
                localStorage.setItem(
                  `ritmofit_badges_seen_${user.id}`,
                  String(getBadgeCount(weekCheckIns.size)),
                );
              }
            }}
            className={`h-10 w-10 rounded-full border flex items-center justify-center transition-all ${hasNewBadge ? "animate-pulse border-yellow-500 shadow-md shadow-yellow-500/30" : "border-border"}`}
            title="Ver insignias"
          >
            <span className="text-lg">🏆</span>
          </button>
          {hasNewBadge && (
            <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center pointer-events-none">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60" />
              <span className="relative inline-flex items-center justify-center rounded-full h-5 w-5 bg-red-500 ring-2 ring-background shadow-md">
                <span className="text-[9px] text-white font-bold leading-none">!</span>
              </span>
            </span>
          )}
        </div>
      </div>


      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="metas">Metas</TabsTrigger>
          <TabsTrigger value="rotinas">Rotinas</TabsTrigger>
        </TabsList>

        {/* Metas Tab */}
        <TabsContent value="metas" className="space-y-6 fade-in">
          {goals.length ? (
            <>
              {/* Selected Goals Section */}
              {selectedGoalIds.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Minhas Metas Ativas</h3>
                    <span className="text-xs text-muted-foreground">
                      {selectedGoalIds.length} meta{selectedGoalIds.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {goals
                      .filter((goal) => selectedGoalIds.includes(goal.id))
                      .map((goal) => {
                        // Find the user goal data to get actual duration/quantity
                        const userGoal = userGoals.find(ug => ug.goal_id === goal.id);
                        const duration = userGoal?.duration || goal.duration;
                        const quantity = userGoal?.quantity || goal.quantity;

                        const goalTypeLabel =
                          goal.type === 1
                            ? "Fitness"
                            : goal.type === 2
                              ? "Saúde"
                              : "Hábitos";
                        const goalTypeColor =
                          goal.type === 1
                            ? "bg-blue-500/10 text-blue-600"
                            : goal.type === 2
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-orange-500/10 text-orange-600";

                        return (
                          <Card
                            key={goal.id}
                            className="border-brand/40 bg-brand/5 overflow-hidden flex flex-col"
                          >
                            <div className={`px-3 py-1.5 ${goalTypeColor} text-xs font-semibold flex items-center justify-between`}>
                              <span>✓ {goalTypeLabel}</span>
                              {goal.created_by_user === 1 ? (
                                <span className="text-[10px] font-medium bg-orange-500/15 text-orange-600 px-1.5 py-0.5 rounded-full">Personalizada</span>
                              ) : (
                                <span className="text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">Padrão</span>
                              )}
                            </div>
                            <CardHeader className="pb-2 pt-2">
                              <CardTitle className="text-sm line-clamp-2">
                                {goal.description}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 flex-1 flex flex-col">
                              <div className="grid grid-cols-2 gap-1.5 text-center text-xs">
                                <div className="bg-muted rounded p-1.5">
                                  <p className="text-muted-foreground">Duração</p>
                                  <p className="font-bold">{duration}d</p>
                                </div>
                                <div className="bg-muted rounded p-1.5">
                                  <p className="text-muted-foreground">Frequência</p>
                                  <p className="font-bold">{quantity}</p>
                                </div>
                              </div>

                              {userGoal && (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Progresso</span>
                                    <span className="font-bold text-brand">{Math.round(userGoal.perc)}%</span>
                                  </div>
                                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className="bg-brand h-full rounded-full transition-all duration-500"
                                      style={{ width: `${userGoal.perc}%` }}
                                    />
                                  </div>
                                </div>
                              )}

                              <div className="flex gap-2 mt-auto">
                                {(() => {
                                  const linkedRoutines = routines.filter(
                                    (r) => r.goal_id && String(r.goal_id) === String(goal.id)
                                  );
                                  const linkedGroupCount = new Set(
                                    linkedRoutines.map((r) => `${r.type}::${r.name || r.type}`)
                                  ).size;
                                  return (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="flex-1 rounded-full text-xs h-8"
                                      onClick={() => {
                                        const mode = linkedRoutines.length > 0 ? "view" : "link";
                                        setGoalRoutineModalMode(mode);
                                        setGoalRoutineModalOpen(true);
                                        setSelectedGoalForRoutines(goal);
                                        setGoalRoutineSelection(new Set());
                                        setOpenRoutineTypes(new Set());
                                        setOpenRoutineItems(new Set());
                                      }}
                                    >
                                      {linkedGroupCount > 0
                                        ? `Ver Rotinas (${linkedGroupCount})`
                                        : "Vincular Rotina"}
                                    </Button>
                                  );
                                })()}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 rounded-full text-xs h-8"
                                  onClick={() => {
                                    setEditingGoal({
                                      id: userGoal?.id || goal.id,
                                      goal_id: goal.id,
                                      description: goal.description,
                                      duration: duration,
                                      quantity: quantity,
                                      type_goal: goal.type ?? 0,
                                      perc: userGoal?.perc ?? 0,
                                      days_completed: userGoal?.days_completed ?? 0,
                                      visibility: userGoal?.visibility ?? 1,
                                    });
                                    setEditGoalModalOpen(true);
                                  }}
                                >
                                  Editar
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Available Goals Section - Accordion */}
              {goals.filter((g) => !selectedGoalIds.includes(g.id)).length > 0 && (
                <Accordion type="single" collapsible defaultValue={selectedGoalIds.length === 0 ? "available-goals" : ""}>
                  <AccordionItem value="available-goals" className="border-border/60">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <h3 className="text-sm font-semibold">Metas Disponíveis</h3>
                        <span className="text-xs text-muted-foreground">
                          {goals.filter((g) => !selectedGoalIds.includes(g.id)).length} meta{
                            goals.filter((g) => !selectedGoalIds.includes(g.id)).length > 1 ? "s" : ""
                          }
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 pt-4">
                        {goals
                          .filter((g) => !selectedGoalIds.includes(g.id))
                          .map((goal) => {
                            const goalTypeLabel =
                              goal.type === 1
                                ? "Fitness"
                                : goal.type === 2
                                  ? "Saúde"
                                  : "Hábitos";
                            const goalTypeColor =
                              goal.type === 1
                                ? "bg-blue-500/10 text-blue-600"
                                : goal.type === 2
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : "bg-orange-500/10 text-orange-600";

                            const isEditingThis = editingAvailableGoalId === goal.id;
                            return (
                              <Card
                                key={goal.id}
                                className="border-border/60 hover:border-border/80 transition-all flex flex-col overflow-hidden"
                              >
                                <div className={`flex items-center justify-between px-3 py-1.5 ${goalTypeColor} text-xs font-semibold`}>
                                  <span className="flex items-center gap-1.5">
                                    {goalTypeLabel}
                                    {goal.created_by_user === 1 ? (
                                      <span className="text-[10px] font-medium bg-orange-500/15 text-orange-600 px-1.5 py-0.5 rounded-full">Personalizada</span>
                                    ) : (
                                      <span className="text-[10px] font-medium bg-black/10 text-current px-1.5 py-0.5 rounded-full">Padrão</span>
                                    )}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isEditingThis) {
                                        setEditingAvailableGoalId(null);
                                      } else {
                                        setEditingAvailableGoalId(goal.id);
                                        setEditAvailableGoalDuration(goal.duration);
                                        setEditAvailableGoalQuantity(goal.quantity);
                                      }
                                    }}
                                    className="opacity-70 hover:opacity-100 transition-opacity"
                                    aria-label="Editar meta"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </button>
                                </div>
                                <CardHeader className="pb-2 pt-2">
                                  <CardTitle className="text-sm line-clamp-2">
                                    {goal.description}
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 flex-1 flex flex-col">
                                  {isEditingThis ? (
                                    <div className="space-y-2">
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-1">Duração (dias)</p>
                                          <input
                                            type="number"
                                            min={1}
                                            value={editAvailableGoalDuration}
                                            onChange={(e) => setEditAvailableGoalDuration(parseInt(e.target.value) || 1)}
                                            className="w-full h-8 px-2 border border-border/60 rounded text-xs font-semibold bg-background text-center focus:border-brand focus:outline-none"
                                            style={{ fontSize: '16px' }}
                                          />
                                        </div>
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-1">Quantidade</p>
                                          <input
                                            type="number"
                                            min={1}
                                            value={editAvailableGoalQuantity}
                                            onChange={(e) => setEditAvailableGoalQuantity(parseInt(e.target.value) || 1)}
                                            className="w-full h-8 px-2 border border-border/60 rounded text-xs font-semibold bg-background text-center focus:border-brand focus:outline-none"
                                            style={{ fontSize: '16px' }}
                                          />
                                        </div>
                                      </div>
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="w-full rounded-full text-xs h-8"
                                        disabled={selectingGoalId === goal.id}
                                        onClick={() => {
                                          const customGoal = { ...goal, duration: editAvailableGoalDuration, quantity: editAvailableGoalQuantity };
                                          setEditingAvailableGoalId(null);
                                          handleSelectGoal(customGoal);
                                        }}
                                      >
                                        {selectingGoalId === goal.id ? "Salvando..." : "Confirmar"}
                                      </Button>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="grid grid-cols-2 gap-1.5 text-center text-xs">
                                        <div className="bg-muted rounded p-1.5">
                                          <p className="text-muted-foreground">Duração</p>
                                          <p className="font-bold">{goal.duration}d</p>
                                        </div>
                                        <div className="bg-muted rounded p-1.5">
                                          <p className="text-muted-foreground">Qtd</p>
                                          <p className="font-bold">{goal.quantity}</p>
                                        </div>
                                      </div>
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="w-full rounded-full mt-auto text-xs h-8"
                                        disabled={selectingGoalId === goal.id}
                                        onClick={() => handleSelectGoal(goal)}
                                      >
                                        {selectingGoalId === goal.id ? "Salvando..." : "Selecionar"}
                                      </Button>
                                    </>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
              {/* Create custom goal button */}
              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full gap-2 text-sm"
                  onClick={() => setCreateGoalDrawerOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Não encontrei minha meta
                </Button>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma meta disponível no momento.
              </p>
              <Button
                type="button"
                variant="outline"
                className="rounded-full gap-2 text-sm mt-4"
                onClick={() => setCreateGoalDrawerOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Criar Meta Personalizada
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Rotinas Tab */}
        <TabsContent value="rotinas" className="space-y-4 fade-in px-2">
          {/* Daily Check-in Block */}
          <Card className={`border-2 ${dailyCheckInDone
            ? "border-green-500/50 bg-green-500/5"
            : "border-brand/30 bg-brand/5"
            }`}>
            <CardContent className="pt-6 pb-6">
              <div className="space-y-4">
                {/* Title and Description */}
                <div className="text-center">
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    {dailyCheckInDone ? "Check-in realizado hoje! ✓" : "Check-in Diário"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dailyCheckInDone
                      ? "Volte amanhã para fazer novo check-in"
                      : "Conclua uma rotina e faça seu check-in"}
                  </p>
                </div>

                {/* Days of Week with week navigation */}
                {(() => {
                  const today = new Date();
                  // Compute the Sunday of the displayed week
                  const displayedSunday = new Date(today);
                  displayedSunday.setDate(today.getDate() - today.getDay() + checkInWeekOffset * 7);
                  displayedSunday.setHours(0, 0, 0, 0);
                  const displayedWeekStart = displayedSunday.toISOString().split("T")[0];
                  const displayedWeekEnd = new Date(displayedSunday);
                  displayedWeekEnd.setDate(displayedSunday.getDate() + 6);
                  const displayedWeekEndStr = displayedWeekEnd.toISOString().split("T")[0];

                  // Check which days in this week had check-ins
                  const displayedDays = new Set<number>(
                    checkInHistory
                      .filter((ci) => ci.check_in_date >= displayedWeekStart && ci.check_in_date <= displayedWeekEndStr)
                      .map((ci) => new Date(ci.check_in_date + "T12:00:00").getDay())
                  );
                  // For current week use live weekCheckIns
                  const daysToShow = checkInWeekOffset === 0 ? weekCheckIns : displayedDays;

                  const isCurrentWeek = checkInWeekOffset === 0;
                  const weekLabel = isCurrentWeek ? "Esta semana" : (() => {
                    const end = new Date(displayedWeekEnd);
                    return `${displayedSunday.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} – ${end.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
                  })();

                  return (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <button
                          onClick={() => setCheckInWeekOffset((o) => o - 1)}
                          className="p-1.5 rounded-full hover:bg-muted transition-colors"
                        >
                          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <span className="text-[11px] text-muted-foreground font-medium">{weekLabel}</span>
                        <button
                          onClick={() => setCheckInWeekOffset((o) => Math.min(0, o + 1))}
                          className={`p-1.5 rounded-full transition-colors ${isCurrentWeek ? "opacity-30 cursor-default" : "hover:bg-muted"}`}
                          disabled={isCurrentWeek}
                        >
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                      <div className="grid grid-cols-7 gap-1 w-full">
                        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((day, index) => (
                          <div
                            key={index}
                            className={`flex flex-col items-center justify-center aspect-square rounded-lg transition-all ${daysToShow.has(index)
                              ? "bg-brand text-white font-bold"
                              : "bg-muted text-muted-foreground"
                              }`}
                          >
                            <span className="text-[10px] font-medium">{day}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}

                {/* Streak inside check-in card */}
                {streakCount > 0 && (
                  <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 mt-1 ${!dailyCheckInDone
                    ? "bg-muted/40 border border-muted-foreground/20"
                    : streakCount >= 30
                      ? "bg-purple-500/10 border border-purple-500/30"
                      : streakCount >= 7
                        ? "bg-orange-500/10 border border-orange-500/30"
                        : "bg-brand/10 border border-brand/20"
                    }`}>
                    <span className={`text-2xl leading-none ${!dailyCheckInDone ? "grayscale opacity-40" : ""}`}>
                      {streakCount >= 30 ? "👑" : streakCount >= 7 ? "🔥" : "⭐"}
                    </span>
                    <div className={`flex-1 min-w-0 ${!dailyCheckInDone ? "opacity-50" : ""}`}>
                      <p className="text-xs font-bold leading-tight">
                        {streakCount} {streakCount === 1 ? "dia" : "dias"} consecutivos!
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {!dailyCheckInDone
                          ? "Faça o check-in para manter a sequência!"
                          : streakCount >= 30
                            ? "Você é lendário!"
                            : streakCount >= 7
                              ? "Uma semana inteira! 💪"
                              : "Continue todos os dias!"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ─── Card de Hidratação ──────────────────────────────────────── */}
          {hasWaterHabit && <Card className="border border-blue-500/30 bg-blue-500/5">
            <CardContent className="pt-4 pb-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-semibold">Hidratação</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {hydrationMl}ml / {hydrationGoalMl}ml
                  </span>
                </div>

                {/* Barra de progresso */}
                <Progress
                  value={Math.min(100, (hydrationMl / hydrationGoalMl) * 100)}
                  className="h-2"
                />

                {/* Botões de ação */}
                <div className="flex items-center gap-2">
                  {[250, 350, 500].map((ml) => (
                    <Button
                      key={ml}
                      size="sm"
                      variant="outline"
                      disabled={isAddingHydration}
                      className="flex-1 h-8 text-xs border-blue-500/30 hover:bg-blue-500/10"
                      onClick={async () => {
                        if (!user) return;
                        setIsAddingHydration(true);
                        const prev = hydrationMl;
                        setHydrationMl((v) => v + ml);
                        try {
                          await addHydrationDb(user.id, ml);
                          if (hydrationMl + ml >= hydrationGoalMl && prev < hydrationGoalMl) {
                            toast({ title: "Meta de hidratação atingida! 💧", description: "Ótimo trabalho!" });
                            awardNutritionBadgesDb(user.id).catch(() => { });
                          }
                        } catch {
                          setHydrationMl(prev);
                          toast({ title: "Erro ao registrar hidratação", variant: "destructive" });
                        } finally {
                          setIsAddingHydration(false);
                        }
                      }}
                    >
                      +{ml}ml
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isAddingHydration}
                    className="h-8 px-2"
                    title="Desfazer"
                    onClick={async () => {
                      if (!user) return;
                      setIsAddingHydration(true);
                      try {
                        await undoLastHydrationDb(user.id);
                        const updated = await getTodayHydrationDb(user.id);
                        setHydrationMl(updated);
                      } catch {
                        toast({ title: "Erro ao desfazer", variant: "destructive" });
                      } finally {
                        setIsAddingHydration(false);
                      }
                    }}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                </div>

                {hydrationMl >= hydrationGoalMl && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium text-center">
                    Meta atingida hoje! 💧
                  </p>
                )}
              </div>
            </CardContent>
          </Card>}

          {/* ─── Card de Macro do Dia ─────────────────────────────────────── */}
          {todayMacro && (todayMacro.calories > 0 || todayMacro.protein_g > 0) && (
            <Card className="border border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="pt-4 pb-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Salad className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm font-semibold">Macro de Hoje</span>
                    </div>
                    {todayMacro.calories > 0 && (
                      <span className="text-xs text-muted-foreground">{Math.round(todayMacro.calories)} kcal</span>
                    )}
                  </div>

                  {/* Macro chips */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-blue-500/10 p-2 text-center">
                      <p className="text-xs text-muted-foreground">Proteína</p>
                      <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{Math.round(todayMacro.protein_g)}g</p>
                    </div>
                    <div className="rounded-lg bg-amber-500/10 p-2 text-center">
                      <p className="text-xs text-muted-foreground">Carboidrato</p>
                      <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{Math.round(todayMacro.carbs_g)}g</p>
                    </div>
                    <div className="rounded-lg bg-red-500/10 p-2 text-center">
                      <p className="text-xs text-muted-foreground">Gordura</p>
                      <p className="text-sm font-bold text-red-600 dark:text-red-400">{Math.round(todayMacro.fat_g)}g</p>
                    </div>
                  </div>

                  {/* Score de qualidade */}
                  {(todayMacro.quality_counts.in_natura + todayMacro.quality_counts.processado + todayMacro.quality_counts.ultraprocessado) > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">Qualidade da dieta</p>
                      <div className="flex gap-2 flex-wrap">
                        {todayMacro.quality_counts.in_natura > 0 && (
                          <span className="text-xs bg-green-500/10 text-green-700 dark:text-green-400 px-2 py-1 rounded-full flex items-center gap-1">
                            <Apple className="h-3 w-3" /> {todayMacro.quality_counts.in_natura}x Natural
                          </span>
                        )}
                        {todayMacro.quality_counts.processado > 0 && (
                          <span className="text-xs bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded-full">
                            {todayMacro.quality_counts.processado}x Processado
                          </span>
                        )}
                        {todayMacro.quality_counts.ultraprocessado > 0 && (
                          <span className="text-xs bg-orange-500/10 text-orange-700 dark:text-orange-400 px-2 py-1 rounded-full flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> {todayMacro.quality_counts.ultraprocessado}x Ultra
                          </span>
                        )}
                      </div>
                      {todayMacro.quality_counts.ultraprocessado === 0 && (todayMacro.quality_counts.in_natura + todayMacro.quality_counts.processado) > 0 && (
                        <p className="text-xs text-green-600 dark:text-green-400">Sem ultraprocessados hoje! 🥗</p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {(userWorkouts.length > 0 || userDiets.length > 0 || userHabits.length > 0) ? (
            <div className="space-y-4">
              {/* Group items by name directly from user items (no dependency on routines table) */}
              {(() => {
                const cards: any[] = [];

                // Helper: group items of a type by name
                const groupItemsByName = (items: any[], typeCode: number, defaultLabel: string) => {
                  const namedGroups = new Map<string, any[]>();
                  const unnamedItems: any[] = [];

                  items.forEach((item) => {
                    if (item.name) {
                      const existing = namedGroups.get(item.name) || [];
                      existing.push(item);
                      namedGroups.set(item.name, existing);
                    } else {
                      unnamedItems.push(item);
                    }
                  });

                  // Named groups (each distinct name = one card)
                  // For exercises, sort cards by most recent created_at
                  const namedEntries = Array.from(namedGroups.entries());
                  if (typeCode === 1) {
                    namedEntries.sort(([, aItems], [, bItems]) => {
                      const aDate = aItems.reduce((max: string, i: any) => i.created_at > max ? i.created_at : max, "");
                      const bDate = bItems.reduce((max: string, i: any) => i.created_at > max ? i.created_at : max, "");
                      return bDate.localeCompare(aDate);
                    });
                  }
                  namedEntries.forEach(([name, groupItems]) => {
                    const lastDate = typeCode === 1
                      ? groupItems.reduce((max: string, i: any) => (i.created_at || "") > max ? (i.created_at || "") : max, "")
                      : null;
                    cards.push({
                      key: `named-${typeCode}-${name}`,
                      typeCode,
                      displayLabel: name,
                      itemsForRoutine: groupItems,
                      isNamed: true,
                      lastDate,
                    });
                  });

                  // Unnamed items grouped into one card
                  if (unnamedItems.length > 0) {
                    const lastDate = typeCode === 1
                      ? unnamedItems.reduce((max: string, i: any) => (i.created_at || "") > max ? (i.created_at || "") : max, "")
                      : null;
                    cards.push({
                      key: `unnamed-${typeCode}`,
                      typeCode,
                      displayLabel: defaultLabel,
                      itemsForRoutine: unnamedItems,
                      isNamed: false,
                      lastDate,
                    });
                  }
                };

                groupItemsByName(userWorkouts, 1, "Exercícios");
                groupItemsByName(userDiets, 2, "Dietas");
                groupItemsByName(userHabits, 3, "Hábitos");

                // Group cards by section (type)
                const sectionConfigs = [
                  { sType: 1, sLabel: "🏋️ Exercícios", sColor: "text-blue-600" },
                  { sType: 2, sLabel: "🥗 Dietas", sColor: "text-emerald-600" },
                  { sType: 3, sLabel: "🌱 Hábitos", sColor: "text-orange-600" },
                ];

                return sectionConfigs.flatMap(({ sType, sLabel, sColor }) => {
                  const sectionCards = cards.filter((c) => c.typeCode === sType);
                  if (sectionCards.length === 0) return [];

                  const isCollapsed = collapsedSections.has(sType);

                  const sectionHeader = (
                    <button
                      key={`section-header-${sType}`}
                      onClick={() => handleToggleSection(sType)}
                      className={`w-full flex items-center justify-between px-1 pt-2 pb-0.5 ${sColor} group`}
                    >
                      <span className="text-xs font-semibold uppercase tracking-wider">{sLabel}</span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform duration-200 ${isCollapsed ? "rotate-180" : ""
                          }`}
                      />
                    </button>
                  );

                  if (isCollapsed) return [sectionHeader];

                  const cardElements = sectionCards.map((card) => {
                    const { key, typeCode, displayLabel, itemsForRoutine, isNamed, lastDate } = card;
                    const isExpanded = expandedRoutineId === key;
                    const lastDateLabel = typeCode === 1 && lastDate
                      ? (() => {
                        const d = new Date(lastDate);
                        const today = new Date();
                        const diffMs = today.getTime() - d.getTime();
                        const diffDays = Math.floor(diffMs / 86400000);
                        if (diffDays === 0) return "Hoje";
                        if (diffDays === 1) return "Ontem";
                        return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
                      })()
                      : null;

                    return (
                      <Card
                        key={key}
                        className="border-border/60 overflow-hidden min-w-0"
                      >
                        <div className="w-full p-3 flex items-center gap-1 hover:bg-muted/30 transition-colors text-left min-w-0">
                          {/* Text — flush left, takes remaining space */}
                          <button
                            onClick={() =>
                              setExpandedRoutineId(
                                isExpanded ? null : key,
                              )
                            }
                            className="flex-1 flex flex-col justify-center min-w-0 text-left"
                          >
                            <p className="text-sm font-medium truncate w-full">{displayLabel}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {itemsForRoutine.length > 0
                                ? `${itemsForRoutine.length} item(ns)`
                                : "Sem itens"}
                              {lastDateLabel && (
                                <span className="ml-1.5 text-[10px] text-brand/70">· {lastDateLabel}</span>
                              )}
                            </p>
                          </button>

                          {/* Play button for exercises — left of chevron */}
                          {typeCode === 1 && itemsForRoutine.length > 0 && (
                            <button
                              onClick={() => {
                                setSelectedRoutineName(isNamed ? displayLabel : "__unnamed__");
                                setWorkoutModalOpen(true);
                              }}
                              className="p-2 rounded-lg bg-brand/10 hover:bg-brand/20 transition-colors flex-shrink-0"
                            >
                              <Play className="h-5 w-5 text-brand" />
                            </button>
                          )}

                          {/* Chevron */}
                          <button
                            onClick={() => setExpandedRoutineId(isExpanded ? null : key)}
                            className="p-1.5 hover:bg-muted/50 rounded transition-colors flex-shrink-0"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            )}
                          </button>

                          {/* Dropdown menu for routine actions */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-2 hover:bg-muted/50 rounded transition-colors flex-shrink-0">
                                <MoreVertical className="h-4 w-4 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem
                                onClick={() => {
                                  setAddRoutineModalOpen(true);
                                  setSelectedRoutineType(typeCode);
                                  setSelectedItems(new Set());
                                  setSearchQuery("");
                                  setSelectedMuscleGroups(new Set());
                                  setSelectedDietCategories(new Set());
                                  setShowMuscleFilterPanel(false);
                                  // Pre-fill routine name when adding to an existing named routine
                                  setRoutineName(isNamed ? displayLabel : "");
                                  setAddToRoutineCardName(isNamed ? displayLabel : null);
                                }}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                {typeCode === 1
                                  ? "Adicionar exercícios"
                                  : typeCode === 2
                                    ? "Adicionar dietas"
                                    : "Adicionar hábito"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setRenameRoutineData({ typeCode, oldName: isNamed ? displayLabel : null });
                                  setRenameRoutineValue(isNamed ? displayLabel : "");
                                  setRenameRoutineOpen(true);
                                }}
                              >
                                <Edit2 className="h-4 w-4 mr-2" />
                                Editar rotina
                              </DropdownMenuItem>
                              {!routines.some(
                                (r) =>
                                  r.type === typeCode &&
                                  (isNamed ? r.name === displayLabel : !r.name) &&
                                  r.goal_id
                              ) && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setLinkGoalRoutineKey({ typeCode, name: isNamed ? displayLabel : null });
                                      setLinkGoalForRoutineOpen(true);
                                    }}
                                  >
                                    <Tag className="h-4 w-4 mr-2" />
                                    Vincular Meta
                                  </DropdownMenuItem>
                                )}
                              {(typeCode === 2 || typeCode === 3) && (() => {
                                const completedIds = typeCode === 2 ? completedDietIds : completedHabitIds;
                                const hasCompleted = itemsForRoutine.some((item: any) => completedIds.has(item.id));
                                if (!hasCompleted) return null;
                                const isShowing = showCompletedForRoutine.has(key);
                                return (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setShowCompletedForRoutine((prev) => {
                                        const next = new Set(prev);
                                        if (isShowing) next.delete(key);
                                        else next.add(key);
                                        return next;
                                      });
                                    }}
                                  >
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    {isShowing ? "Ocultar Concluídas" : "Mostrar Concluídas"}
                                  </DropdownMenuItem>
                                );
                              })()}
                              <DropdownMenuItem
                                onClick={() => handleDeleteRoutineType(typeCode, isNamed ? displayLabel : null)}
                                className="text-red-500"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir rotina
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Expanded content */}
                        {isExpanded && (
                          <div className="border-t border-border/60 bg-muted/20 p-2.5 space-y-1.5 overflow-hidden">
                            {(() => {
                              const showCompleted = showCompletedForRoutine.has(key);
                              const visibleItems = itemsForRoutine.filter((item: any) => {
                                if (typeCode === 2) return showCompleted || !completedDietIds.has(item.id);
                                if (typeCode === 3) return showCompleted || !completedHabitIds.has(item.id);
                                return true;
                              });
                              const allCompleted = visibleItems.length === 0 && itemsForRoutine.length > 0 && (typeCode === 2 || typeCode === 3);
                              return visibleItems.length > 0 ? (
                                visibleItems.map((item: any) => (
                                  <div
                                    key={item.id}
                                    className="space-y-1.5"
                                  >
                                    <div className="flex items-start gap-2.5 rounded-lg min-w-0 overflow-hidden">
                                      {/* Mark as completed checkbox for diets (left side) */}
                                      {typeCode === 2 && (
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            const isCompleting = !completedDietIds.has(item.id);
                                            const previousDietIds = new Set(completedDietIds);
                                            const newCompletedIds = new Set(completedDietIds);
                                            if (isCompleting) {
                                              newCompletedIds.add(item.id);
                                            } else {
                                              newCompletedIds.delete(item.id);
                                            }
                                            setCompletedDietIds(newCompletedIds);
                                            try {
                                              await toggleUserDietCompletionDb(item.id, isCompleting);
                                              if (isCompleting && user) {
                                                await saveDietHistoryDb(
                                                  user.id,
                                                  item.id,
                                                  Number(item.diet_id),
                                                  item.quantity ?? null,
                                                );
                                                await performAutoCheckIn();
                                                // Atualiza macro do dia e verifica badges nutricionais
                                                getTodayMacroSummaryDb(user.id).then(setTodayMacro).catch(() => { });
                                                awardNutritionBadgesDb(user.id).catch(() => { });
                                                // Verifica se todas as dietas foram concluídas para exibir modal de humor
                                                checkAndShowMoodModal(newCompletedIds, completedHabitIds);
                                                // Feedback de qualidade para ultraprocessados
                                                if (item.dietFoodQuality === "ultraprocessado") {
                                                  toast({
                                                    title: "Registrado 📝",
                                                    description: "Lembre-se: equilíbrio é a chave, não perfeição.",
                                                  });
                                                }
                                              }
                                              if (!isCompleting) {
                                                // Atualiza macro ao desmarcar
                                                if (user) getTodayMacroSummaryDb(user.id).then(setTodayMacro).catch(() => { });
                                                toast({
                                                  title: "Dieta desmarcada",
                                                });
                                              }
                                            } catch (err) {
                                              // Rollback para o estado anterior ao update otimista
                                              setCompletedDietIds(previousDietIds);
                                              toast({
                                                title: "Erro ao atualizar status da dieta",
                                                variant: "destructive",
                                              });
                                            }
                                          }}
                                          className={`py-1 px-2 rounded text-xs font-semibold transition-all flex-shrink-0 ${completedDietIds.has(item.id)
                                            ? "bg-green-500/20 text-green-700"
                                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                                            }`}
                                        >
                                          {completedDietIds.has(item.id) ? "✓" : "○"}
                                        </button>
                                      )}

                                      {typeCode === 3 && (
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            const isCompleting = !completedHabitIds.has(item.id);
                                            const previousHabitIds = new Set(completedHabitIds);
                                            const newCompletedIds = new Set(completedHabitIds);
                                            if (isCompleting) {
                                              newCompletedIds.add(item.id);
                                            } else {
                                              newCompletedIds.delete(item.id);
                                            }
                                            setCompletedHabitIds(newCompletedIds);
                                            try {
                                              await toggleUserHabitCompletionDb(item.id, isCompleting);
                                              if (isCompleting && user) {
                                                await saveHabitHistoryDb(
                                                  user.id,
                                                  item.id,
                                                  Number(item.habit_id),
                                                  item.quantity ?? null,
                                                  item.frequency ?? null,
                                                );
                                                // Hábito de beber água (habit_id = 1): registra 2000ml em hydration_logs
                                                if (String(item.habit_id) === "1") {
                                                  await addHydrationDb(user.id, 2000);
                                                  getTodayHydrationDb(user.id).then(setHydrationMl).catch(() => { });
                                                }
                                                await performAutoCheckIn();
                                                // Verifica se todos os hábitos foram concluídos para exibir modal de humor
                                                checkAndShowMoodModal(completedDietIds, newCompletedIds);
                                              }
                                              if (!isCompleting) {
                                                toast({
                                                  title: "Hábito desmarcado",
                                                });
                                              }
                                            } catch (err) {
                                              // Rollback para o estado anterior ao update otimista
                                              setCompletedHabitIds(previousHabitIds);
                                              toast({
                                                title: "Erro ao atualizar status do hábito",
                                                variant: "destructive",
                                              });
                                            }
                                          }}
                                          className={`py-1 px-2 rounded text-xs font-semibold transition-all flex-shrink-0 ${completedHabitIds.has(item.id)
                                            ? "bg-green-500/20 text-green-700"
                                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                                            }`}
                                        >
                                          {completedHabitIds.has(item.id) ? "✓" : "○"}
                                        </button>
                                      )}

                                      {/* Item content */}
                                      <div className="flex-1 flex items-start gap-3 p-2 rounded-lg min-w-0">
                                        {/* Image thumbnail */}
                                        {typeCode === 1 && (
                                          <button
                                            type="button"
                                            className="flex-shrink-0 rounded overflow-hidden"
                                            onClick={(e) => { e.stopPropagation(); setImageZoom({ src: item.workoutPhoto || null, name: item.workoutName || "", description: item.workoutDescription || undefined }); }}
                                          >
                                            <ExerciseImage
                                              photo={item.workoutPhoto || null}
                                              name={item.workoutName || ""}
                                              muscleGroup={item.muscle_group || null}
                                              className="h-10 w-10"
                                            />
                                          </button>
                                        )}
                                        {typeCode === 2 && (
                                          <button
                                            type="button"
                                            className="flex-shrink-0 rounded overflow-hidden"
                                            onClick={(e) => { e.stopPropagation(); setImageZoom({ src: item.dietPhoto || null, name: item.dietName || "", description: item.dietDescription || undefined }); }}
                                          >
                                            <DietImage
                                              photo={item.dietPhoto || null}
                                              name={item.dietName || ""}
                                              className="h-10 w-10"
                                            />
                                          </button>
                                        )}
                                        <div className="flex-1 min-w-0 text-left">
                                          {typeCode === 1 ? (
                                            <button
                                              className="text-sm font-medium truncate block text-left hover:opacity-80 transition-opacity"
                                              onClick={() => handleOpenWorkoutHistory({
                                                id: item.workout_id,
                                                name: item.workoutName,
                                                description: item.workoutDescription || undefined,
                                                photo: item.workoutPhoto || undefined,
                                              } as any)}
                                            >
                                              {item.workoutName?.length > 35 ? item.workoutName.slice(0, 35) + "…" : item.workoutName}
                                            </button>
                                          ) : (
                                            <p className="text-sm font-medium truncate">
                                              {(typeCode === 2 ? item.dietName : item.habitName)?.length > 35
                                                ? (typeCode === 2 ? item.dietName : item.habitName).slice(0, 35) + "…"
                                                : (typeCode === 2 ? item.dietName : item.habitName)}
                                            </p>
                                          )}
                                          {(item.workoutDescription ||
                                            item.dietDescription ||
                                            item.habitDescription) && (
                                              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                                {typeCode === 1
                                                  ? item.workoutDescription
                                                  : typeCode === 2
                                                    ? item.dietDescription
                                                    : item.habitDescription}
                                              </p>
                                            )}
                                          {typeCode === 2 && (
                                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                              {item.dietCalories != null && (
                                                <span className="text-xs text-muted-foreground">{item.dietCalories} cal</span>
                                              )}
                                              {item.dietProtein != null && (
                                                <span className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">P {item.dietProtein}g</span>
                                              )}
                                              {item.dietCarbs != null && (
                                                <span className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">C {item.dietCarbs}g</span>
                                              )}
                                              {item.dietFat != null && (
                                                <span className="text-xs bg-red-500/10 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">G {item.dietFat}g</span>
                                              )}
                                              {item.dietFoodQuality === "ultraprocessado" && (
                                                <span className="text-xs bg-orange-500/10 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                                  <AlertCircle className="h-2.5 w-2.5" /> Ultra
                                                </span>
                                              )}
                                              {item.dietFoodQuality === "in_natura" && (
                                                <span className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                                  <Apple className="h-2.5 w-2.5" /> Natural
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Scheduled time (notification) button */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const routineType: RoutineType =
                                            typeCode === 1 ? "workout" : typeCode === 2 ? "diet" : "habit";
                                          const itemName =
                                            typeCode === 1
                                              ? item.workoutName
                                              : typeCode === 2
                                                ? item.dietName
                                                : item.habitName;
                                          setScheduledTimeTarget({
                                            id: item.id,
                                            type: routineType,
                                            name: itemName || "Item",
                                            currentTime: item.scheduled_time ?? null,
                                          });
                                          setScheduledTimeDrawerOpen(true);
                                        }}
                                        className={`p-2 hover:bg-brand/10 rounded transition-colors flex-shrink-0 ${item.scheduled_time ? "text-brand" : "text-muted-foreground"}`}
                                        title={item.scheduled_time ? `Lembrete: ${formatScheduledTime(item.scheduled_time)}` : "Definir lembrete"}
                                      >
                                        {item.scheduled_time ? (
                                          <Bell className="h-4 w-4" />
                                        ) : (
                                          <BellOff className="h-4 w-4" />
                                        )}
                                      </button>

                                      {/* Delete button */}
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          if (typeCode === 1) {
                                            handleDeleteExercise(item.id);
                                          } else {
                                            const table = typeCode === 2 ? "user_diets" : "user_habits";
                                            const { error } = await supabase.from(table).delete().eq("id", item.id);
                                            if (error) {
                                              toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
                                              return;
                                            }
                                            if (typeCode === 2) setUserDiets((prev) => prev.filter((d) => d.id !== item.id));
                                            else setUserHabits((prev) => prev.filter((h) => h.id !== item.id));
                                            if (user) {
                                              Promise.all([getUserRoutinesDb(user.id), typeCode === 2 ? getUserDietsDb(user.id) : getUserHabitsDb(user.id)]).then(([routinesData, itemsData]) => {
                                                setRoutines(routinesData);
                                                if (typeCode === 2) setUserDiets(itemsData as any);
                                                else setUserHabits(itemsData as any);
                                              });
                                            }
                                            toast({ title: typeCode === 2 ? "Dieta removida" : "Hábito removido" });
                                          }
                                        }}
                                        className="p-2 hover:bg-red-500/10 rounded transition-colors flex-shrink-0"
                                        title="Remover item"
                                      >
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                      </button>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-xs text-muted-foreground text-center py-2">
                                  {allCompleted ? "Todas as tarefas concluídas ✓" : "Nenhum item adicionado"}
                                </p>
                              );
                            })()}
                          </div>
                        )}
                      </Card>
                    );
                  });

                  return [sectionHeader, ...cardElements];
                });
              })()}

              {/* Add more button */}
              <div className="flex justify-center pt-4 pb-4">
                <Button
                  onClick={handleAddRoutineClick}
                  className="rounded-full gap-2"
                  variant="outline"
                >
                  <Plus className="h-5 w-5" />
                  Nova Rotina
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-center pt-12 pb-12">
              <div className="text-center space-y-4 max-w-xs">
                <p className="text-2xl">🏋️</p>
                <p className="text-sm font-medium">Nenhuma rotina ainda</p>
                <p className="text-xs text-muted-foreground">
                  Adicione exercícios, dietas ou hábitos para montar sua rotina diária e fazer check-ins.
                </p>
                <Button
                  onClick={handleAddRoutineClick}
                  className="rounded-full gap-2"
                  size="lg"
                >
                  <Plus className="h-5 w-5" />
                  Criar Rotina
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Routine Drawer Modal */}
      <Drawer open={addRoutineModalOpen} onOpenChange={(open) => { setAddRoutineModalOpen(open); if (!open) setIsAddingFromWorkout(false); }}>
        <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Adicionar Rotina</DrawerTitle>
          </DrawerHeader>

          <div className="flex flex-col flex-1 gap-4 overflow-hidden px-4 pb-4">
            {/* Context banner when adding to an existing named routine */}
            {addToRoutineCardName && selectedRoutineType !== null && (
              <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-brand/10 border border-brand/20 rounded-lg">
                <span className="text-xs text-brand">Adicionando à rotina:</span>
                <span className="text-xs font-semibold text-brand">{addToRoutineCardName}</span>
              </div>
            )}

            {/* Type Selection */}
            {selectedRoutineType === null ? (
              <div className="space-y-5">
                {/* Nome da rotina — destacado */}
                <div className="rounded-xl border-2 border-brand/40 bg-brand/5 p-4 space-y-2">
                  <Label htmlFor="routine_name" className="text-sm font-semibold text-brand">
                    Nome da Rotina (opcional)
                  </Label>
                  <Input
                    id="routine_name"
                    type="text"
                    value={routineName}
                    onChange={(e) => setRoutineName(e.target.value)}
                    className="h-10 border-brand/30 focus:border-brand bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    Dê um nome para identificar sua rotina, ex: "Treino de Peito"
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Selecione o tipo:</p>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { code: 1, label: "Exercícios", emoji: "🏋️", desc: "Treinos e séries de musculação" },
                      { code: 2, label: "Dietas", emoji: "🥗", desc: "Planos alimentares e refeições" },
                      { code: 3, label: "Hábitos", emoji: "✅", desc: "Rotinas diárias e objetivos" },
                    ].map(({ code, label, emoji, desc }) => (
                      <button
                        key={code}
                        onClick={() => { setSelectedRoutineType(code); setSearchQuery(""); }}
                        className="p-4 border border-border/60 rounded-lg hover:bg-muted/50 hover:border-border transition-colors text-left flex items-center gap-3"
                      >
                        <span className="text-2xl">{emoji}</span>
                        <div>
                          <p className="font-semibold text-sm">{label}</p>
                          <p className="text-xs text-muted-foreground">{desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Item Selection */}
                <div className="space-y-3 flex-1 overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {selectedRoutineType === 1
                        ? "Exercícios"
                        : selectedRoutineType === 2
                          ? "Dietas"
                          : "Hábitos"}
                    </p>
                    {!isAddingFromWorkout && (
                      <button
                        onClick={() => {
                          setSelectedRoutineType(null);
                          setSelectedItems(new Set());
                          setSearchQuery("");
                          setSelectedMuscleGroups(new Set());
                          setSelectedDietCategories(new Set());
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Voltar
                      </button>
                    )}
                  </div>

                  {/* Search for Habits */}
                  {selectedRoutineType === 3 && (
                    <div className="relative shrink-0">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Buscar hábito..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-9"
                      />
                    </div>
                  )}

                  {/* Search and Filter for Diets */}
                  {selectedRoutineType === 2 && (
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Buscar dieta..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 h-9"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setShowMuscleFilterPanel((v) => !v)}
                            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                          >
                            <Filter className={`h-3.5 w-3.5 ${selectedDietCategories.size > 0 ? "text-brand" : "text-muted-foreground"}`} />
                            <p className={`text-xs font-medium ${selectedDietCategories.size > 0 ? "text-brand" : "text-muted-foreground"}`}>
                              Categoria {selectedDietCategories.size > 0 ? `(${selectedDietCategories.size})` : ""}
                            </p>
                            <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${showMuscleFilterPanel ? "rotate-180" : ""}`} />
                          </button>
                          {selectedDietCategories.size > 0 && (
                            <button
                              onClick={() => setSelectedDietCategories(new Set())}
                              className="text-xs text-brand hover:underline"
                            >
                              Limpar
                            </button>
                          )}
                        </div>
                        {showMuscleFilterPanel && (
                          <div className="flex flex-wrap gap-2">
                            {uniqueDietCategories.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Carregando categorias...</p>
                            ) : (
                              uniqueDietCategories.map((cat) => (
                                <button
                                  key={cat}
                                  onClick={() => handleToggleDietCategory(cat)}
                                  className={`px-3 py-1.5 text-xs rounded-full border transition-all ${selectedDietCategories.has(cat)
                                    ? "border-brand bg-brand/20 text-brand"
                                    : "border-border/60 text-muted-foreground hover:border-border/80"
                                    }`}
                                >
                                  {cat}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Search and Filter for Exercises */}
                  {selectedRoutineType === 1 && (
                    <div className="space-y-3">
                      {/* Search Bar */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Buscar exercício..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 h-9"
                        />
                      </div>

                      {/* Workout Type Filter */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-medium">Tipo:</span>
                        {[
                          { value: null, label: "Todos" },
                          { value: 1, label: "Academia" },
                          { value: 2, label: "Em casa" },
                        ].map((opt) => (
                          <button
                            key={String(opt.value)}
                            type="button"
                            onClick={() => setSelectedWorkoutType(opt.value)}
                            className={`text-xs px-3 py-1 rounded-full border transition-all ${selectedWorkoutType === opt.value
                                ? "border-brand bg-brand/15 text-brand font-medium"
                                : "border-border/50 text-muted-foreground hover:border-brand/40 hover:bg-muted/60"
                              }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {/* Muscle Group Filter */}
                      {uniqueMuscleGroups.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => setShowMuscleFilterPanel((v) => !v)}
                              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                            >
                              <Filter className={`h-3.5 w-3.5 ${selectedMuscleGroups.size > 0 ? "text-brand" : "text-muted-foreground"}`} />
                              <p className={`text-xs font-medium ${selectedMuscleGroups.size > 0 ? "text-brand" : "text-muted-foreground"}`}>
                                Grupo muscular {selectedMuscleGroups.size > 0 ? `(${selectedMuscleGroups.size})` : ""}
                              </p>
                              <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${showMuscleFilterPanel ? "rotate-180" : ""}`} />
                            </button>
                            {selectedMuscleGroups.size > 0 && (
                              <button
                                onClick={() => setSelectedMuscleGroups(new Set())}
                                className="text-xs text-brand hover:underline"
                              >
                                Limpar
                              </button>
                            )}
                          </div>
                          {showMuscleFilterPanel && (
                            <div className="grid grid-cols-4 gap-1.5">
                              {uniqueMuscleGroups.map((muscleGroup) => {
                                const isActive = selectedMuscleGroups.has(muscleGroup);
                                return (
                                  <button
                                    key={muscleGroup}
                                    onClick={() => handleToggleMuscleGroup(muscleGroup)}
                                    className={`flex items-center justify-center py-2 px-1 rounded-xl border text-center transition-all ${isActive
                                      ? "border-brand bg-brand/15 text-brand shadow-sm"
                                      : "border-border/50 text-muted-foreground hover:border-brand/40 hover:bg-muted/60"
                                      }`}
                                  >
                                    <span className="text-[10px] font-medium leading-tight">{muscleGroup}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Items List */}
                  <div className="space-y-2">
                    {selectedRoutineType === 1 &&
                      filteredWorkouts.map((exercise) => {
                        const isAlreadySelected = userWorkouts.some(
                          (uw) => uw.workout_id === exercise.id
                        );
                        const isNewSelection = selectedItems.has(exercise.id);

                        return (
                          <button
                            key={exercise.key}
                            onClick={async () => {
                              if (!exercise.isLocal && !selectedItems.has(exercise.id)) {
                                // Create catalog exercise in DB first
                                try {
                                  const created = await createCustomWorkoutDb(
                                    exercise.name,
                                    exercise.description,
                                    exercise.muscleGroup || "",
                                    exercise.catalogImage,
                                  );
                                  exercise.id = created.id;
                                  exercise.isLocal = true;
                                  handleSelectItem(created.id);
                                } catch (err: any) {
                                  toast({
                                    title: "Erro ao adicionar exercício",
                                    description: err?.message || "Tente novamente.",
                                    variant: "destructive",
                                  });
                                }
                              } else {
                                handleSelectItem(exercise.id);
                              }
                            }}
                            className={`w-full p-3 rounded-lg border transition-all text-left ${isNewSelection
                              ? "border-brand bg-brand/10"
                              : isAlreadySelected
                                ? "border-green-500/40 bg-green-500/5"
                                : "border-border/60 hover:border-border/80"
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="flex-shrink-0 rounded overflow-hidden cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); setImageZoom({ src: exercise.photo || null, name: exercise.name, description: exercise.description || undefined }); }}
                              >
                                <ExerciseImage
                                  photo={exercise.photo}
                                  name={exercise.name}
                                  muscleGroup={exercise.muscleGroup}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium">
                                    {exercise.name}
                                  </span>
                                  {isAlreadySelected && !isNewSelection && (
                                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                                      ✓ Já adicionado
                                    </p>
                                  )}
                                </div>
                                {exercise.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                    {exercise.description}
                                  </p>
                                )}
                                {exercise.muscleGroup && (
                                  <span className="inline-block text-[10px] font-medium text-brand bg-brand/10 px-2 py-0.5 rounded-full mt-1">
                                    {exercise.muscleGroup}
                                  </span>
                                )}
                              </div>
                              <input
                                type="checkbox"
                                checked={isNewSelection}
                                onChange={() => { }}
                                className="h-4 w-4 flex-shrink-0"
                              />
                            </div>
                          </button>
                        );
                      })}

                    {selectedRoutineType === 1 && (
                      <div className="flex justify-center pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-full gap-2 text-xs"
                          onClick={() => {
                            setCreateWorkoutInitialName(addToRoutineCardName || routineName.trim() || "");
                            setCreateWorkoutDrawerOpen(true);
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Não encontrei meu exercício
                        </Button>
                      </div>
                    )}

                    {selectedRoutineType === 2 &&
                      filteredDiets.map((diet) => {
                        const isAlreadyInRoutine = userDiets.some(
                          (ud) =>
                            ud.diet_id === diet.id &&
                            (addToRoutineCardName
                              ? ud.name === addToRoutineCardName
                              : !ud.name),
                        );
                        const isNewSelection = selectedItems.has(diet.id);
                        return (
                          <button
                            key={diet.id}
                            onClick={() => handleSelectItem(diet.id)}
                            className={`w-full p-3 rounded-lg border transition-all text-left ${isNewSelection
                              ? "border-brand bg-brand/10"
                              : isAlreadyInRoutine
                                ? "border-green-500/40 bg-green-500/5"
                                : "border-border/60 hover:border-border/80"
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="flex-shrink-0 rounded overflow-hidden cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); setImageZoom({ src: (diet as any).photo || (diet as any).image || null, name: diet.name, description: diet.description || undefined }); }}
                              >
                                <DietImage
                                  photo={diet.photo}
                                  name={diet.name}
                                  category={diet.category}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-medium truncate">{diet.name}</span>
                                  <input
                                    type="checkbox"
                                    checked={isNewSelection}
                                    onChange={() => { }}
                                    className="h-4 w-4 flex-shrink-0"
                                  />
                                </div>
                                {diet.category && (
                                  <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground mt-1">
                                    {diet.category}
                                  </span>
                                )}
                                {isAlreadyInRoutine && !isNewSelection && (
                                  <span className="text-xs text-green-600 dark:text-green-400 font-medium block mt-1">
                                    ✓ Já adicionado
                                  </span>
                                )}
                                {(diet.calories ?? 0) > 0 && (
                                  <p className="text-xs text-muted-foreground mt-1">{diet.calories} cal</p>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}

                    {selectedRoutineType === 3 &&
                      habits.filter((h) => h.name.toLowerCase().includes(searchQuery.toLowerCase())).map((habit) => {
                        const isAlreadyInRoutine = userHabits.some(
                          (uh) =>
                            uh.habit_id === habit.id &&
                            (addToRoutineCardName
                              ? uh.name === addToRoutineCardName
                              : !uh.name),
                        );
                        const isNewSelection = selectedItems.has(habit.id);
                        return (
                          <button
                            key={habit.id}
                            onClick={() => handleSelectItem(habit.id)}
                            className={`w-full p-3 rounded-lg border transition-all text-left ${isNewSelection
                              ? "border-brand bg-brand/10"
                              : isAlreadyInRoutine
                                ? "border-green-500/40 bg-green-500/5"
                                : "border-border/60 hover:border-border/80"
                              }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-sm font-medium truncate">{habit.name}</span>
                                {isAlreadyInRoutine && !isNewSelection && (
                                  <span className="text-xs text-green-600 dark:text-green-400 font-medium flex-shrink-0">
                                    ✓ Já adicionado
                                  </span>
                                )}
                              </div>
                              <input
                                type="checkbox"
                                checked={isNewSelection}
                                onChange={() => { }}
                                className="h-4 w-4 flex-shrink-0"
                              />
                            </div>
                            {habit.description && (
                              <p className="text-xs text-muted-foreground mt-1">{habit.description}</p>
                            )}
                          </button>
                        );
                      })}
                  </div>
                </div>

                {/* Save Button — for diet/habit: go to schedule step first */}
                {selectedItems.size > 0 && (
                  <Button
                    onClick={() => {
                      if (selectedRoutineType === 2 || selectedRoutineType === 3) {
                        setShowExecuteAtStep(true);
                      } else {
                        handleSaveRoutines();
                      }
                    }}
                    disabled={isAddingRoutine}
                    className="w-full rounded-full"
                  >
                    {selectedRoutineType === 2 || selectedRoutineType === 3
                      ? `Próximo (${selectedItems.size})`
                      : isAddingRoutine
                        ? "Salvando..."
                        : `Salvar (${selectedItems.size})`}
                  </Button>
                )}
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <ExecuteAtDrawer
        open={showExecuteAtStep}
        onOpenChange={(v) => { if (!v) setShowExecuteAtStep(false); }}
        isSaving={isAddingRoutine}
        onConfirm={(executeDates) => {
          handleSaveRoutines(executeDates.length > 0 ? executeDates : [null]);
          setShowExecuteAtStep(false);
        }}
      />

      {/* Workout Modal */}
      <Drawer shouldScaleBackground={false} open={workoutModalOpen} onOpenChange={(open) => { if (!open) { setWorkoutModalSearchQuery(""); setWorkoutModalMuscleFilter(null); if (workoutStartTime !== null) { setWorkoutModalOpen(false); setTimeout(() => setWorkoutMinimized(true), 300); } else { setWorkoutModalOpen(false); setWorkoutDuration(0); setWorkoutStartTime(null); } } }}>
        <DrawerContent className="max-h-[100dvh] h-[100dvh] mt-0 rounded-none overflow-hidden flex flex-col modal-enter" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DrawerHeader className="shrink-0 pb-2">
            <DrawerTitle>Registrar Treino</DrawerTitle>
            {/* Search Field */}
            <div className="relative mt-2">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Buscar exercício..."
                value={workoutModalSearchQuery}
                onChange={(e) => setWorkoutModalSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 h-9 text-sm bg-muted/50 border border-border/60 rounded-full focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-all placeholder:text-muted-foreground/60"
                style={{ fontSize: '16px' }}
              />
              {workoutModalSearchQuery && (
                <button
                  type="button"
                  onClick={() => setWorkoutModalSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Muscle Group Filter Chips */}
            {(() => {
              const muscleGroups = Array.from(
                new Set(
                  userWorkouts
                    .filter((w) => {
                      if (!selectedRoutineName) return true;
                      if (selectedRoutineName === "__unnamed__") return !w.name;
                      return w.name === selectedRoutineName;
                    })
                    .map((w) => w.muscle_group)
                    .filter(Boolean)
                )
              ) as string[];
              if (muscleGroups.length < 2) return null;
              return (
                <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-none pb-0.5">
                  <button
                    onClick={() => setWorkoutModalMuscleFilter(null)}
                    className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      workoutModalMuscleFilter === null
                        ? "bg-brand text-white"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Todos
                  </button>
                  {muscleGroups.map((mg) => (
                    <button
                      key={mg}
                      onClick={() => setWorkoutModalMuscleFilter(workoutModalMuscleFilter === mg ? null : mg)}
                      className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        workoutModalMuscleFilter === mg
                          ? "bg-brand text-white"
                          : "bg-muted/60 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {mg}
                    </button>
                  ))}
                </div>
              );
            })()}
          </DrawerHeader>

          {/* Header and Stats */}
          {userWorkouts.length > 0 && (
            <div className="shrink-0 border-b border-border/40 px-4 py-4">
              <div className="flex items-center gap-2 mb-3">
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                <span className="text-base font-semibold">Treinamento</span>
              </div>

              {/* Stats Row */}
              <div className="flex items-center justify-between">
                {(() => {
                  const activeWorkouts = userWorkouts.filter((w) => {
                    if (!selectedRoutineName) return true;
                    if (selectedRoutineName === "__unnamed__") return !w.name;
                    return w.name === selectedRoutineName;
                  });
                  const allWorkoutsCardio = activeWorkouts.length > 0 && activeWorkouts.every(w => (w.muscle_group || "").toLowerCase() === "cardio");
                  return (
                    <>
                      <div className="flex flex-col">
                        <p className="text-xs text-muted-foreground mb-0.5">Duração</p>
                        <p className="text-base font-bold text-brand">
                          {formatDuration(workoutDuration)}
                        </p>
                      </div>
                      <div className="flex flex-col">
                        <p className="text-xs text-muted-foreground mb-0.5">{allWorkoutsCardio ? "Distância" : "Volume"}</p>
                        <p className="text-base font-bold text-foreground">
                          {allWorkoutsCardio
                            ? `${Math.round(activeWorkouts.reduce((total, workout) => {
                              const series = workoutSeries[workout.workout_id] || [];
                              return total + series.filter(s => s.completed).reduce((sum, s) => sum + (s.kg || 0), 0);
                            }, 0) * 10) / 10} km`
                            : `${Math.round(activeWorkouts.reduce((total, workout) => {
                              const series = workoutSeries[workout.workout_id] || [];
                              return total + series.filter(s => s.completed).reduce((sum, s) => sum + (s.kg || 0) * (s.reps || 0), 0);
                            }, 0) * 10) / 10} kg`
                          }
                        </p>
                      </div>
                      <div className="flex flex-col">
                        <p className="text-xs text-muted-foreground mb-0.5">Séries</p>
                        <p className="text-base font-bold text-foreground">
                          {activeWorkouts.reduce((total, workout) => total + (workoutSeries[workout.workout_id] || []).filter((s) => s.completed).length, 0)}
                        </p>
                      </div>
                    </>
                  );
                })()}
                <button
                  onClick={handleFinishWorkout}
                  className="p-2 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
                  title="Finalizar treino"
                  aria-label="Finalizar treino"
                >
                  <Pause className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          {/* Exercises List - Scrollable */}
          {userWorkouts.length > 0 ? (
            <div className="flex-1 overflow-y-auto">
              {userWorkouts
                .map((workout, originalIndex) => ({ workout, originalIndex }))
                .filter(({ workout }) => {
                  // Filter by search query
                  if (workoutModalSearchQuery.trim()) {
                    const query = workoutModalSearchQuery.toLowerCase().trim();
                    if (!workout.workoutName?.toLowerCase().includes(query)) return false;
                  }
                  // Filter by muscle group
                  if (workoutModalMuscleFilter && workout.muscle_group !== workoutModalMuscleFilter) return false;
                  // If no routine selected, show all workouts
                  if (!selectedRoutineName) return true;
                  // If showing unnamed routines, show only workouts without a name
                  if (selectedRoutineName === "__unnamed__") {
                    return !workout.name;
                  }
                  // If routine selected, show only workouts with matching name
                  return workout.name === selectedRoutineName;
                })
                .map(({ workout, originalIndex }, filteredIndex, filteredArr) => {
                  const series = workoutSeries[workout.workout_id] || [];
                  return (
                    <div key={workout.id} className="px-4 py-3">
                      <div className="bg-card border border-brand/20 rounded-lg p-3 mb-3">
                        {/* Exercise Header */}
                        <div className="flex items-center gap-3 mb-2">
                          <button
                            type="button"
                            className="flex-shrink-0 rounded-lg overflow-hidden"
                            onClick={(e) => { e.stopPropagation(); setImageZoom({ src: workout.workoutPhoto || null, name: workout.workoutName || "", description: workout.workoutDescription || undefined }); }}
                          >
                            <ExerciseImage
                              photo={workout.workoutPhoto || null}
                              name={workout.workoutName || ""}
                              muscleGroup={workout.muscle_group || null}
                              className="h-12 w-12 flex-shrink-0"
                            />
                          </button>
                          <button
                            onClick={() => handleOpenWorkoutHistory({
                              id: workout.workout_id,
                              name: workout.workoutName,
                              description: workout.workoutDescription || undefined,
                              photo: workout.workoutPhoto || undefined,
                            })}
                            className="flex-1 text-left hover:opacity-80 transition-opacity"
                          >
                            <h3 className="text-sm font-semibold text-brand">
                              {workout.workoutName}
                            </h3>
                            {workout.muscle_group && (
                              <p className="text-xs text-muted-foreground mt-0.5">{workout.muscle_group}</p>
                            )}
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1 hover:bg-muted/50 rounded transition-colors flex-shrink-0">
                                <MoreVertical className="h-4 w-4 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              {filteredIndex > 0 && (
                                <DropdownMenuItem
                                  onClick={() => handleReorderExercises(originalIndex, filteredArr[filteredIndex - 1].originalIndex)}
                                >
                                  <ArrowUp className="h-4 w-4 mr-2" />
                                  Mover para cima
                                </DropdownMenuItem>
                              )}
                              {filteredIndex < filteredArr.length - 1 && (
                                <DropdownMenuItem
                                  onClick={() => handleReorderExercises(originalIndex, filteredArr[filteredIndex + 1].originalIndex)}
                                >
                                  <ArrowDown className="h-4 w-4 mr-2" />
                                  Mover para baixo
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleDeleteExercise(workout.id)}
                                className="text-red-500"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remover da rotina
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Notes */}
                        <div className="mb-2">
                          <input
                            type="text"
                            placeholder="Adicionar notas aqui..."
                            className="w-full text-xs text-muted-foreground bg-transparent border-0 placeholder:text-muted-foreground/60 focus:outline-none"
                            style={{ fontSize: '16px' }}
                          />
                        </div>

                        {/* Rest Time Selector */}
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-4 w-4 text-brand flex-shrink-0" />
                          <span className="text-xs font-medium text-brand">Descanso:</span>
                          <select
                            value={workoutExerciseRestTimes[workout.workout_id] || ""}
                            onChange={(e) =>
                              handleSetExerciseRestTime(workout.workout_id, parseInt(e.target.value))
                            }
                            className="text-xs font-medium text-foreground bg-background border border-brand/40 rounded px-2 py-1 focus:border-brand focus:outline-none cursor-pointer hover:border-brand/60 transition-colors"
                            style={{ fontSize: '16px' }}
                          >
                            <option value="">Desativado</option>
                            {REST_TIME_OPTIONS.map((time) => (
                              <option key={time} value={time}>
                                {time < 60 ? `${time}s` : `${Math.floor(time / 60)}m`}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Load suggestion: best kg from last session */}
                        {(() => {
                          const isCardio = (workout.muscle_group || "").toLowerCase() === "cardio";
                          if (isCardio) return null;
                          const history = workoutHistoriesMap[workout.workout_id] || [];
                          if (history.length === 0) return null;
                          const bestLastKg = Math.max(...history.slice(0, 3).map((h) => h.kilos || 0));
                          if (bestLastKg <= 0) return null;
                          const suggested = Math.round((bestLastKg + 2.5) * 10) / 10;
                          return (
                            <div className="flex items-center gap-2 mb-3">
                              {/* Meta de hoje */}
                              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand/10 border border-brand/30">
                                <TrendingUp className="h-3 w-3 text-brand flex-shrink-0" />
                                <span className="text-[11px] text-brand/70 leading-none">Meta hoje</span>
                                <span className="text-[11px] font-bold text-brand leading-none">{suggested} kg</span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Table Header */}
                        {(() => {
                          const isCardio = (workout.muscle_group || "").toLowerCase() === "cardio";
                          return (
                            <>
                              <div className="grid grid-cols-[40px_1fr_60px_60px_44px] gap-3 mb-1 py-1 text-xs font-semibold text-muted-foreground border-b border-border/20">
                                <div>SÉRIE</div>
                                <div>ANTERIOR</div>
                                <div className="text-center">{isCardio ? "KM" : "KG"}</div>
                                <div className="text-center">{isCardio ? "TEMPO" : "REPS"}</div>
                                <div className="text-center">✓</div>
                              </div>

                              {/* Series Rows */}
                              <div className="space-y-0">
                                {series.map((s, index) => {
                                  const previousRecord = workoutHistoriesMap[workout.workout_id]?.[index];
                                  return (
                                    <div
                                      key={index}
                                      className={`group relative grid grid-cols-[40px_1fr_60px_60px_32px_28px] gap-2 items-center py-1.5 rounded hover:bg-muted/20 transition-colors ${s.completed ? "opacity-50" : ""
                                        }`}
                                    >
                                      {/* Series Number */}
                                      <div className="font-bold text-center text-xs">
                                        {index + 1}
                                      </div>

                                      {/* Previous Record */}
                                      <div className="text-xs text-muted-foreground">
                                        {previousRecord
                                          ? isCardio
                                            ? `${Math.round((previousRecord.kilos || 0) * 10) / 10}km · ${previousRecord.volume || 0}`
                                            : `${Math.round((previousRecord.kilos || 0) * 10) / 10}kg × ${previousRecord.volume || 0}`
                                          : "—"}
                                      </div>

                                      {/* KM or KG Input */}
                                      <input
                                        type="number"
                                        step={isCardio ? "0.1" : "0.5"}
                                        min="0"
                                        value={s.kg === 0 ? "" : s.kg}
                                        onChange={(e) =>
                                          handleUpdateSerie(
                                            workout.workout_id,
                                            index,
                                            "kg",
                                            e.target.value,
                                          )
                                        }
                                        placeholder="0"
                                        className="w-full h-7 px-1.5 border border-border/60 rounded text-xs font-semibold bg-background text-center focus:border-brand focus:outline-none"
                                        style={{ fontSize: '16px' }}
                                      />

                                      {/* REPS or TEMPO Input */}
                                      <input
                                        type={isCardio ? "text" : "number"}
                                        min={isCardio ? undefined : "0"}
                                        value={isCardio ? (s.reps === 0 ? "" : String(s.reps)) : (s.reps === 0 ? "" : s.reps)}
                                        onChange={(e) =>
                                          handleUpdateSerie(
                                            workout.workout_id,
                                            index,
                                            "reps",
                                            e.target.value,
                                          )
                                        }
                                        placeholder={isCardio ? "00:00" : "0"}
                                        className="w-full h-7 px-1.5 border border-border/60 rounded text-xs font-semibold bg-background text-center focus:border-brand focus:outline-none"
                                        style={{ fontSize: '16px' }}
                                      />

                                      {/* Checkbox */}
                                      <button
                                        onClick={() =>
                                          handleToggleSerieCompleted(
                                            workout.workout_id,
                                            index,
                                          )
                                        }
                                        className="h-6 w-6 rounded bg-muted/40 hover:bg-muted/60 flex items-center justify-center transition-colors mx-auto"
                                      >
                                        {s.completed ? (
                                          <CheckCircle2 className="h-4 w-4 text-brand" />
                                        ) : (
                                          <Circle className="h-4 w-4 text-muted-foreground" />
                                        )}
                                      </button>

                                      {/* Delete Serie */}
                                      <button
                                        onClick={() => handleDeleteSerie(workout.workout_id, index)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 rounded-full bg-destructive/80 hover:bg-destructive flex items-center justify-center mx-auto"
                                        title="Deletar série"
                                        aria-label="Deletar série"
                                      >
                                        <Trash2 className="h-3 w-3 text-white" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          );
                        })()}

                        {/* Add Series Button */}
                        <button
                          onClick={() => handleAddSerie(workout.workout_id)}
                          className="w-full mt-2 py-2 text-xs font-semibold text-white bg-brand hover:bg-brand/90 transition-colors rounded flex items-center justify-center gap-2"
                        >
                          <Plus className="h-3 w-3" />
                          Adicionar Série
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Nenhum exercício adicionado</p>
            </div>
          )}

          {/* Bottom Actions - Sticky */}
          <div className="mt-2 border-t border-border/40 pt-2">
            <button
              onClick={() => handleAddExerciseFromWorkout()}
              className="w-full py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border border-dashed border-border/40 rounded hover:border-border/60"
            >
              <Plus className="h-3 w-3 inline mr-1" />
              Adicionar Exercício
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* PR Celebration Banner — floats above everything during workout */}
      {prCelebration && typeof document !== "undefined" && createPortal(
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="flex items-center gap-3 bg-brand text-white rounded-2xl px-5 py-3 shadow-2xl shadow-brand/40 border border-white/20">
            <span className="text-2xl">🏆</span>
            <div>
              <p className="text-xs font-semibold opacity-80 uppercase tracking-wide">Novo Recorde!</p>
              <p className="text-sm font-bold leading-tight">
                {prCelebration.exerciseName} — {prCelebration.kg} kg
                {prCelebration.reps > 0 ? ` × ${prCelebration.reps} reps` : ""}
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Rest Timer Modal — rendered via portal to avoid Vaul Drawer overlay conflicts */}
      {restTimerModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ pointerEvents: "auto" }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setRestTimerModalOpen(false)}
          />
          {/* Content */}
          <div className="relative z-10 w-full max-w-xs mx-4 bg-background rounded-2xl border shadow-xl p-6">
            <h2 className="text-lg font-semibold text-center mb-1">Tempo de Descanso</h2>

            <div className="flex flex-col items-center justify-center gap-6 py-4">
              <div className="relative flex items-center justify-center w-48 h-48">
                <svg className="absolute w-full h-full" viewBox="0 0 200 200">
                  <circle
                    cx="100"
                    cy="100"
                    r="90"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-border/60"
                  />
                  <circle
                    cx="100"
                    cy="100"
                    r="90"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-brand"
                    strokeDasharray={`${(565 * (1 - restTimerRemaining / (workoutExerciseRestTimes[restTimerExerciseId || ""] || 0))) || 0} 565`}
                    strokeLinecap="round"
                    style={{ transform: "rotate(-90deg)", transformOrigin: "100px 100px" }}
                  />
                </svg>
                <div className="absolute text-center">
                  <p className="text-4xl font-bold text-brand">
                    {restTimerRemaining}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">segundos</p>
                </div>
              </div>

              <div className="flex gap-3 w-full">
                <Button
                  onClick={() => {
                    setRestTimerModalOpen(false);
                    setGlobalRestTimerActive(false);
                    setGlobalRestTimerRemaining(0);
                    setGlobalRestTimerTotal(0);
                  }}
                  variant="outline"
                  className="flex-1 rounded-full"
                >
                  Pular
                </Button>
                <Button
                  onClick={() => {
                    setRestTimerModalOpen(false);
                  }}
                  variant="outline"
                  className="flex-1 rounded-full"
                >
                  Minimizar
                </Button>
                <Button
                  onClick={() => {
                    if (restTimerRemaining === 0) {
                      setRestTimerModalOpen(false);
                      setGlobalRestTimerActive(false);
                      setGlobalRestTimerRemaining(0);
                      setGlobalRestTimerTotal(0);
                    } else {
                      setGlobalRestTimerActive(!globalRestTimerActive);
                    }
                  }}
                  className="flex-1 rounded-full"
                >
                  {restTimerRemaining === 0 ? "Próxima" : (globalRestTimerActive ? "Pausar" : "Retomar")}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Goal Drawer */}
      <EditGoalDrawer
        open={editGoalModalOpen}
        onOpenChange={setEditGoalModalOpen}
        goal={editingGoal}
        onGoalUpdated={(freshGoals, freshIds) => {
          setUserGoals(freshGoals);
          setSelectedGoalIds(freshIds);
        }}
        onGoalDeleted={(goalId) => {
          setSelectedGoalIds((prev) => prev.filter((id) => id !== goalId));
        }}
      />

      {/* Finish Workout Confirmation Drawer */}
      <Drawer open={finishWorkoutConfirmOpen} onOpenChange={setFinishWorkoutConfirmOpen}>
        <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>Confirmar Encerramento do Treino</DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Tem certeza que deseja encerrar o treino? Todos os dados registrados serão salvos.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-full"
                  onClick={() => setFinishWorkoutConfirmOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 rounded-full bg-destructive hover:bg-destructive/90"
                  onClick={handleConfirmFinishWorkout}
                >
                  Encerrar Treino
                </Button>
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Workout Summary Screen */}
      {workoutSummaryOpen && workoutSummaryData && (() => {
        const mins = Math.floor(workoutSummaryData.duration / 60);
        const secs = workoutSummaryData.duration % 60;
        const durationStr = mins > 0 ? `${mins}m ${secs > 0 ? `${secs}s` : ""}`.trim() : `${secs}s`;
        const routineStr = workoutSummaryData.routineName
          ? `Treino de ${workoutSummaryData.routineName}`
          : "Treino concluído";

        const closeSummary = () => {
          setWorkoutSummaryOpen(false);
          setWorkoutSummaryData(null);
          setSelectedRoutineName(null);
          setWorkoutCoverFiles([]);
          setWorkoutCoverPreviews([]);
          setCoverCarouselIndex(0);
          setCanvasPreviewUrl(null);
          setPrCanvasPreviewUrl(null);
          setWorkoutRating(0);
          setIsDuelShareModalOpen(false);
          setSelectedDuelGroupId(null);
          setDuelGroups([]);
          setNutritionExpanded(true);
          setWorkoutPostDescription("");
          setWorkoutLinkedUserGoalId(null);
        };

        const handleOpenDuelShare = async () => {
          if (!user?.id) return;
          setIsDuelShareModalOpen(true);
          setSelectedDuelGroupId(null);
          try {
            const { myGroups } = await getEnrichedDuelGroupsDb(user.id);
            setDuelGroups(myGroups.map((g) => ({ id: g.id, name: g.name, goal: g.goal })));
          } catch {
            setDuelGroups([]);
          }
        };

        const handleShareDuel = async () => {
          if (!workoutSummaryData || !user || !selectedDuelGroupId) return;
          setIsSharingDuel(true);
          try {
            const userProfile = await getUserProfileDb(user.id);
            const userName = userProfile?.nickname || user.email?.split("@")[0] || "Usuário";
            const userPhotoUrl = userProfile?.photo || null;

            let photoUrl: string | null = null;
            const uploadedUrls: string[] = [];

            if (supabase) {
              // 1. Upload the PR canvas card as the first photo if there's a PR
              const prCanvas = prCanvasRef.current;
              if (prCanvas && workoutSummaryData.prs.length > 0) {
                const blob = await new Promise<Blob | null>((res) => prCanvas.toBlob(res, "image/png"));
                if (blob) {
                  const filePath = `${user.id}/${Date.now()}-duel-pr-cover.png`;
                  const { error: uploadError } = await supabase.storage
                    .from("posts")
                    .upload(filePath, blob, { contentType: "image/png", upsert: false });
                  if (!uploadError) {
                    const { data: urlData } = supabase.storage.from("posts").getPublicUrl(filePath);
                    const publicUrl = urlData.publicUrl;
                    photoUrl = publicUrl;
                    uploadedUrls.push(publicUrl);
                  }
                }
              }

              // 2. Upload the regular Workout Summary canvas card
              if (workoutCanvasRef.current) {
                const canvas = workoutCanvasRef.current;
                const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
                if (blob) {
                  const filePath = `${user.id}/${Date.now()}-duel-checkin-cover.png`;
                  const { error: uploadError } = await supabase.storage
                    .from("posts")
                    .upload(filePath, blob, { contentType: "image/png", upsert: false });
                  if (!uploadError) {
                    const { data: urlData } = supabase.storage.from("posts").getPublicUrl(filePath);
                    const publicUrl = urlData.publicUrl;
                    if (!photoUrl) photoUrl = publicUrl;
                    uploadedUrls.push(publicUrl);
                  }
                }
              }

              // 3. Upload all user-selected photos
              if (workoutCoverFiles.length > 0) {
                for (let i = 0; i < workoutCoverFiles.length; i++) {
                  const file = workoutCoverFiles[i];
                  const ext = file.name.split(".").pop() || "jpg";
                  const filePath = `${user.id}/${Date.now()}-duel-checkin-${i}.${ext}`;
                  const { error: uploadError } = await supabase.storage
                    .from("posts")
                    .upload(filePath, file, { contentType: file.type, upsert: false });
                  if (!uploadError) {
                    const { data: urlData } = supabase.storage.from("posts").getPublicUrl(filePath);
                    const publicUrl = urlData.publicUrl;
                    if (!photoUrl) photoUrl = publicUrl;
                    uploadedUrls.push(publicUrl);
                  }
                }
              }
            }

            const primaryMuscle = workoutSummaryData.exercises[0]?.muscleGroup || null;
            const description = workoutSummaryData.routineName
              ? `Treino de ${workoutSummaryData.routineName} concluído! 💪`
              : "Treino concluído! 💪";

            await addGroupCheckInDb(
              selectedDuelGroupId,
              user.id,
              userName,
              photoUrl || uploadedUrls[0] || "",
              description,
              workoutSummaryData.routineName || "Treino",
              workoutSummaryData.totalSeries,
              workoutSummaryData.totalVolume,
              primaryMuscle,
              workoutSummaryData.exercises,
              userPhotoUrl,
              uploadedUrls,
            );

            toast({ title: "Check-in no duelo! ⚔️", description: "Seu treino foi registrado no grupo." });
            closeSummary();
            navigate("/comunidade");
          } catch (err: any) {
            toast({ title: "Erro ao compartilhar no duelo", description: err?.message || "Tente novamente.", variant: "destructive" });
          } finally {
            setIsSharingDuel(false);
          }
        };

        const handlePickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
          const files = Array.from(e.target.files || []);
          if (!files.length) return;
          const valid = files.filter((f) => f.type.startsWith("image/") && f.size <= 10 * 1024 * 1024);
          if (valid.length < files.length) {
            toast({ title: "Alguns arquivos foram ignorados (tipo inválido ou >10MB)", variant: "destructive" });
          }
          if (!valid.length) return;
          const newFiles = [...workoutCoverFiles, ...valid].slice(0, 10);
          setWorkoutCoverFiles(newFiles);
          // +1 to account for canvas slide at index 0
          setCoverCarouselIndex(1 + newFiles.length - 1);
          const previews: string[] = [...workoutCoverPreviews];
          let loaded = 0;
          newFiles.forEach((file, i) => {
            if (i < workoutCoverPreviews.length) {
              loaded++;
              if (loaded === newFiles.length) setWorkoutCoverPreviews([...previews]);
            } else {
              const reader = new FileReader();
              reader.onloadend = () => {
                previews[i] = reader.result as string;
                loaded++;
                if (loaded === newFiles.length) setWorkoutCoverPreviews([...previews]);
              };
              reader.readAsDataURL(file);
            }
          });
        };

        const handleRemoveCoverPhoto = (index: number) => {
          const newFiles = workoutCoverFiles.filter((_, i) => i !== index);
          const newPreviews = workoutCoverPreviews.filter((_, i) => i !== index);
          setWorkoutCoverFiles(newFiles);
          setWorkoutCoverPreviews(newPreviews);
          setCoverCarouselIndex(Math.min(coverCarouselIndex, Math.max(0, newFiles.length - 1)));
        };

        const handleShare = async () => {
          if (!workoutSummaryData || !supabase || !user) return;
          setIsSharingWorkout(true);
          try {
            const description = workoutPostDescription || (() => {
              if (workoutSummaryData.prs.length > 0) {
                const prLines = workoutSummaryData.prs
                  .map((pr) => `🏆 ${pr.exerciseName}: ${pr.kg} kg${pr.reps > 0 ? ` × ${pr.reps} reps` : ""}`)
                  .join("\n");
                const prVolumeStr = workoutSummaryData.isAllCardio
                  ? (workoutSummaryData.totalKm > 0 ? `📍 Distância: ${workoutSummaryData.totalKm} km` : "")
                  : (workoutSummaryData.totalVolume > 0 ? `📦 Volume: ${workoutSummaryData.totalVolume} kg` : "");
                const prStats = [`⏱️ Duração: ${durationStr}`, prVolumeStr, `✅ Séries: ${workoutSummaryData.totalSeries}`]
                  .filter(Boolean)
                  .join("  ·  ");
                return `🔥 Novo recorde pessoal!\n\n${prLines}\n\n${prStats}\n\n#Linka #PR #RecordePessoal #Fitness`;
              }
              const exerciseList = workoutSummaryData.exerciseNames.length > 0
                ? `\n🏋️ ${workoutSummaryData.exerciseNames.join(" · ")}`
                : "";
              const volumeStr = workoutSummaryData.totalVolume > 0
                ? `\n📦 Volume: ${workoutSummaryData.totalVolume} kg`
                : "";
              return `💪 ${routineStr}!\n⏱️ ${durationStr}${volumeStr}\n✅ ${workoutSummaryData.totalSeries} séries${exerciseList}\n\n#Linka #Fitness #Treino`;
            })();

            let photoUrls: string[] = [];

            // 1. Upload the PR canvas card as the first photo if there's a PR
            const prCanvas = prCanvasRef.current;
            if (prCanvas && workoutSummaryData.prs.length > 0) {
              const blob = await new Promise<Blob | null>((res) => prCanvas.toBlob(res, "image/png"));
              if (blob) {
                const filePath = `${user.id}/${Date.now()}-pr-cover.png`;
                const { error: uploadError } = await supabase.storage
                  .from("posts")
                  .upload(filePath, blob, { contentType: "image/png", upsert: false });
                if (!uploadError) {
                  const { data: urlData } = supabase.storage.from("posts").getPublicUrl(filePath);
                  photoUrls.push(urlData.publicUrl);
                }
              }
            }

            // 2. Upload the workout canvas card as the next photo
            const canvas = workoutCanvasRef.current;
            if (canvas) {
              const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
              if (blob) {
                const filePath = `${user.id}/${Date.now()}-workout-cover.png`;
                const { error: uploadError } = await supabase.storage
                  .from("posts")
                  .upload(filePath, blob, { contentType: "image/png", upsert: false });
                if (!uploadError) {
                  const { data: urlData } = supabase.storage.from("posts").getPublicUrl(filePath);
                  photoUrls.push(urlData.publicUrl);
                }
              }
            }

            // Then upload any user-picked photos
            for (const file of workoutCoverFiles) {
              const ext = file.name.split(".").pop() || "jpg";
              const filePath = `${user.id}/${Date.now()}-workout.${ext}`;
              const { error: uploadError } = await supabase.storage
                .from("posts")
                .upload(filePath, file, { contentType: file.type, upsert: false });
              if (uploadError) throw uploadError;
              const { data: urlData } = supabase.storage.from("posts").getPublicUrl(filePath);
              photoUrls.push(urlData.publicUrl);
            }

            await createPostDb(photoUrls.length > 0 ? photoUrls : null, description, workoutLinkedUserGoalId);

            toast({ title: "Postado no feed! 🎉", description: "Seu treino foi compartilhado." });
            closeSummary();
            navigate("/");
          } catch (err: any) {
            toast({ title: "Erro ao compartilhar", description: err?.message || "Tente novamente.", variant: "destructive" });
          } finally {
            setIsSharingWorkout(false);
          }
        };

        const handleSharePR = async () => {
          if (!workoutSummaryData?.prs.length || !user || !supabase) return;
          setIsSharingWorkout(true);
          try {
            const prLines = workoutSummaryData.prs
              .map((pr) => `🏆 ${pr.exerciseName}: ${pr.kg} kg${pr.reps > 0 ? ` × ${pr.reps} reps` : ""}`)
              .join("\n");
            const prVolumeStr = workoutSummaryData.isAllCardio
              ? (workoutSummaryData.totalKm > 0 ? `📍 Distância: ${workoutSummaryData.totalKm} km` : "")
              : (workoutSummaryData.totalVolume > 0 ? `📦 Volume: ${workoutSummaryData.totalVolume} kg` : "");
            const prStats = [`⏱️ Duração: ${durationStr}`, prVolumeStr, `✅ Séries: ${workoutSummaryData.totalSeries}`]
              .filter(Boolean)
              .join("  ·  ");
            const description = `🔥 Novo recorde pessoal!\n\n${prLines}\n\n${prStats}\n\n#Linka #PR #RecordePessoal #Fitness`;

            // Generate PR card image from canvas
            let photoUrl: string | null = null;
            const canvas = prCanvasRef.current;
            if (canvas) {
              const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
              if (blob) {
                const filePath = `${user.id}/${Date.now()}-pr-card.png`;
                const { error: uploadError } = await supabase.storage
                  .from("posts")
                  .upload(filePath, blob, { contentType: "image/png", upsert: false });
                if (!uploadError) {
                  const { data: urlData } = supabase.storage.from("posts").getPublicUrl(filePath);
                  photoUrl = urlData.publicUrl;
                }
              }
            }

            await createPostDb(photoUrl, description);
            toast({ title: "PR compartilhado! 🏆", description: "Seu recorde foi postado no feed." });
            closeSummary();
            navigate("/");
          } catch (err: any) {
            toast({ title: "Erro ao compartilhar PR", description: err?.message || "Tente novamente.", variant: "destructive" });
          } finally {
            setIsSharingWorkout(false);
          }
        };

        return createPortal(
          <>
            {/* Desktop Backdrop */}
            <div className="hidden md:block fixed inset-0 z-[190] bg-black/80 backdrop-blur-sm" onClick={closeSummary} />

            <div className="fixed inset-0 z-[200] flex flex-col bg-background overflow-y-auto md:top-[5vh] md:bottom-[5vh] md:left-[244px] md:right-0 md:mx-auto md:w-full md:max-w-[680px] md:rounded-2xl md:border md:border-border/50 md:shadow-2xl">
              {/* Hidden canvases for cover generation */}
              <canvas ref={workoutCanvasRef} width={800} height={800} className="hidden" />
              <canvas ref={prCanvasRef} width={800} height={800} className="hidden" />

              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-12 pb-4 flex-shrink-0">
                <button onClick={closeSummary} className="p-2 rounded-full hover:bg-muted transition-colors" aria-label="Fechar">
                  <X className="h-5 w-5" />
                </button>
                <h1 className="text-base font-bold">Resumo do Treino</h1>
                <div className="w-9" />
              </div>

              {/* Cover image carousel */}
              {(() => {
                // Slides: [PR card (if any)], [workout summary card], [user photos...]
                const canvasSlides: { src: string; isCanvas: boolean }[] = [
                  ...(prCanvasPreviewUrl ? [{ src: prCanvasPreviewUrl, isCanvas: true }] : []),
                  ...(canvasPreviewUrl ? [{ src: canvasPreviewUrl, isCanvas: true }] : []),
                ];
                const allSlides: { src: string; isCanvas: boolean }[] = [
                  ...canvasSlides,
                  ...workoutCoverPreviews.map((src) => ({ src, isCanvas: false })),
                ];
                const safeIndex = Math.min(coverCarouselIndex, Math.max(0, allSlides.length - 1));
                const currentSlide = allSlides[safeIndex];
                // Index of current slide in userPhotos array (offset by canvas slides)
                const userPhotoIndex = safeIndex - canvasSlides.length;
                return (
                  <div className="mx-4 mb-4 relative rounded-2xl overflow-hidden aspect-square md:aspect-auto md:h-[400px] bg-slate-950/40 border border-brand/20 flex-shrink-0 flex items-center justify-center">
                    {/* Current slide */}
                    {currentSlide ? (
                      <img src={currentSlide.src} alt={`Slide ${safeIndex + 1}`} className="max-w-full max-h-full w-auto h-auto object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Camera className="h-10 w-10 text-white/30" />
                      </div>
                    )}

                    {/* Carousel navigation arrows */}
                    {allSlides.length > 1 && (
                      <>
                        <button
                          onClick={() => setCoverCarouselIndex((i) => (i - 1 + allSlides.length) % allSlides.length)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
                          aria-label="Foto anterior"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setCoverCarouselIndex((i) => (i + 1) % allSlides.length)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
                          aria-label="Próxima foto"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </>
                    )}

                    {/* Dots indicator */}
                    {allSlides.length > 1 && (
                      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {allSlides.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setCoverCarouselIndex(i)}
                            className={`h-1.5 rounded-full transition-all ${i === safeIndex ? "bg-white w-3" : "bg-white/50 w-1.5"}`}
                          />
                        ))}
                      </div>
                    )}

                    {/* Remove button — only for user photos, not the canvas slide */}
                    {currentSlide && !currentSlide.isCanvas && (
                      <button
                        onClick={() => handleRemoveCoverPhoto(userPhotoIndex)}
                        className="absolute top-3 right-3 bg-black/60 hover:bg-red-600/80 text-white rounded-full p-1.5 transition-colors"
                        aria-label="Remover foto"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* Add photo button */}
                    {workoutCoverPreviews.length < 10 && (
                      <label className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white text-xs font-medium px-3 py-1.5 rounded-full cursor-pointer transition-colors">
                        <Camera className="h-3.5 w-3.5" />
                        {workoutCoverPreviews.length > 0 ? `+foto (${workoutCoverPreviews.length}/10)` : "Adicionar foto"}
                        <input type="file" accept="image/*" multiple className="hidden" onChange={handlePickPhoto} />
                      </label>
                    )}
                  </div>
                );
              })()}

              {/* Stats row */}
              <div className="mx-4 grid grid-cols-3 gap-2 mb-4">
                <div className="flex flex-col items-center gap-1 rounded-xl bg-card border border-border/50 p-3 md:py-2">
                  <Timer className="h-4 w-4 text-brand" />
                  <p className="text-[11px] text-muted-foreground">Duração</p>
                  <p className="text-sm font-bold">{durationStr}</p>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-xl bg-card border border-border/50 p-3 md:py-2">
                  <TrendingUp className="h-4 w-4 text-brand" />
                  <p className="text-[11px] text-muted-foreground">{workoutSummaryData.isAllCardio ? "Distância" : "Volume"}</p>
                  <p className="text-sm font-bold">
                    {workoutSummaryData.isAllCardio
                      ? (workoutSummaryData.totalKm > 0 ? `${workoutSummaryData.totalKm} km` : "—")
                      : (workoutSummaryData.totalVolume > 0 ? `${workoutSummaryData.totalVolume} kg` : "—")}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-xl bg-card border border-border/50 p-3 md:py-2">
                  <Flame className="h-4 w-4 text-brand" />
                  <p className="text-[11px] text-muted-foreground">Séries</p>
                  <p className="text-sm font-bold">{workoutSummaryData.totalSeries}</p>
                </div>
              </div>

              {/* Exercises */}
              {workoutSummaryData.exerciseNames.length > 0 && (
                <div className="mx-4 mb-4 rounded-xl bg-card border border-border/50 p-4 md:p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Dumbbell className="h-4 w-4 text-brand" />
                    <p className="text-sm font-semibold">Exercícios realizados</p>
                  </div>
                  <div className="space-y-1">
                    {workoutSummaryData.exerciseNames.map((name, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-3.5 w-3.5 text-brand flex-shrink-0" />
                        <span>{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PRs achieved this session */}
              {workoutSummaryData.prs.length > 0 && (
                <div className="mx-4 mb-4 rounded-xl bg-brand/10 border border-brand/30 p-4 md:p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🏆</span>
                      <p className="text-sm font-semibold text-brand">Novos Recordes!</p>
                    </div>
                    <button
                      onClick={handleSharePR}
                      disabled={isSharingWorkout}
                      className="flex items-center gap-1.5 text-xs font-semibold text-brand border border-brand/40 rounded-full px-3 py-1 hover:bg-brand/10 transition-colors disabled:opacity-50"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Compartilhar
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {workoutSummaryData.prs.map((pr, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{pr.exerciseName}</span>
                        <span className="text-brand font-bold">
                          {pr.kg} kg{pr.reps > 0 ? ` × ${pr.reps}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mx-4 pb-10 space-y-3 mt-2">
                {/* Editable post description */}
                <div className="rounded-xl border border-border/50 bg-card p-3 space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Descrição da postagem</p>
                  <textarea
                    value={workoutPostDescription}
                    onChange={(e) => setWorkoutPostDescription(e.target.value)}
                    rows={2}
                    className="w-full bg-transparent text-sm resize-none outline-none text-foreground placeholder:text-muted-foreground min-h-[50px]"
                    placeholder="Escreva algo sobre seu treino..."
                  />
                </div>

                <Button className="w-full rounded-full gap-2 h-10 text-sm" disabled={isSharingWorkout} onClick={handleShare}>
                  {isSharingWorkout
                    ? "Compartilhando..."
                    : <><Share2 className="h-5 w-5" /> Compartilhar no Feed</>
                  }
                </Button>

                {/* Duel share — only shown when user has duel groups */}
                {duelGroups.length > 0 && (!isDuelShareModalOpen ? (
                  <Button
                    variant="outline"
                    className="w-full rounded-full gap-2 h-12 text-base"
                    onClick={handleOpenDuelShare}
                  >
                    <Swords className="h-5 w-5" /> Compartilhar no Duelo
                  </Button>
                ) : (
                  <div className="rounded-2xl border border-border/60 bg-card p-4 md:p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Swords className="h-4 w-4 text-brand" />
                      <p className="text-sm font-semibold">Escolha o grupo</p>
                    </div>
                    {duelGroups.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">Você não tem grupos de duelo. Crie um na aba Comunidade.</p>
                    ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {duelGroups.map((g) => (
                          <button
                            key={g.id}
                            onClick={() => setSelectedDuelGroupId(g.id)}
                            className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${selectedDuelGroupId === g.id
                              ? "border-brand bg-brand/10"
                              : "border-border/50 hover:border-brand/40"
                              }`}
                          >
                            <p className="text-sm font-medium truncate">{g.name}</p>
                            {g.goal && <p className="text-xs text-muted-foreground truncate">{g.goal}</p>}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 rounded-full h-9 md:h-8 text-xs"
                        onClick={() => { setIsDuelShareModalOpen(false); setSelectedDuelGroupId(null); }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 rounded-full h-9 text-xs gap-1.5"
                        disabled={!selectedDuelGroupId || isSharingDuel}
                        onClick={handleShareDuel}
                      >
                        {isSharingDuel ? "Enviando..." : <><Swords className="h-3.5 w-3.5" /> Confirmar</>}
                      </Button>
                    </div>
                  </div>
                ))}

                {/* ─── Timing Nutricional Pós-Treino ─── */}
                {showPostWorkoutNutrition && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm font-semibold">Nutrição Pós-Treino</span>
                      </div>
                      <button
                        onClick={() => setNutritionExpanded((v) => !v)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {nutritionExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    {nutritionExpanded && (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Para maximizar a recuperação, consuma dentro de 30–60 min:
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg bg-blue-500/10 p-2.5 md:p-2">
                            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">Proteína</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">20–40g · whey, ovo, frango</p>
                          </div>
                          <div className="rounded-lg bg-amber-500/10 p-2.5 md:p-2">
                            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">Carboidrato</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">30–60g · arroz, banana, batata</p>
                          </div>
                          <div className="rounded-lg bg-blue-400/10 p-2.5 md:p-2">
                            <p className="text-xs font-semibold text-blue-500 dark:text-blue-300">Hidratação</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">500ml+ de água</p>
                          </div>
                          <div className="rounded-lg bg-purple-500/10 p-2.5 md:p-2">
                            <p className="text-xs font-semibold text-purple-600 dark:text-purple-400">Timing</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Janela anabólica: até 2h</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <Button variant="ghost" className="w-full rounded-full h-12 md:h-10 text-base md:text-sm text-muted-foreground" onClick={closeSummary}>
                  Fechar
                </Button>
              </div>
            </div>
          </>,
          document.body
        );
      })()}

      {/* Badges/Insignias Drawer Modal — using shared InsigniasDrawer component */}
      <InsigniasDrawer
        open={badgesModalOpen}
        onOpenChange={setBadgesModalOpen}
        userBadges={userBadges}
        allBadges={allBadges}
        totalCheckIns={totalCheckIns}
      />
      {/* LEGACY INLINE DRAWER REMOVED — kept below as dead block for reference, delete after QA */}
      {false && <Drawer open={false} onOpenChange={() => { }}>
        <DrawerContent className="max-h-[80dvh] flex flex-col bg-gradient-to-b from-background via-background to-muted/30">
          <DrawerHeader className="shrink-0 border-b border-border/60">
            <DrawerTitle className="flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              Insignias
            </DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {/* Progress Overview */}
            <div className="mb-6 p-4 rounded-lg bg-brand/10 border border-brand/20">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-sm">Progresso Semanal</p>
                <p className="font-bold text-lg">{weekCheckIns.size}/7</p>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-brand transition-all duration-300 h-full rounded-full"
                  style={{ width: `${(weekCheckIns.size / 7) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {7 - weekCheckIns.size === 0
                  ? "Parabéns! Você completou a semana!"
                  : `Faltam ${7 - weekCheckIns.size} dia(s) para completar a semana`}
              </p>
            </div>

            <div className="space-y-3 pb-8">
              {/* 1 Day - Iniciante */}
              <div
                className={`group relative overflow-hidden rounded-xl transition-all duration-300 ${weekCheckIns.size >= 1
                  ? "bg-gradient-to-r from-yellow-500/20 to-yellow-500/5 border border-yellow-500/40 shadow-lg shadow-yellow-500/10"
                  : "bg-muted/40 border border-border/40 opacity-60"
                  }`}
              >
                <div className="p-4 flex items-start gap-4">
                  <div className={`text-4xl transition-transform ${weekCheckIns.size >= 1 ? "scale-110" : ""}`}>
                    ⭐
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm">Iniciante</p>
                      {weekCheckIns.size >= 1 && (
                        <Check className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Complete check-in 1 dia</p>
                    {weekCheckIns.size < 1 && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-1">{weekCheckIns.size}/1 dias</p>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-yellow-500 h-full transition-all"
                            style={{ width: `${(weekCheckIns.size / 1) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3 Days - Sequência */}
              <div
                className={`group relative overflow-hidden rounded-xl transition-all duration-300 ${weekCheckIns.size >= 3
                  ? "bg-gradient-to-r from-blue-500/20 to-blue-500/5 border border-blue-500/40 shadow-lg shadow-blue-500/10"
                  : "bg-muted/40 border border-border/40 opacity-60"
                  }`}
              >
                <div className="p-4 flex items-start gap-4">
                  <div className={`text-4xl transition-transform ${weekCheckIns.size >= 3 ? "scale-110" : ""}`}>
                    🔥
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm">Sequência</p>
                      {weekCheckIns.size >= 3 && (
                        <Check className="h-5 w-5 text-blue-600 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Complete check-in 3 dias</p>
                    {weekCheckIns.size < 3 && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-1">{Math.min(weekCheckIns.size, 3)}/3 dias</p>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-blue-500 h-full transition-all"
                            style={{ width: `${(Math.min(weekCheckIns.size, 3) / 3) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 5 Days - Campeão */}
              <div
                className={`group relative overflow-hidden rounded-xl transition-all duration-300 ${weekCheckIns.size >= 5
                  ? "bg-gradient-to-r from-green-500/20 to-green-500/5 border border-green-500/40 shadow-lg shadow-green-500/10"
                  : "bg-muted/40 border border-border/40 opacity-60"
                  }`}
              >
                <div className="p-4 flex items-start gap-4">
                  <div className={`text-4xl transition-transform ${weekCheckIns.size >= 5 ? "scale-110" : ""}`}>
                    💪
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm">Campeão</p>
                      {weekCheckIns.size >= 5 && (
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Complete check-in 5 dias</p>
                    {weekCheckIns.size < 5 && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-1">{Math.min(weekCheckIns.size, 5)}/5 dias</p>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-green-500 h-full transition-all"
                            style={{ width: `${(Math.min(weekCheckIns.size, 5) / 5) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 7 Days - Lendário */}
              <div
                className={`group relative overflow-hidden rounded-xl transition-all duration-300 ${weekCheckIns.size === 7
                  ? "bg-gradient-to-r from-purple-500/20 to-purple-500/5 border border-purple-500/40 shadow-lg shadow-purple-500/10"
                  : "bg-muted/40 border border-border/40 opacity-60"
                  }`}
              >
                <div className="p-4 flex items-start gap-4">
                  <div className={`text-4xl transition-transform ${weekCheckIns.size === 7 ? "scale-110 animate-pulse" : ""}`}>
                    👑
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm">Lendário</p>
                      {weekCheckIns.size === 7 && (
                        <Check className="h-5 w-5 text-purple-600 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Complete check-in 7 dias (semana completa)</p>
                    {weekCheckIns.size < 7 && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-1">{weekCheckIns.size}/7 dias</p>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-purple-500 h-full transition-all"
                            style={{ width: `${(weekCheckIns.size / 7) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border/60 p-4 bg-background/95 sticky bottom-0">
            <p className="text-xs text-muted-foreground text-center">
              Complete check-ins diários para ganhar insignias e desbloquear novos níveis!
            </p>
          </div>
        </DrawerContent>
      </Drawer>}

      {/* Workout History Drawer */}
      <Drawer open={workoutHistoryModalOpen} onOpenChange={setWorkoutHistoryModalOpen}>
        <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>
              Histórico de {selectedWorkoutForHistory?.name || "Exercício"}
            </DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-6">
            {isLoadingHistory ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Carregando histórico...
              </div>
            ) : workoutHistory.length > 0 ? (
              (() => {
                // ── Stats summary: PR, 1RM estimado, total sessões ──
                const allKilos = workoutHistory.map((r) => r.kilos || 0).filter((k) => k > 0);
                const prKg = allKilos.length > 0 ? Math.max(...allKilos) : null;
                const prRecord = prKg ? workoutHistory.find((r) => r.kilos === prKg) : null;
                const prReps = prRecord?.volume ? parseInt(prRecord.volume) || 1 : 1;
                // Epley formula: 1RM ≈ kg × (1 + reps/30)
                const estimated1RM = prKg && prReps > 0 ? Math.round(prKg * (1 + prReps / 30) * 10) / 10 : null;
                const totalSessions = new Set(
                  workoutHistory.map((r) => new Date(r.dateCompleted).toLocaleDateString("pt-BR"))
                ).size;

                // Group records by day
                const groupedByDay: Record<string, typeof workoutHistory> = {};
                workoutHistory.forEach((record) => {
                  const date = new Date(record.dateCompleted);
                  const dateKey = date.toLocaleDateString("pt-BR");
                  if (!groupedByDay[dateKey]) {
                    groupedByDay[dateKey] = [];
                  }
                  groupedByDay[dateKey].push(record);
                });

                // Sort days in descending order (newest first)
                const sortedDates = Object.keys(groupedByDay).sort((a, b) => {
                  const dateA = new Date(a.split("/").reverse().join("-"));
                  const dateB = new Date(b.split("/").reverse().join("-"));
                  return dateB.getTime() - dateA.getTime();
                });

                return (
                  <>
                    {/* Stats block: PR, 1RM estimado, sessões */}
                    <div className="grid grid-cols-3 gap-2 mb-5">
                      <div className="flex flex-col items-center gap-0.5 rounded-xl bg-brand/10 border border-brand/20 p-3">
                        <span className="text-lg">🏆</span>
                        <p className="text-xs text-muted-foreground">Recorde</p>
                        <p className="text-sm font-bold">{prKg ? `${prKg} kg` : "—"}</p>
                      </div>
                      <div className="flex flex-col items-center gap-0.5 rounded-xl bg-muted/40 border border-border/40 p-3">
                        <span className="text-lg">💡</span>
                        <p className="text-xs text-muted-foreground">1RM est.</p>
                        <p className="text-sm font-bold">{estimated1RM ? `${estimated1RM} kg` : "—"}</p>
                      </div>
                      <div className="flex flex-col items-center gap-0.5 rounded-xl bg-muted/40 border border-border/40 p-3">
                        <span className="text-lg">📅</span>
                        <p className="text-xs text-muted-foreground">Sessões</p>
                        <p className="text-sm font-bold">{totalSessions}</p>
                      </div>
                    </div>

                    {/* Progression Chart */}
                    {(() => {
                      // Build one point per day: max kg of that day
                      const chartData = sortedDates.slice().reverse().map((dateKey) => {
                        const dayKilos = groupedByDay[dateKey]
                          .map((r) => r.kilos || 0)
                          .filter((k) => k > 0);
                        const maxKg = dayKilos.length > 0 ? Math.max(...dayKilos) : 0;
                        const parts = dateKey.split("/");
                        const label = `${parts[0]}/${parts[1]}`;
                        return { date: label, kg: maxKg };
                      }).filter((d) => d.kg > 0);

                      if (chartData.length < 2) return null;

                      return (
                        <div className="mb-5 rounded-xl bg-muted/30 border border-border/40 p-3">
                          <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                            <TrendingUp className="h-3.5 w-3.5" />
                            Progressão de carga (kg)
                          </p>
                          <ResponsiveContainer width="100%" height={120}>
                            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                              <XAxis
                                dataKey="date"
                                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                                tickLine={false}
                                axisLine={false}
                              />
                              <YAxis
                                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                                tickLine={false}
                                axisLine={false}
                                domain={["auto", "auto"]}
                              />
                              <Tooltip
                                contentStyle={{
                                  background: "hsl(var(--card))",
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: 8,
                                  fontSize: 12,
                                }}
                                formatter={(value: number) => [`${value} kg`, "Carga"]}
                                labelStyle={{ color: "hsl(var(--muted-foreground))", marginBottom: 2 }}
                              />
                              {prKg && (
                                <ReferenceLine
                                  y={prKg}
                                  stroke="hsl(var(--brand))"
                                  strokeDasharray="4 3"
                                  label={{ value: "PR", position: "insideTopRight", fontSize: 9, fill: "hsl(var(--brand))" }}
                                />
                              )}
                              <Line
                                type="monotone"
                                dataKey="kg"
                                stroke="hsl(var(--brand))"
                                strokeWidth={2}
                                dot={{ r: 3, fill: "hsl(var(--brand))", strokeWidth: 0 }}
                                activeDot={{ r: 5 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    })()}

                    {sortedDates.map((dateKey) => {
                      const dayRecords = groupedByDay[dateKey];
                      const totalKilos = dayRecords
                        .reduce((sum, r) => sum + (r.kilos || 0), 0);
                      const totalReps = dayRecords.length;

                      return (
                        <div key={dateKey} className="mb-6">
                          {/* Date Header */}
                          <div className="sticky top-0 bg-background/95 py-2 mb-2">
                            <button
                              className="text-xs font-semibold text-muted-foreground uppercase hover:text-brand transition-colors flex items-center gap-1"
                              onClick={() => {
                                const totalVolume = dayRecords.reduce((sum, r) => sum + (r.kilos || 0), 0);
                                const totalSeries = dayRecords.length;
                                const kgValues = dayRecords.map((r) => r.kilos || 0).filter((k) => k > 0);
                                const bestKg = kgValues.length > 0 ? Math.max(...kgValues) : 0;
                                const prHistorical = workoutHistory
                                  .filter((r) => new Date(r.dateCompleted).toLocaleDateString("pt-BR") !== dateKey)
                                  .map((r) => r.kilos || 0);
                                const bestHistorical = prHistorical.length > 0 ? Math.max(...prHistorical) : 0;
                                const prs = bestKg > bestHistorical && selectedWorkoutForHistory?.name
                                  ? [{ exerciseName: selectedWorkoutForHistory.name, kg: bestKg, reps: (() => { const rec = dayRecords.find((r) => r.kilos === bestKg); return rec?.volume ? parseInt(rec.volume) || 0 : 0; })() }]
                                  : [];
                                setWorkoutSummaryData({
                                  duration: 0,
                                  totalVolume,
                                  totalSeries,
                                  exerciseNames: selectedWorkoutForHistory?.name ? [selectedWorkoutForHistory.name] : [],
                                  exercises: dayRecords.map((r) => ({
                                    workoutId: selectedWorkoutForHistory?.id || "",
                                    workoutName: selectedWorkoutForHistory?.name || "",
                                    muscleGroup: selectedWorkoutForHistory?.muscle_group || null,
                                    kilos: r.kilos || null,
                                    volume: r.volume || null,
                                  })),
                                  routineName: selectedWorkoutForHistory?.name || null,
                                  prs,
                                  isAllCardio: (selectedWorkoutForHistory?.muscle_group || "").toLowerCase() === "cardio",
                                  totalKm: (selectedWorkoutForHistory?.muscle_group || "").toLowerCase() === "cardio" ? totalVolume : 0,
                                });
                                setWorkoutHistoryModalOpen(false);
                                setWorkoutSummaryOpen(true);
                                setShowPostWorkoutNutrition(false);
                                // Pre-build description for history summary (no linked goal lookup needed)
                                const hName = selectedWorkoutForHistory?.name || null;
                                const hStr = hName ? `Treino de ${hName}` : "Treino concluído";
                                setWorkoutPostDescription(`💪 ${hStr}!\n✅ ${dayRecords.length} séries\n\n#Linka #Fitness #Treino`);
                                if (user) {
                                  getEnrichedDuelGroupsDb(user.id).then(({ myGroups }) => {
                                    setDuelGroups(myGroups.map((g) => ({ id: g.id, name: g.name, goal: g.goal })));
                                  }).catch(() => setDuelGroups([]));
                                }
                              }}
                            >
                              {dateKey} <span className="text-brand/60 font-normal ml-1">· ver resumo</span>
                            </button>
                            <div className="flex gap-4 mt-1">
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  {totalReps} série(s)
                                </p>
                              </div>
                              {totalKilos > 0 && (
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    {totalKilos} kg total
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Records for this day */}
                          <div className="space-y-1">
                            {dayRecords.map((record) => {
                              const time = new Date(record.dateCompleted).toLocaleTimeString(
                                "pt-BR",
                                { hour: "2-digit", minute: "2-digit" }
                              );
                              return (
                                <div
                                  key={record.id}
                                  className="flex items-center justify-between p-2 rounded hover:bg-muted/40 transition-colors"
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <p className="text-xs text-muted-foreground w-10">
                                      {time}
                                    </p>
                                    <div className="flex gap-2 flex-1 min-w-0 overflow-x-auto">
                                      {record.kilos && (
                                        <span className="text-xs font-medium px-2 py-1 bg-muted/50 rounded whitespace-nowrap">
                                          {record.kilos} kg
                                        </span>
                                      )}
                                      {record.volume && (
                                        <span className="text-xs font-medium px-2 py-1 bg-muted/50 rounded whitespace-nowrap">
                                          {record.volume}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </>
                );
              })()
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Nenhum registro de treino encontrado
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Routine Selection Modal for Goal Cards */}
      <Drawer open={goalRoutineModalOpen} onOpenChange={setGoalRoutineModalOpen}>
        <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>
              {goalRoutineModalMode === "view"
                ? `Rotinas Vinculadas — "${selectedGoalForRoutines?.description}"`
                : `Vincular Rotinas — "${selectedGoalForRoutines?.description}"`}
            </DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3 pt-4">
            {(() => {
              const TYPES = [
                { code: 1, label: "Exercícios", emoji: "🏋️" },
                { code: 2, label: "Dietas", emoji: "🥗" },
                { code: 3, label: "Hábitos", emoji: "✅" },
              ];

              const goalId = selectedGoalForRoutines
                ? String(selectedGoalForRoutines.id)
                : null;

              // In link mode: hide routines already linked to this goal
              const alreadyLinkedRoutineIds = new Set(
                routines
                  .filter((r) => r.goal_id && goalId && String(r.goal_id) === goalId)
                  .map((r) => r.id)
              );

              // Helper: check if a routine has actual items in the corresponding user data
              const routineHasItems = (r: Routine) => {
                const isUnnamed = !r.name;
                if (r.type === 1) {
                  return userWorkouts.some((w) => isUnnamed ? !w.name : w.name === r.name);
                } else if (r.type === 2) {
                  return userDiets.some((d) => isUnnamed ? !d.name : d.name === r.name);
                } else {
                  return userHabits.some((h) => isUnnamed ? !h.name : h.name === r.name);
                }
              };

              const displayRoutines =
                goalRoutineModalMode === "view"
                  ? routines.filter(
                    (r) => r.goal_id && goalId && String(r.goal_id) === goalId,
                  )
                  : routines.filter((r) => !alreadyLinkedRoutineIds.has(r.id) && routineHasItems(r));

              if (displayRoutines.length === 0) {
                return (
                  <div className="flex flex-col items-center gap-4 py-10">
                    <p className="text-sm text-muted-foreground text-center">
                      {goalRoutineModalMode === "view"
                        ? "Nenhuma rotina vinculada a esta meta."
                        : routines.length === 0
                          ? "Você ainda não tem rotinas. Crie uma para vincular."
                          : "Nenhuma rotina disponível para vincular."}
                    </p>
                    {goalRoutineModalMode !== "view" && routines.length === 0 && (
                      <Button
                        className="rounded-full gap-2"
                        onClick={() => {
                          setGoalRoutineModalOpen(false);
                          setAddRoutineModalOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        Criar Rotina
                      </Button>
                    )}
                  </div>
                );
              }

              // View mode: group by routine name first, then show types inside
              if (goalRoutineModalMode === "view") {
                const TYPES_MAP: Record<number, { label: string; emoji: string }> = {
                  1: { label: "Exercícios", emoji: "🏋️" },
                  2: { label: "Dietas", emoji: "🥗" },
                  3: { label: "Hábitos", emoji: "✅" },
                };
                // Get unique routine names from linked routines
                const nameGroupMap: Record<string, typeof displayRoutines> = {};
                displayRoutines.forEach((r) => {
                  const key = r.name || TYPES_MAP[r.type]?.label || "Rotina";
                  if (!nameGroupMap[key]) nameGroupMap[key] = [];
                  nameGroupMap[key].push(r);
                });
                return Object.entries(nameGroupMap).map(([routineName, routineGroup]) => {
                  const isOpen = openRoutineItems.has(`view::${routineName}`);
                  // Group by type inside this name
                  const typeGroups: Record<number, typeof displayRoutines> = {};
                  routineGroup.forEach((r) => {
                    if (!typeGroups[r.type]) typeGroups[r.type] = [];
                    typeGroups[r.type].push(r);
                  });
                  const allIds = routineGroup.map((r) => r.id);
                  return (
                    <div key={routineName} className="rounded-xl border border-border/60 overflow-hidden">
                      <div className="flex items-center px-4 py-3 gap-3">
                        <button
                          className="flex-1 flex items-center justify-between text-left"
                          onClick={() => {
                            const next = new Set(openRoutineItems);
                            const key = `view::${routineName}`;
                            if (next.has(key)) next.delete(key);
                            else next.add(key);
                            setOpenRoutineItems(next);
                          }}
                        >
                          <div>
                            <p className="text-sm font-semibold">{routineName}</p>
                            <p className="text-xs text-muted-foreground">
                              {Object.keys(typeGroups).length} tipo(s) · {routineGroup.length} item(s)
                            </p>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              for (const id of allIds) {
                                await updateRoutineGoalDb(id, null);
                              }
                              setRoutines((prev) =>
                                prev.map((r) => allIds.includes(r.id) ? { ...r, goal_id: null } : r)
                              );
                              toast({ title: "Rotina desvinculada", description: `"${routineName}" foi desvinculada da meta.` });
                            } catch {
                              toast({ title: "Erro ao desvincular rotina", variant: "destructive" });
                            }
                          }}
                          className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Desvincular rotina"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {isOpen && (
                        <div className="border-t border-border/60 bg-muted/20 divide-y divide-border/40">
                          {Object.entries(typeGroups).map(([typeCodeStr, items]) => {
                            const typeCode = Number(typeCodeStr);
                            const { label, emoji } = TYPES_MAP[typeCode] || { label: "Rotina", emoji: "📋" };
                            return (
                              <div key={typeCode} className="px-4 py-2.5">
                                <p className="text-xs font-medium text-muted-foreground mb-1.5">{emoji} {label}</p>
                                <div className="space-y-1">
                                  {(() => {
                                    const routineName = items[0]?.name ?? null;
                                    const allSubItems = typeCode === 1
                                      ? userWorkouts.filter((w) => routineName ? w.name === routineName : !w.name)
                                      : typeCode === 2
                                        ? userDiets.filter((d) => routineName ? d.name === routineName : !d.name)
                                        : userHabits.filter((h) => routineName ? h.name === routineName : !h.name);
                                    const seen = new Set<string>();
                                    const dedupedItems = allSubItems.filter((item: any) => {
                                      const key = typeCode === 1 ? item.workout_id : typeCode === 2 ? item.diet_id : item.habit_id;
                                      if (seen.has(key)) return false;
                                      seen.add(key);
                                      return true;
                                    });
                                    return dedupedItems.map((item: any) => (
                                      <p key={item.id} className="text-xs text-muted-foreground pl-2">
                                        •{" "}
                                        {typeCode === 1 ? item.workoutName : typeCode === 2 ? item.dietName : item.habitName}
                                      </p>
                                    ));
                                  })()}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                });
              }

              return TYPES.map(({ code, label, emoji }) => {
                const typeRoutines = displayRoutines.filter((r) => r.type === code);
                if (typeRoutines.length === 0) return null;

                // Group routines by name — deduplicate, show one row per unique name
                const nameGroupMap = typeRoutines.reduce(
                  (acc, r) => {
                    const key = r.name || label;
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(r);
                    return acc;
                  },
                  {} as Record<string, typeof typeRoutines>,
                );
                const nameGroups = Object.entries(nameGroupMap);

                const isTypeOpen = openRoutineTypes.has(code);

                return (
                  <div key={code} className="rounded-xl border border-border/60 overflow-hidden">
                    {/* Type Header (dropdown trigger) */}
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        const next = new Set(openRoutineTypes);
                        if (next.has(code)) next.delete(code);
                        else next.add(code);
                        setOpenRoutineTypes(next);
                      }}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <span>{emoji}</span>
                        {label}
                        <span className="text-xs font-normal text-muted-foreground">
                          ({nameGroups.length})
                        </span>
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform ${isTypeOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    {/* Grouped routines list */}
                    {isTypeOpen && (
                      <div className="divide-y divide-border/40">
                        {nameGroups.map(([groupName, groupRoutines]) => {
                          const groupKey = `${code}::${groupName}`;
                          const groupIds = groupRoutines.map((r) => r.id);
                          const isGroupOpen = openRoutineItems.has(groupKey);
                          const isSelected = groupIds.some((id) =>
                            goalRoutineSelection.has(id),
                          );

                          // Sub-items from related table filtered by group name (deduplicated)
                          // groupName === label means the routine has no name (null), so filter by !name
                          const isUnnamed = groupName === label;
                          const subItemsRaw =
                            code === 1
                              ? userWorkouts.filter((w) => isUnnamed ? !w.name : w.name === groupName)
                              : code === 2
                                ? userDiets.filter((d) => isUnnamed ? !d.name : d.name === groupName)
                                : userHabits.filter((h) => isUnnamed ? !h.name : h.name === groupName);
                          const seenSubIds = new Set<string>();
                          const subItems = subItemsRaw.filter((item: any) => {
                            const key = code === 1 ? item.workout_id : code === 2 ? item.diet_id : item.habit_id;
                            if (seenSubIds.has(key)) return false;
                            seenSubIds.add(key);
                            return true;
                          });

                          return (
                            <div key={groupKey}>
                              {/* Group row */}
                              <div className="flex items-center px-4 py-3 gap-3">
                                {goalRoutineModalMode === "link" && (
                                  <button
                                    onClick={() => {
                                      const next = new Set(goalRoutineSelection);
                                      if (isSelected) {
                                        groupIds.forEach((id) => next.delete(id));
                                      } else {
                                        groupIds.forEach((id) => next.add(id));
                                      }
                                      setGoalRoutineSelection(next);
                                    }}
                                    className={`shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected
                                      ? "border-brand bg-brand"
                                      : "border-border"
                                      }`}
                                  >
                                    {isSelected && (
                                      <Check className="h-3 w-3 text-white" />
                                    )}
                                  </button>
                                )}
                                <button
                                  className="flex-1 flex items-center justify-between text-left"
                                  onClick={() => {
                                    const next = new Set(openRoutineItems);
                                    if (next.has(groupKey)) next.delete(groupKey);
                                    else next.add(groupKey);
                                    setOpenRoutineItems(next);
                                  }}
                                >
                                  <div>
                                    <p className="text-sm font-medium">{groupName}</p>
                                    {subItems.length > 0 && (
                                      <p className="text-xs text-muted-foreground">
                                        {subItems.length} item(s)
                                      </p>
                                    )}
                                  </div>
                                  {subItems.length > 0 && (
                                    <ChevronDown
                                      className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${isGroupOpen ? "rotate-180" : ""}`}
                                    />
                                  )}
                                </button>
                                {goalRoutineModalMode === "view" && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        for (const id of groupIds) {
                                          await updateRoutineGoalDb(id, null);
                                        }
                                        setRoutines((prev) =>
                                          prev.map((r) =>
                                            groupIds.includes(r.id)
                                              ? { ...r, goal_id: null }
                                              : r,
                                          ),
                                        );
                                        toast({
                                          title: "Rotina desvinculada",
                                          description: `"${groupName}" foi desvinculada da meta.`,
                                        });
                                      } catch {
                                        toast({
                                          title: "Erro ao desvincular rotina",
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                    className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                    title="Desvincular rotina"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>

                              {/* Sub-items dropdown */}
                              {isGroupOpen && subItems.length > 0 && (
                                <div className="bg-muted/20 border-t border-border/40 px-4 py-2 space-y-1">
                                  {subItems.map((item) => {
                                    const itemName =
                                      code === 1
                                        ? (item as typeof userWorkouts[0]).workoutName
                                        : code === 2
                                          ? (item as typeof userDiets[0]).dietName
                                          : (item as typeof userHabits[0]).habitName;
                                    return (
                                      <div
                                        key={item.id}
                                        className="flex items-center gap-2 py-1.5 text-sm text-muted-foreground"
                                      >
                                        <span className="h-1.5 w-1.5 rounded-full bg-brand shrink-0" />
                                        {itemName}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              });
            })()}

            {/* Link mode: "Vincular" button + option to switch to link mode from view */}
            {goalRoutineModalMode === "view" && (
              <Button
                variant="outline"
                className="w-full rounded-full mt-2"
                onClick={() => {
                  setGoalRoutineModalMode("link");
                  setGoalRoutineSelection(new Set());
                  setOpenRoutineTypes(new Set());
                  setOpenRoutineItems(new Set());
                }}
              >
                + Vincular mais rotinas
              </Button>
            )}

            {goalRoutineModalMode === "link" && goalRoutineSelection.size > 0 && (() => {
              // Count unique group names selected (not individual IDs)
              const selectedNames = new Set(
                routines
                  .filter((r) => goalRoutineSelection.has(r.id))
                  .map((r) => `${r.type}::${r.name || getRoutineTypeName(r.type)}`),
              );
              const groupCount = selectedNames.size;
              return (
                <Button
                  className="w-full rounded-full mt-2"
                  onClick={async () => {
                    try {
                      if (selectedGoalForRoutines && user) {
                        const goalId = String(selectedGoalForRoutines.id);
                        for (const routineId of Array.from(goalRoutineSelection)) {
                          await updateRoutineGoalDb(routineId, goalId);
                        }
                        setRoutines((prev) =>
                          prev.map((r) =>
                            goalRoutineSelection.has(r.id) ? { ...r, goal_id: goalId } : r,
                          ),
                        );
                      }
                      toast({
                        title: "Rotinas Vinculadas!",
                        description: `${goalRoutineSelection.size} rotina(s) vinculada(s) com sucesso.`,
                      });
                      setGoalRoutineModalOpen(false);
                      setGoalRoutineSelection(new Set());
                      setSelectedGoalForRoutines(null);
                      setGoalRoutineMuscleGroups(new Set());
                      setOpenRoutineTypes(new Set());
                      setOpenRoutineItems(new Set());
                    } catch (err) {
                      toast({
                        title: "Erro ao vincular rotinas",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  Confirmar Seleção ({groupCount} rotina{groupCount !== 1 ? "s" : ""})
                </Button>
              );
            })()}
          </div>
        </DrawerContent>
      </Drawer>

      <CreateWorkoutDrawer
        open={createWorkoutDrawerOpen}
        onOpenChange={setCreateWorkoutDrawerOpen}
        muscleGroups={uniqueMuscleGroups}
        initialName={createWorkoutInitialName}
        onCreated={(workout) => {
          setWorkouts((prev) => [workout, ...prev]);
          setSelectedItems((prev) => new Set([...prev, workout.id]));
        }}
      />

      <CreateGoalDrawer
        open={createGoalDrawerOpen}
        onOpenChange={setCreateGoalDrawerOpen}
        userId={user?.id ?? ""}
        onCreated={({ goalId, freshUserGoals, newGoal }) => {
          setUserGoals(freshUserGoals);
          setSelectedGoalIds((prev) => [...prev, goalId]);
          setGoals((prev) => prev.some((g) => g.id === goalId) ? prev : [...prev, newGoal]);
        }}
      />

      {/* Goal Completion Celebration Modal */}
      {celebrationGoal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 space-y-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            {/* Confetti emoji header */}
            <div className="text-center space-y-2">
              <div className="text-5xl animate-bounce">🏆</div>
              <h2 className="text-xl font-bold">Meta concluída!</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Você completou a meta{" "}
                <span className="font-semibold text-foreground">
                  "{celebrationGoal.description}"
                </span>
                . Incrível conquista!
              </p>
            </div>

            {/* Progress bar at 100% */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{celebrationGoal.quantity} de {celebrationGoal.quantity} dias</span>
                <span className="font-bold text-brand">100%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div className="bg-brand h-full rounded-full w-full transition-all duration-700" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Button
                className="w-full rounded-full gap-2"
                onClick={() => {
                  const text = `🏆 Completei minha meta no Linka: "${celebrationGoal.description}"! ${celebrationGoal.quantity} dias de dedicação. Baixe o app e junte-se a mim! 💪`;
                  if (navigator.share) {
                    navigator.share({ text }).catch(() => { });
                  } else {
                    navigator.clipboard.writeText(text).then(() => {
                      toast({ title: "Copiado!", description: "Texto da conquista copiado para a área de transferência." });
                    }).catch(() => { });
                  }
                  setCelebrationGoal(null);
                }}
              >
                🎉 Compartilhar conquista
              </Button>
              <Button
                variant="ghost"
                className="w-full rounded-full text-muted-foreground"
                onClick={() => setCelebrationGoal(null)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Link Goal from Routines Tab */}
      <LinkGoalDrawer
        open={linkGoalForRoutineOpen}
        onOpenChange={(v) => { setLinkGoalForRoutineOpen(v); if (!v) setLinkGoalRoutineKey(null); }}
        userGoals={userGoals}
        routines={routines}
        routineKey={linkGoalRoutineKey}
        onLinked={(routineIds, goalId) => {
          setRoutines((prev) =>
            prev.map((r) => routineIds.includes(r.id) ? { ...r, goal_id: goalId } : r)
          );
        }}
      />
      <ImageZoomDrawer item={imageZoom} onClose={() => setImageZoom(null)} />

      <ScheduledTimeDrawer
        open={scheduledTimeDrawerOpen}
        onOpenChange={setScheduledTimeDrawerOpen}
        isSaving={isSavingScheduledTime}
        routineName={scheduledTimeTarget?.name ?? ""}
        currentTime={scheduledTimeTarget?.currentTime ?? null}
        onConfirm={handleSaveScheduledTime}
      />

      <RenameRoutineDialog
        open={renameRoutineOpen}
        onOpenChange={setRenameRoutineOpen}
        userId={user?.id ?? ""}
        routineData={renameRoutineData}
        initialValue={renameRoutineValue}
        onRenamed={({ routines, userWorkouts, userDiets, userHabits }) => {
          setRoutines(routines);
          setUserWorkouts(userWorkouts);
          setUserDiets(userDiets);
          setUserHabits(userHabits);
        }}
      />

      {/* Hidden canvas for goal completion card */}
      <canvas ref={goalCompletionCanvasRef} width={800} height={800} className="hidden" />

      {/* Goal Completion Celebration Modal */}
      <Dialog open={!!goalCompletedModal} onOpenChange={(open) => { if (!open) { setGoalCompletedModal(null); setGoalCompletionCanvasUrl(null); } }}>
        <DialogContent className="max-w-sm mx-auto text-center">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">
              🏆 Meta Concluída!
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {/* Canvas preview */}
            {goalCompletionCanvasUrl ? (
              <img
                src={goalCompletionCanvasUrl}
                alt="Card de conquista"
                className="w-full rounded-xl border border-brand/30 shadow-lg"
              />
            ) : (
              <div className="w-full aspect-square rounded-xl bg-muted animate-pulse" />
            )}

            <div className="w-full space-y-2">
              <Label className="text-xs text-muted-foreground text-left block">Mensagem para o feed</Label>
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand"
                rows={3}
                value={goalCompletionPostText}
                onChange={(e) => setGoalCompletionPostText(e.target.value)}
              />
            </div>

            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1 rounded-full"
                onClick={() => { setGoalCompletedModal(null); setGoalCompletionCanvasUrl(null); }}
              >
                Fechar
              </Button>
              <Button
                className="flex-1 rounded-full"
                disabled={isSharingGoalCompletion}
                onClick={async () => {
                  if (!user || !goalCompletedModal) return;
                  setIsSharingGoalCompletion(true);
                  try {
                    let photoUrl: string | null = null;
                    // Upload canvas image
                    const canvas = goalCompletionCanvasRef.current;
                    if (canvas) {
                      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
                      if (blob) {
                        const filePath = `${user.id}/${Date.now()}-goal-completed.png`;
                        const { error: uploadError } = await supabase.storage
                          .from("posts")
                          .upload(filePath, blob, { contentType: "image/png", upsert: false });
                        if (!uploadError) {
                          const { data: urlData } = supabase.storage.from("posts").getPublicUrl(filePath);
                          photoUrl = urlData.publicUrl;
                        }
                      }
                    }
                    await createPostDb(
                      photoUrl,
                      goalCompletionPostText,
                      goalCompletedModal.userGoalId,
                    );
                    toast({
                      title: "Postado no feed! 🎉",
                      description: "Sua conquista foi compartilhada.",
                    });
                    setGoalCompletedModal(null);
                    setGoalCompletionCanvasUrl(null);
                    navigate("/");
                  } catch {
                    toast({
                      title: "Erro ao postar",
                      variant: "destructive",
                    });
                  } finally {
                    setIsSharingGoalCompletion(false);
                  }
                }}
              >
                {isSharingGoalCompletion ? "Postando..." : "Compartilhar no Feed"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* ─── Modal de Humor do Dia ─────────────────────────────────────────── */}
      <MoodDialog
        open={moodModalOpen}
        onOpenChange={setMoodModalOpen}
        userId={user?.id ?? ""}
        todayMood={todayMood}
        onMoodSaved={(mood) => setTodayMood(mood)}
      />

    </div>
  );
}
