import * as React from "react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Search,
  Pencil,
  Minus,
  Sparkles,
  CalendarCheck,
} from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { toast } from "@/components/ui/use-toast";
import { DietImage } from "@/components/shared/diet-image";
import { PremiumGate } from "@/components/shared/premium-gate";
import { TrendChart } from "@/components/shared/trend-chart";
import { usePremium } from "@/lib/premium-context";
import {
  GLASS_SHEET_PROPS,
  GLASS_SHEET_STYLE,
  GLASS_PANEL_STYLE,
  GLASS_PRIMARY_BTN_STYLE,
} from "@/lib/glass-styles";
import {
  getFoodLogsDb,
  addFoodLogDb,
  deleteFoodLogDb,
  getNutritionGoalsDb,
  upsertNutritionGoalsDb,
  getRecentFoodsDb,
  getFoodLogDayTotalsDb,
  getDietsDb,
  createCustomDietDb,
  awardNutritionBadgesDb,
  type FoodLog,
  type FoodLogMealType,
  type NutritionGoals,
  type Diet,
  type Badge,
} from "@/lib/ritmofit-db";
import {
  useWaterLog,
  WATER_ACCENT,
  WATER_STEPS_ML,
} from "@/components/goals/use-water-log";
import { useKeyboardInputScroll } from "@/hooks/use-keyboard-input-scroll";

const ACCENT = "#3ddc84";
const MEAL_TYPES: FoodLogMealType[] = [0, 1, 2, 3];
const MEAL_EMOJI: Record<FoodLogMealType, string> = { 0: "☕", 1: "🍽️", 2: "🍎", 3: "🌙" };

// "Não perguntar novamente" do prompt de transformar o diário em rotina.
const ASK_ROUTINE_KEY = "lk:foodDiaryAskRoutine";

const FIELD_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,.07)",
  border: "1px solid rgba(255,255,255,.12)",
};

/** Data local (não UTC) em YYYY-MM-DD — o jantar das 22h precisa cair no dia certo. */
export function localDateISO(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Refeição mais provável para um horário "HH:MM" (ou o horário atual quando
 * ausente): café até 10:30, almoço até 14:30, lanche até 17:30, jantar até 22h.
 */
export function inferMealType(time?: string | null): FoodLogMealType {
  let hour: number;
  let minute: number;
  const m = time ? /^(\d{1,2}):(\d{2})/.exec(time) : null;
  if (m) {
    hour = Number(m[1]);
    minute = Number(m[2]);
  } else {
    const now = new Date();
    hour = now.getHours();
    minute = now.getMinutes();
  }
  const mins = hour * 60 + minute;
  if (mins < 630) return 0; // até 10:30 → café da manhã
  if (mins < 870) return 1; // até 14:30 → almoço
  if (mins < 1050) return 2; // até 17:30 → lanche
  if (mins < 1320) return 3; // até 22:00 → jantar
  return 2;
}

const MONTHS: Record<string, string[]> = {
  pt: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

function fmtKcal(n: number): string {
  return String(Math.round(n));
}

function fmtQty(v: number, lang: string): string {
  const s = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return lang === "pt" ? s.replace(".", ",") : s;
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

type RecentFood = Pick<
  FoodLog,
  "name" | "calories" | "protein_g" | "carbs_g" | "fat_g" | "sugar_g" | "diet_id"
>;

interface FoodDiaryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Incrementado pelo pai quando o diário muda fora daqui (auto-log da rotina de dieta). */
  refreshToken?: number;
  /**
   * Insígnias de nutrição conquistadas ao registrar um alimento. O pai (Goals)
   * guarda como pendente e só celebra quando o diário fecha — o BadgeUnlockedDialog
   * é Radix e abriria ATRÁS deste drawer (mesmo motivo do resumo do treino).
   */
  onBadgesUnlocked?: (badges: Badge[]) => void;
  /** O usuário já tem rotina(s) de dieta? Controla o botão rotina × transformar e o prompt. */
  hasDietRoutines: boolean;
  /** Abre a lista de rotinas de dieta (o pai fecha o diário e abre o RoutineListDrawer). */
  onOpenRoutines: () => void;
  /** Cria uma rotina de dieta diária a partir das entradas de hoje. Retorna true em sucesso. */
  onTransform: (todayLogs: FoodLog[]) => Promise<boolean>;
}

export function FoodDiaryDrawer({
  open,
  onOpenChange,
  refreshToken = 0,
  hasDietRoutines,
  onOpenRoutines,
  onTransform,
  onBadgesUnlocked,
}: FoodDiaryDrawerProps) {
  const { t, language } = useLanguage();
  const { isPremium } = usePremium();
  const today = localDateISO();

  const [view, setView] = React.useState<"diary" | "add" | "goal">("diary");
  const [date, setDate] = React.useState(today);
  const [logs, setLogs] = React.useState<FoodLog[]>([]);
  const [todayLogs, setTodayLogs] = React.useState<FoodLog[]>([]);
  const [goals, setGoals] = React.useState<NutritionGoals | null>(null);
  const [dayTotals, setDayTotals] = React.useState<Array<{ date: string; calories: number }>>([]);
  const [saving, setSaving] = React.useState(false);

  // ── Transformar diário em rotina ──
  const [routinePrompt, setRoutinePrompt] = React.useState(false);
  const [transforming, setTransforming] = React.useState(false);
  // "Agora não" silencia o prompt até o app reabrir (sem gravar nada).
  const askedThisSessionRef = React.useRef(false);

  // ── Adicionar alimento ──
  const [addMeal, setAddMeal] = React.useState<FoodLogMealType>(0);
  const [search, setSearch] = React.useState("");
  const [catalog, setCatalog] = React.useState<Diet[] | null>(null);
  const [recents, setRecents] = React.useState<RecentFood[]>([]);
  const [selectedFoodId, setSelectedFoodId] = React.useState<string | null>(null);
  const [qty, setQty] = React.useState(1);
  const [manualOpen, setManualOpen] = React.useState(false);
  const [manualName, setManualName] = React.useState("");
  const [manualKcal, setManualKcal] = React.useState("");
  const [manualProtein, setManualProtein] = React.useState("");
  const [manualCarbs, setManualCarbs] = React.useState("");
  const [manualFat, setManualFat] = React.useState("");
  const [manualSugar, setManualSugar] = React.useState("");

  // ── Meta diária ──
  const [goalKcal, setGoalKcal] = React.useState("");
  const [goalProtein, setGoalProtein] = React.useState("");
  const [goalCarbs, setGoalCarbs] = React.useState("");
  const [goalFat, setGoalFat] = React.useState("");
  const [goalWater, setGoalWater] = React.useState("");

  // A água do dia é do useWaterLog (compartilhado com o slide do Hub do Hoje).
  const loadDay = React.useCallback(async (d: string) => {
    const rows = await getFoodLogsDb(d);
    setLogs(rows);
    if (d === localDateISO()) setTodayLogs(rows);
  }, []);

  // Dados de hoje + meta — recarregados quando o pai sinaliza mudança externa.
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const [rows, g] = await Promise.all([getFoodLogsDb(today), getNutritionGoalsDb()]);
      if (!alive) return;
      setTodayLogs(rows);
      if (date === today) setLogs(rows);
      setGoals(g);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  // Abertura: sempre começa no diário de hoje.
  React.useEffect(() => {
    if (!open) return;
    setDate(localDateISO());
    setView("diary");
    setRoutinePrompt(false);
    getFoodLogDayTotalsDb(7).then(setDayTotals);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Trocou o dia dentro do drawer → busca as entradas daquele dia.
  React.useEffect(() => {
    if (open) loadDay(date);
  }, [open, date, loadDay]);

  const openAdd = (meal: FoodLogMealType) => {
    setAddMeal(meal);
    setSearch("");
    setSelectedFoodId(null);
    setQty(1);
    setManualOpen(false);
    setView("add");
    if (catalog == null) getDietsDb().then(setCatalog);
    getRecentFoodsDb().then(setRecents);
  };

  const openGoal = () => {
    setGoalKcal(goals?.calories_target != null ? String(Math.round(goals.calories_target)) : "");
    setGoalProtein(goals?.protein_target_g != null ? String(Math.round(goals.protein_target_g)) : "");
    setGoalCarbs(goals?.carbs_target_g != null ? String(Math.round(goals.carbs_target_g)) : "");
    setGoalFat(goals?.fat_target_g != null ? String(Math.round(goals.fat_target_g)) : "");
    setGoalWater(goals?.water_target_ml != null ? String(Math.round(goals.water_target_ml)) : "");
    setView("goal");
  };

  // Insígnias de nutrição são avaliadas a partir do diário (comida + água), então
  // qualquer registro pode fechar uma sequência (ex.: 7º dia batendo a meta de água).
  const checkNutritionBadges = () => {
    if (!onBadgesUnlocked) return;
    awardNutritionBadgesDb()
      .then((awarded) => {
        if (awarded.length > 0) onBadgesUnlocked(awarded);
      })
      .catch(() => { /* insígnia é bônus: nunca derruba o registro */ });
  };

  const { water, target: waterTarget, changeWater } = useWaterLog({
    date,
    targetMl: goals?.water_target_ml ?? null,
    refreshToken,
    onChanged: checkNutritionBadges,
    celebrateOnGoalReached: date === today, // não celebra ao editar dia passado
  });

  // ── Totais ──
  const sum = (rows: FoodLog[], key: "calories" | "protein_g" | "carbs_g" | "fat_g" | "sugar_g") =>
    rows.reduce((acc, r) => acc + (r[key] ?? 0), 0);

  const dayKcal = sum(logs, "calories");
  const target = goals?.calories_target ?? null;

  const maybeAskRoutine = (createdForDate: string, updatedLogs: FoodLog[]) => {
    if (createdForDate !== today) return;
    if (hasDietRoutines) return;
    if (askedThisSessionRef.current) return;
    if (updatedLogs.length === 0) return;
    try {
      if (localStorage.getItem(ASK_ROUTINE_KEY) === "never") return;
    } catch {}
    setRoutinePrompt(true);
  };

  const addEntry = async (entry: {
    name: string;
    quantity: number;
    calories: number | null;
    protein_g?: number | null;
    carbs_g?: number | null;
    fat_g?: number | null;
    sugar_g?: number | null;
    diet_id?: string | null;
  }) => {
    setSaving(true);
    try {
      const created = await addFoodLogDb({
        log_date: date,
        meal_type: addMeal,
        ...entry,
      });
      const nextLogs = [...logs, created];
      setLogs(nextLogs);
      if (date === today) setTodayLogs((prev) => [...prev, created]);
      setSelectedFoodId(null);
      setQty(1);
      setSearch("");
      setManualName("");
      setManualKcal("");
      setManualProtein("");
      setManualCarbs("");
      setManualFat("");
      setManualSugar("");
      setManualOpen(false);
      setView("diary");
      maybeAskRoutine(date, nextLogs);
      checkNutritionBadges();
    } catch {
      toast({ title: t("nutrition_error"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAddCatalog = (item: Diet) => {
    const q = qty > 0 ? qty : 1;
    addEntry({
      name: item.name,
      quantity: q,
      calories: item.calories != null ? item.calories * q : null,
      protein_g: item.protein_g != null ? item.protein_g * q : null,
      carbs_g: item.carbs_g != null ? item.carbs_g * q : null,
      fat_g: item.fat_g != null ? item.fat_g * q : null,
      sugar_g: item.sugar_g != null ? item.sugar_g * q : null,
      diet_id: item.id,
    });
  };

  const handleAddRecent = (item: RecentFood) => {
    addEntry({
      name: item.name,
      quantity: 1,
      calories: item.calories,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
      sugar_g: item.sugar_g,
      diet_id: item.diet_id,
    });
  };

  const handleAddManual = async () => {
    const kcal = parseFloat(manualKcal.replace(",", "."));
    if (!manualName.trim() || !Number.isFinite(kcal) || kcal < 0) return;
    const num = (s: string) => {
      const v = parseFloat(s.replace(",", "."));
      return Number.isFinite(v) && v >= 0 ? v : null;
    };
    const name = manualName.trim();
    const macros = {
      calories: kcal,
      protein_g: num(manualProtein),
      carbs_g: num(manualCarbs),
      fat_g: num(manualFat),
      // Em branco → null (desconhecido), NÃO zero: a insígnia "sem açúcar" exige
      // o valor preenchido para poder provar o dia.
      sugar_g: num(manualSugar),
    };

    // O alimento manual também entra no catálogo do usuário (`diets`, marcado
    // como criado por ele) para poder ser buscado e reaproveitado depois — sem
    // isso ele só existia como texto solto na entrada do dia. Quantidade é 1,
    // então os totais digitados JÁ são os valores por porção.
    setSaving(true);
    let dietId: string | null = null;
    const mine = (catalog ?? []).find(
      (d) => d.created_by_user && d.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (mine) {
      dietId = mine.id;
    } else {
      try {
        const created = await createCustomDietDb(
          name, "", null,
          macros.calories, macros.protein_g, macros.carbs_g, macros.fat_g,
          null, null, macros.sugar_g,
        );
        dietId = created.id;
        setCatalog((prev) => (prev ? [created, ...prev] : [created]));
      } catch {
        // Catálogo é bônus: falhar ao cadastrar o alimento não pode impedir o
        // registro do dia, que é o que o usuário pediu.
      }
    }

    await addEntry({ name, quantity: 1, ...macros, diet_id: dietId });
  };

  const handleDelete = async (id: string) => {
    const prevLogs = logs;
    const prevToday = todayLogs;
    setLogs((p) => p.filter((l) => l.id !== id));
    setTodayLogs((p) => p.filter((l) => l.id !== id));
    try {
      await deleteFoodLogDb(id);
    } catch {
      setLogs(prevLogs);
      setTodayLogs(prevToday);
      toast({ title: t("nutrition_error"), variant: "destructive" });
    }
  };

  const handleSaveGoal = async () => {
    const num = (s: string) => {
      const v = parseFloat(s.replace(",", "."));
      return Number.isFinite(v) && v > 0 ? v : null;
    };
    // Usuário grátis só edita kcal e água — as metas de macro existentes são
    // preservadas (nunca sobrescrever com null o que ele configurou quando
    // era premium ou antes do gate existir).
    const next: NutritionGoals = {
      calories_target: num(goalKcal),
      protein_target_g: isPremium ? num(goalProtein) : (goals?.protein_target_g ?? null),
      carbs_target_g: isPremium ? num(goalCarbs) : (goals?.carbs_target_g ?? null),
      fat_target_g: isPremium ? num(goalFat) : (goals?.fat_target_g ?? null),
      water_target_ml: num(goalWater),
    };
    setSaving(true);
    try {
      await upsertNutritionGoalsDb(next);
      setGoals(next);
      setView("diary");
    } catch {
      toast({ title: t("nutrition_error"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTransform = async () => {
    if (todayLogs.length === 0 || transforming) return;
    setTransforming(true);
    try {
      const ok = await onTransform(todayLogs);
      if (ok) setRoutinePrompt(false);
    } finally {
      setTransforming(false);
    }
  };

  const dismissPrompt = () => {
    askedThisSessionRef.current = true;
    setRoutinePrompt(false);
  };

  const neverAskAgain = () => {
    try {
      localStorage.setItem(ASK_ROUTINE_KEY, "never");
    } catch {}
    dismissPrompt();
  };

  const dateLabel = (d: string): string => {
    if (d === today) return t("nutrition_today");
    if (d === localDateISO(-1)) return t("nutrition_yesterday");
    const [, m, day] = d.split("-").map(Number);
    const months = MONTHS[language] ?? MONTHS.pt;
    return `${day} ${months[(m ?? 1) - 1] ?? ""}`;
  };

  const shiftDate = (delta: number) => {
    const cur = new Date(date + "T12:00:00");
    const next = new Date(cur.getTime() + delta * 86400000);
    const iso = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
    if (iso > today) return;
    setDate(iso);
  };

  const mealLabel = (m: FoodLogMealType) =>
    t(m === 0 ? "nutrition_meal_0" : m === 1 ? "nutrition_meal_1" : m === 2 ? "nutrition_meal_2" : "nutrition_meal_3");

  const filteredCatalog = React.useMemo(() => {
    if (catalog == null) return null;
    const q = normalize(search.trim());
    const rows = q ? catalog.filter((c) => normalize(c.name).includes(q)) : catalog;
    return rows.slice(0, 30);
  }, [catalog, search]);

  const trendPoints = dayTotals.map((d) => ({ label: dateLabel(d.date), value: d.calories }));

  // Busca, registro manual e metas vivem no fundo deste scroll único — sem
  // assistência, o iOS deixava esses campos atrás do teclado. Ver hook.
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  useKeyboardInputScroll(scrollRef, open);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} handleOnly>
      <DrawerContent {...GLASS_SHEET_PROPS} handleOnly style={GLASS_SHEET_STYLE}>
        <div
          ref={scrollRef}
          className="flex flex-col px-5 pt-2 overflow-y-auto"
          style={{ paddingBottom: "calc(max(24px, env(safe-area-inset-bottom)) + var(--keyboard-height, 0px))" }}
        >
          {/* ── Vista: diário do dia ── */}
          {view === "diary" && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-white text-lg font-bold">{t("nutrition_diary_title")}</h2>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => shiftDate(-1)}
                    className="p-2 text-white/60"
                    aria-label={t("nutrition_prev_day")}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-white/80 tabular-nums" style={{ fontSize: "13px", fontWeight: 600, minWidth: "48px", textAlign: "center" }}>
                    {dateLabel(date)}
                  </span>
                  <button
                    onClick={() => shiftDate(1)}
                    disabled={date === today}
                    className="p-2 text-white/60 disabled:opacity-30"
                    aria-label={t("nutrition_next_day")}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Prompt: transformar o diário em rotina diária */}
              {routinePrompt && !hasDietRoutines && (
                <div
                  className="mt-3 rounded-2xl p-4"
                  style={{
                    background: "rgba(61,220,132,.1)",
                    border: "1px solid rgba(61,220,132,.3)",
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="h-4 w-4 mt-0.5 shrink-0" style={{ color: ACCENT }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-semibold" style={{ fontSize: "13.5px" }}>
                        {t("nutrition_transform_prompt_title")}
                      </div>
                      <p className="mt-0.5" style={{ fontSize: "12px", color: "rgba(255,255,255,.6)" }}>
                        {t("nutrition_transform_prompt_desc")}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={handleTransform}
                      disabled={transforming}
                      className="flex-1 rounded-xl py-2 text-sm font-semibold disabled:opacity-50"
                      style={GLASS_PRIMARY_BTN_STYLE}
                    >
                      {t("nutrition_transform_confirm")}
                    </button>
                    <button
                      onClick={dismissPrompt}
                      className="flex-1 rounded-xl py-2 text-sm font-medium text-white/70"
                      style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)" }}
                    >
                      {t("nutrition_transform_later")}
                    </button>
                  </div>
                  <button
                    onClick={neverAskAgain}
                    className="mt-2 w-full text-center"
                    style={{ fontSize: "11.5px", color: "rgba(255,255,255,.45)", textDecoration: "underline" }}
                  >
                    {t("nutrition_transform_never")}
                  </button>
                </div>
              )}

              {/* Resumo do dia */}
              <div className="mt-3 rounded-2xl p-4" style={GLASS_PANEL_STYLE}>
                <div className="flex items-end justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-white tabular-nums" style={{ fontSize: "30px", fontWeight: 780, lineHeight: 1 }}>
                      {fmtKcal(dayKcal)}
                    </span>
                    <span className="text-white/50" style={{ fontSize: "13px" }}>
                      {target != null
                        ? t("nutrition_of_goal").replace("{n}", fmtKcal(target))
                        : t("nutrition_kcal_unit")}
                    </span>
                  </div>
                  <button onClick={openGoal} className="flex items-center gap-1 text-white/55" style={{ fontSize: "12px" }}>
                    <Pencil className="h-3 w-3" />
                    {target != null ? t("nutrition_goal_edit") : t("nutrition_no_goal_hint")}
                  </button>
                </div>
                {target != null && target > 0 && (
                  <div className="mt-2.5 h-2 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.1)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (dayKcal / target) * 100)}%`,
                        background:
                          dayKcal > target
                            ? "linear-gradient(90deg,#ff8a2a,#ff5f6d)"
                            : `linear-gradient(90deg,#2fbf71,${ACCENT})`,
                      }}
                    />
                  </div>
                )}
                {target != null && dayKcal <= target && (
                  <div className="mt-1.5 tabular-nums" style={{ fontSize: "11.5px", color: "rgba(255,255,255,.5)" }}>
                    {t("nutrition_remaining").replace("{n}", fmtKcal(target - dayKcal))}
                  </div>
                )}
                {(() => {
                  const daySugar = sum(logs, "sugar_g");
                  const line = [
                    { label: t("nutrition_protein_short"), v: sum(logs, "protein_g"), tgt: goals?.protein_target_g },
                    { label: t("nutrition_carbs_short"), v: sum(logs, "carbs_g"), tgt: goals?.carbs_target_g },
                    { label: t("nutrition_fat_short"), v: sum(logs, "fat_g"), tgt: goals?.fat_target_g },
                  ];
                  // Açúcar só aparece quando há o dado — sem valor, um "0 g" mentiria.
                  if (daySugar > 0) {
                    line.push({ label: t("nutrition_sugar_short"), v: daySugar, tgt: null });
                  }
                  if (line.every((x) => x.v <= 0 && x.tgt == null)) return null;
                  return (
                    <PremiumGate feature="macros" className="mt-3">
                      <div
                        className="grid gap-2"
                        style={{ gridTemplateColumns: `repeat(${line.length}, minmax(0, 1fr))` }}
                      >
                        {line.map((x) => (
                          <div key={x.label} className="rounded-xl px-2 py-2 text-center" style={{ background: "rgba(255,255,255,.05)" }}>
                            <div className="text-white tabular-nums font-semibold" style={{ fontSize: "13px" }}>
                              {fmtKcal(x.v)}
                              {x.tgt != null ? `/${fmtKcal(x.tgt)}` : ""}g
                            </div>
                            <div style={{ fontSize: "10.5px", color: "rgba(255,255,255,.45)" }}>{x.label}</div>
                          </div>
                        ))}
                      </div>
                    </PremiumGate>
                  );
                })()}
              </div>

              {/* Água do dia — alimenta a insígnia de hidratação */}
              <div className="mt-3 rounded-2xl p-4" style={GLASS_PANEL_STYLE}>
                <div className="flex items-end justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <span style={{ fontSize: "15px" }}>💧</span>
                    <span className="text-white tabular-nums" style={{ fontSize: "22px", fontWeight: 760, lineHeight: 1 }}>
                      {fmtKcal(water)}
                    </span>
                    <span className="text-white/50" style={{ fontSize: "12.5px" }}>
                      {t("nutrition_water_of_goal").replace("{n}", fmtKcal(waterTarget))}
                    </span>
                  </div>
                  {water > 0 && (
                    <button
                      onClick={() => changeWater(-WATER_STEPS_ML[0])}
                      className="flex items-center gap-1 text-white/55"
                      style={{ fontSize: "12px" }}
                    >
                      <Minus className="h-3 w-3" />
                      {t("nutrition_water_undo")}
                    </button>
                  )}
                </div>

                <div className="mt-2.5 h-2 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.1)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, waterTarget > 0 ? (water / waterTarget) * 100 : 0)}%`,
                      background: `linear-gradient(90deg,#2f7fd6,${WATER_ACCENT})`,
                    }}
                  />
                </div>

                <div className="mt-3 flex gap-2">
                  {WATER_STEPS_ML.map((ml) => (
                    <button
                      key={ml}
                      onClick={() => changeWater(ml)}
                      className="flex-1 rounded-xl py-2 font-semibold"
                      style={{
                        fontSize: "12.5px",
                        color: "#fff",
                        background: "rgba(74,168,255,.14)",
                        border: "1px solid rgba(74,168,255,.32)",
                      }}
                    >
                      + {ml} {t("nutrition_water_unit")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rotina de dieta: acesso (quando existe) ou transformar (quando não) */}
              {hasDietRoutines ? (
                <button
                  onClick={onOpenRoutines}
                  className="mt-3 flex items-center justify-between rounded-2xl px-4 py-3"
                  style={GLASS_PANEL_STYLE}
                >
                  <span className="flex items-center gap-2 text-white font-semibold" style={{ fontSize: "13.5px" }}>
                    <CalendarCheck className="h-4 w-4" style={{ color: ACCENT }} />
                    {t("nutrition_my_routine")}
                  </span>
                  <ChevronRight className="h-4 w-4 text-white/40" />
                </button>
              ) : (
                date === today &&
                todayLogs.length > 0 &&
                !routinePrompt && (
                  <button
                    onClick={handleTransform}
                    disabled={transforming}
                    className="mt-3 flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-semibold disabled:opacity-50"
                    style={{
                      fontSize: "13.5px",
                      color: "#fff",
                      background: "rgba(61,220,132,.12)",
                      border: "1px solid rgba(61,220,132,.32)",
                    }}
                  >
                    <Sparkles className="h-4 w-4" style={{ color: ACCENT }} />
                    {t("nutrition_transform_cta")}
                  </button>
                )
              )}

              {/* Refeições */}
              {MEAL_TYPES.map((meal) => {
                const rows = logs.filter((l) => l.meal_type === meal);
                const mealKcal = sum(rows, "calories");
                return (
                  <div key={meal} className="mt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span style={{ fontSize: "14px" }}>{MEAL_EMOJI[meal]}</span>
                        <span className="text-white font-semibold" style={{ fontSize: "13.5px" }}>
                          {mealLabel(meal)}
                        </span>
                        {mealKcal > 0 && (
                          <span className="tabular-nums" style={{ fontSize: "11.5px", color: "rgba(255,255,255,.45)" }}>
                            · {fmtKcal(mealKcal)} {t("nutrition_kcal_unit")}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => openAdd(meal)}
                        className="flex items-center justify-center rounded-full"
                        style={{
                          width: "26px",
                          height: "26px",
                          background: "rgba(61,220,132,.14)",
                          border: "1px solid rgba(61,220,132,.3)",
                        }}
                        aria-label={t("nutrition_add_food")}
                      >
                        <Plus className="h-3.5 w-3.5" style={{ color: ACCENT }} />
                      </button>
                    </div>

                    {rows.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1.5">
                        {rows.map((l) => (
                          <div key={l.id} className="flex items-center justify-between rounded-xl px-3 py-2.5" style={GLASS_PANEL_STYLE}>
                            <div className="min-w-0 flex-1">
                              <div className="text-white truncate" style={{ fontSize: "13.5px" }}>
                                {l.name}
                                {l.quantity !== 1 && (
                                  <span className="tabular-nums" style={{ color: "rgba(255,255,255,.5)" }}>
                                    {" "}
                                    × {fmtQty(l.quantity, language)}
                                  </span>
                                )}
                              </div>
                              {l.user_diet_id != null && (
                                <span
                                  className="inline-block mt-0.5 rounded-full px-1.5"
                                  style={{
                                    fontSize: "9.5px",
                                    color: "rgba(255,255,255,.55)",
                                    background: "rgba(255,255,255,.08)",
                                    border: "1px solid rgba(255,255,255,.1)",
                                  }}
                                >
                                  {t("nutrition_from_routine")}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 shrink-0 ml-2">
                              <span className="text-white tabular-nums font-semibold" style={{ fontSize: "13px" }}>
                                {l.calories != null ? `${fmtKcal(l.calories)} ${t("nutrition_kcal_unit")}` : "—"}
                              </span>
                              <button
                                onClick={() => handleDelete(l.id)}
                                className="text-white/40 hover:text-red-400 transition-colors"
                                aria-label={t("nutrition_delete")}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {logs.length === 0 && (
                <p className="mt-4 text-sm text-white/50 text-center">{t("nutrition_empty_day")}</p>
              )}

              {/* Tendência dos últimos 7 dias */}
              {trendPoints.length >= 2 && (
                <div className="mt-6">
                  <div className="text-white/50 mb-2" style={{ fontSize: "12px", fontWeight: 600 }}>
                    {t("nutrition_trend_title")}
                  </div>
                  <div className="rounded-2xl p-3" style={GLASS_PANEL_STYLE}>
                    <TrendChart points={trendPoints} color={ACCENT} height={120} />
                    <div className="mt-1 flex justify-between px-1">
                      <span className="text-white/35" style={{ fontSize: "10.5px" }}>{trendPoints[0]?.label}</span>
                      <span className="text-white/35" style={{ fontSize: "10.5px" }}>
                        {trendPoints[trendPoints.length - 1]?.label}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Vista: adicionar alimento ── */}
          {view === "add" && (
            <>
              <div className="flex items-center gap-2">
                <button onClick={() => setView("diary")} className="p-1 -ml-1 text-white/70" aria-label={t("nutrition_back")}>
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-white text-lg font-bold">{t("nutrition_add_food")}</h2>
              </div>

              {/* Refeição de destino */}
              <div className="mt-3 flex gap-1.5">
                {MEAL_TYPES.map((meal) => (
                  <button
                    key={meal}
                    onClick={() => setAddMeal(meal)}
                    className="flex-1 rounded-xl py-2 text-center transition-colors"
                    style={{
                      fontSize: "11.5px",
                      fontWeight: 600,
                      color: addMeal === meal ? "#fff" : "rgba(255,255,255,.55)",
                      background: addMeal === meal ? "rgba(61,220,132,.16)" : "rgba(255,255,255,.06)",
                      border: addMeal === meal ? "1px solid rgba(61,220,132,.4)" : "1px solid rgba(255,255,255,.1)",
                    }}
                  >
                    <div style={{ fontSize: "14px" }}>{MEAL_EMOJI[meal]}</div>
                    {mealLabel(meal)}
                  </button>
                ))}
              </div>

              {/* Busca */}
              <div className="mt-3 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("nutrition_search_placeholder")}
                  className="w-full rounded-xl pl-9 pr-3 py-2.5 text-white placeholder:text-white/35 outline-none"
                  style={FIELD_STYLE}
                />
              </div>

              {/* Recentes — repetir com 1 toque */}
              {recents.length > 0 && !search.trim() && (
                <div className="mt-3">
                  <div className="text-white/50 mb-1.5" style={{ fontSize: "11.5px", fontWeight: 600 }}>
                    {t("nutrition_recent")}
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                    {recents.map((r, i) => (
                      <button
                        key={`${r.name}-${i}`}
                        onClick={() => handleAddRecent(r)}
                        disabled={saving}
                        className="shrink-0 rounded-full px-3 py-1.5 disabled:opacity-50"
                        style={{
                          fontSize: "12px",
                          color: "rgba(255,255,255,.85)",
                          background: "rgba(255,255,255,.07)",
                          border: "1px solid rgba(255,255,255,.12)",
                        }}
                      >
                        {r.name}
                        {r.calories != null && (
                          <span className="tabular-nums" style={{ color: "rgba(255,255,255,.45)" }}>
                            {" "}
                            · {fmtKcal(r.calories)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Catálogo */}
              <div className="mt-3 flex flex-col gap-1.5">
                {filteredCatalog == null ? (
                  <p className="text-sm text-white/50 text-center py-4">{t("nutrition_loading")}</p>
                ) : filteredCatalog.length === 0 ? (
                  <p className="text-sm text-white/50 text-center py-4">{t("nutrition_no_results")}</p>
                ) : (
                  filteredCatalog.map((item) => {
                    const selected = selectedFoodId === item.id;
                    return (
                      <div key={item.id} className="rounded-xl overflow-hidden" style={GLASS_PANEL_STYLE}>
                        <button
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                          onClick={() => {
                            setSelectedFoodId(selected ? null : item.id);
                            setQty(1);
                          }}
                        >
                          <DietImage photo={item.photo} name={item.name} category={item.category} className="h-11 w-11" />
                          <div className="flex-1 min-w-0">
                            <div className="text-white truncate" style={{ fontSize: "13.5px" }}>{item.name}</div>
                            <div className="tabular-nums" style={{ fontSize: "11.5px", color: "rgba(255,255,255,.5)" }}>
                              {item.calories != null
                                ? `${fmtKcal(item.calories)} ${t("nutrition_kcal_unit")} · ${t("nutrition_per_portion")}`
                                : item.category ?? ""}
                            </div>
                          </div>
                          <Plus
                            className="h-4 w-4 shrink-0 transition-transform"
                            style={{ color: ACCENT, transform: selected ? "rotate(45deg)" : "none" }}
                          />
                        </button>

                        {selected && (
                          <div className="flex items-center gap-3 px-3 pb-3">
                            <div
                              className="flex items-center gap-3 rounded-xl px-2 py-1.5"
                              style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}
                            >
                              <button
                                onClick={() => setQty((q) => Math.max(0.5, Math.round((q - 0.5) * 10) / 10))}
                                className="text-white/70 p-0.5"
                                aria-label="−"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="text-white tabular-nums" style={{ fontSize: "13px", fontWeight: 600, minWidth: "34px", textAlign: "center" }}>
                                {fmtQty(qty, language)} {t("nutrition_portion_short")}
                              </span>
                              <button
                                onClick={() => setQty((q) => Math.min(10, Math.round((q + 0.5) * 10) / 10))}
                                className="text-white/70 p-0.5"
                                aria-label="+"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <button
                              onClick={() => handleAddCatalog(item)}
                              disabled={saving}
                              className="flex-1 rounded-xl py-2 text-sm font-semibold disabled:opacity-50"
                              style={GLASS_PRIMARY_BTN_STYLE}
                            >
                              {item.calories != null
                                ? `${t("nutrition_add_confirm")} · ${fmtKcal(item.calories * qty)} ${t("nutrition_kcal_unit")}`
                                : t("nutrition_add_confirm")}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Registro manual — "comi um pastel, ~300 kcal" */}
              <div className="mt-4">
                {!manualOpen ? (
                  <button
                    onClick={() => {
                      setManualOpen(true);
                      if (search.trim()) setManualName(search.trim());
                    }}
                    className="w-full rounded-xl py-2.5 text-sm font-medium text-white/70"
                    style={{ border: "1px dashed rgba(255,255,255,.25)" }}
                  >
                    + {t("nutrition_manual_entry")}
                  </button>
                ) : (
                  <div className="rounded-2xl p-3 flex flex-col gap-2" style={GLASS_PANEL_STYLE}>
                    <div className="text-white font-semibold" style={{ fontSize: "13px" }}>
                      {t("nutrition_manual_entry")}
                    </div>
                    <input
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder={t("nutrition_manual_name_placeholder")}
                      className="w-full rounded-xl px-3 py-2.5 text-white placeholder:text-white/35 outline-none"
                      style={FIELD_STYLE}
                    />
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={manualKcal}
                        onChange={(e) => setManualKcal(e.target.value)}
                        placeholder={t("nutrition_manual_kcal_placeholder")}
                        className="w-full rounded-xl px-3 py-2.5 text-white placeholder:text-white/35 outline-none"
                        style={FIELD_STYLE}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" style={{ fontSize: "12px" }}>
                        {t("nutrition_kcal_unit")}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { v: manualProtein, set: setManualProtein, ph: t("nutrition_protein_short") },
                        { v: manualCarbs, set: setManualCarbs, ph: t("nutrition_carbs_short") },
                        { v: manualFat, set: setManualFat, ph: t("nutrition_fat_short") },
                        { v: manualSugar, set: setManualSugar, ph: t("nutrition_sugar_short") },
                      ].map((f, i) => (
                        <div key={i} className="relative">
                          <input
                            type="number"
                            inputMode="decimal"
                            value={f.v}
                            onChange={(e) => f.set(e.target.value)}
                            placeholder={f.ph}
                            className="w-full rounded-xl px-2.5 py-2 text-white placeholder:text-white/35 outline-none"
                            style={{ ...FIELD_STYLE, fontSize: "12.5px" }}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-white/35" style={{ fontSize: "11px" }}>
                            g
                          </span>
                        </div>
                      ))}
                    </div>
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,.45)", lineHeight: 1.4 }}>
                      {t("nutrition_manual_sugar_hint")}
                    </p>
                    <button
                      onClick={handleAddManual}
                      disabled={saving || !manualName.trim() || !manualKcal.trim()}
                      className="rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
                      style={GLASS_PRIMARY_BTN_STYLE}
                    >
                      {t("nutrition_add_confirm")}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Vista: meta diária ── */}
          {view === "goal" && (
            <>
              <div className="flex items-center gap-2">
                <button onClick={() => setView("diary")} className="p-1 -ml-1 text-white/70" aria-label={t("nutrition_back")}>
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-white text-lg font-bold">{t("nutrition_goal_title")}</h2>
              </div>

              <p className="mt-2 text-sm text-white/55">{t("nutrition_goal_hint")}</p>

              <div className="mt-4 flex flex-col gap-2.5">
                {(() => {
                  const renderField = (f: { v: string; set: (v: string) => void; label: string; unit: string }, key: string) => (
                    <div key={key}>
                      <label className="text-white/70 block mb-1" style={{ fontSize: "12px", fontWeight: 600 }}>
                        {f.label}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={f.v}
                          onChange={(e) => f.set(e.target.value)}
                          className="w-full rounded-xl px-3 py-2.5 text-white placeholder:text-white/35 outline-none"
                          style={FIELD_STYLE}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" style={{ fontSize: "12px" }}>
                          {f.unit}
                        </span>
                      </div>
                    </div>
                  );
                  const macroFields = [
                    { v: goalProtein, set: setGoalProtein, label: t("nutrition_goal_protein"), unit: "g" },
                    { v: goalCarbs, set: setGoalCarbs, label: t("nutrition_goal_carbs"), unit: "g" },
                    { v: goalFat, set: setGoalFat, label: t("nutrition_goal_fat"), unit: "g" },
                  ];
                  return (
                    <>
                      {renderField({ v: goalKcal, set: setGoalKcal, label: t("nutrition_goal_kcal"), unit: t("nutrition_kcal_unit") }, "kcal")}
                      {/* Metas de macro são premium; kcal e água continuam grátis */}
                      <PremiumGate feature="macros">
                        <div className="flex flex-col gap-2.5">
                          {macroFields.map((f, i) => renderField(f, `macro-${i}`))}
                        </div>
                      </PremiumGate>
                      {renderField({ v: goalWater, set: setGoalWater, label: t("nutrition_goal_water"), unit: t("nutrition_water_unit") }, "water")}
                    </>
                  );
                })()}
              </div>

              <button
                onClick={handleSaveGoal}
                disabled={saving}
                className="mt-4 rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
                style={GLASS_PRIMARY_BTN_STYLE}
              >
                {t("nutrition_goal_save")}
              </button>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
