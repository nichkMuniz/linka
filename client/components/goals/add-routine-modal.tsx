import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  SlidersHorizontal,
  Plus,
  ArrowLeft,
  X,
  Check,
  Pencil,
  Info,
} from "lucide-react";
import { ExerciseImage } from "@/components/shared/exercise-image";
import { DietImage } from "@/components/shared/diet-image";
import { CreateWorkoutDrawer } from "@/components/goals/create-workout-drawer";
import { useLanguage } from "@/lib/language-context";
import { toast } from "@/components/ui/use-toast";
import {
  createCustomWorkoutDb,
  type Workout,
  type Diet,
  type Habit,
  type UserWorkoutWithDetails,
  type UserDietWithDetails,
} from "@/lib/ritmofit-db";

export interface UnifiedExercise {
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
}

interface AddRoutineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAddingFromWorkout: boolean;
  onIsAddingFromWorkoutChange: (v: boolean) => void;

  selectedRoutineType: number | null;
  onSelectedRoutineTypeChange: (type: number | null) => void;

  selectedItems: Set<string>;
  onSelectedItemsChange: (items: Set<string>) => void;

  routineName: string;
  onRoutineNameChange: (name: string) => void;

  addToRoutineCardName: string | null;

  searchQuery: string;
  onSearchQueryChange: (q: string) => void;

  selectedMuscleGroups: Set<string>;
  onSelectedMuscleGroupsChange: (groups: Set<string>) => void;

  selectedWorkoutType: number | null;
  onSelectedWorkoutTypeChange: (type: number | null) => void;

  selectedDietCategories: Set<string>;
  onSelectedDietCategoriesChange: (cats: Set<string>) => void;

  showMuscleFilterPanel: boolean;
  onShowMuscleFilterPanelChange: (v: boolean) => void;

  filteredWorkouts: UnifiedExercise[];
  filteredDiets: Diet[];
  habits: Habit[];
  uniqueMuscleGroups: string[];
  uniqueDietCategories: string[];

  userWorkouts: UserWorkoutWithDetails[];
  userDiets: UserDietWithDetails[];
  userHabits: any[];

  imageZoom: import("@/components/shared/image-zoom-drawer").ImageZoomItem | null;
  onImageZoomChange: (
    v: import("@/components/shared/image-zoom-drawer").ImageZoomItem | null,
  ) => void;

  /** Called when user taps "Próximo" with ≥1 item selected */
  onNext: () => void;

  onWorkoutCreated: (workout: Workout) => void;
}

const ROUTINE_TYPES = [
  { code: 1, bgClass: "bg-orange-500/10 border-orange-500/30", textClass: "text-orange-500" },
  { code: 2, bgClass: "bg-green-500/10 border-green-500/30", textClass: "text-green-500" },
  { code: 3, bgClass: "bg-purple-500/10 border-purple-500/30", textClass: "text-purple-500" },
];

export function AddRoutineModal({
  open,
  onOpenChange,
  isAddingFromWorkout,
  onIsAddingFromWorkoutChange,
  selectedRoutineType,
  onSelectedRoutineTypeChange,
  selectedItems,
  onSelectedItemsChange,
  routineName,
  onRoutineNameChange,
  addToRoutineCardName,
  searchQuery,
  onSearchQueryChange,
  selectedMuscleGroups,
  onSelectedMuscleGroupsChange,
  selectedWorkoutType,
  onSelectedWorkoutTypeChange,
  selectedDietCategories,
  onSelectedDietCategoriesChange,
  showMuscleFilterPanel,
  onShowMuscleFilterPanelChange,
  filteredWorkouts,
  filteredDiets,
  habits,
  uniqueMuscleGroups,
  uniqueDietCategories,
  userWorkouts,
  userDiets,
  userHabits,
  onImageZoomChange,
  onNext,
  onWorkoutCreated,
}: AddRoutineModalProps) {
  const { t } = useLanguage();
  const [createWorkoutDrawerOpen, setCreateWorkoutDrawerOpen] = React.useState(false);
  const nameInputRef = React.useRef<HTMLInputElement>(null);

  const isTypeSelected = selectedRoutineType !== null;

  const typeLabel =
    selectedRoutineType === 1
      ? t("goals_rt_exercises")
      : selectedRoutineType === 2
        ? t("goals_rt_diets")
        : selectedRoutineType === 3
          ? t("goals_rt_habits")
          : "";

  const handleClose = () => {
    onOpenChange(false);
    onIsAddingFromWorkoutChange(false);
  };

  const handleBack = () => {
    onSelectedRoutineTypeChange(null);
    onSelectedItemsChange(new Set());
    onSearchQueryChange("");
    onSelectedMuscleGroupsChange(new Set());
    onSelectedDietCategoriesChange(new Set());
  };

  const handleSelectItem = (itemId: string) => {
    const next = new Set(selectedItems);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    onSelectedItemsChange(next);
  };

  const handleToggleMuscleGroup = (mg: string) => {
    const next = new Set(selectedMuscleGroups);
    if (next.has(mg)) next.delete(mg);
    else next.add(mg);
    onSelectedMuscleGroupsChange(next);
  };

  const handleToggleDietCategory = (cat: string) => {
    const next = new Set(selectedDietCategories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    onSelectedDietCategoriesChange(next);
  };

  // ── Header center: static type label ──
  const renderHeaderCenter = () => {
    if (!isTypeSelected) {
      return <h1 className="text-base font-semibold truncate">{t("goals_add_routine_title")}</h1>;
    }
    if (addToRoutineCardName) {
      return (
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground leading-none mb-0.5">{typeLabel}</p>
          <h1 className="text-sm font-semibold truncate">{addToRoutineCardName}</h1>
        </div>
      );
    }
    return <h1 className="text-base font-semibold truncate">{typeLabel}</h1>;
  };

  return (
    <>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              key="routine-fullscreen"
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed inset-0 z-[200] bg-background flex flex-col"
              style={{
                paddingTop: "max(0px, env(safe-area-inset-top))",
                paddingLeft: "env(safe-area-inset-left)",
                paddingRight: "env(safe-area-inset-right)",
              }}
            >
              {/* ── Header ── */}
              <div className="shrink-0 flex items-center gap-2 px-3 py-3 border-b border-border/40">
                <button
                  onClick={isTypeSelected && !isAddingFromWorkout ? handleBack : handleClose}
                  className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-muted/60 transition-colors shrink-0"
                  aria-label={isTypeSelected && !isAddingFromWorkout ? t("goals_back") : "Fechar"}
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>

                <div className="flex-1 min-w-0 flex items-center">
                  {renderHeaderCenter()}
                </div>

                <button
                  onClick={handleClose}
                  className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-muted/60 transition-colors text-muted-foreground shrink-0"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* ── Body ── */}
              <AnimatePresence mode="wait">
                {!isTypeSelected ? (
                  /* ── Step 1: Type selection ── */
                  <motion.div
                    key="step-type"
                    initial={{ opacity: 0, x: -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.18 }}
                    className="flex-1 overflow-y-auto px-4 py-5 space-y-3"
                  >
                    <p className="text-sm text-muted-foreground">{t("goals_select_type")}</p>
                    {[
                      {
                        code: 1, label: t("goals_rt_exercises"), emoji: "🏋️",
                        desc: t("goals_rt_exercises_desc"),
                        bgClass: ROUTINE_TYPES[0].bgClass, textClass: ROUTINE_TYPES[0].textClass,
                      },
                      {
                        code: 2, label: t("goals_rt_diets"), emoji: "🥗",
                        desc: t("goals_rt_diets_desc"),
                        bgClass: ROUTINE_TYPES[1].bgClass, textClass: ROUTINE_TYPES[1].textClass,
                      },
                      {
                        code: 3, label: t("goals_rt_habits"), emoji: "✨",
                        desc: t("goals_rt_habits_desc"),
                        bgClass: ROUTINE_TYPES[2].bgClass, textClass: ROUTINE_TYPES[2].textClass,
                      },
                    ].map(({ code, label, emoji, desc, bgClass, textClass }) => (
                      <button
                        key={code}
                        onClick={() => { onSelectedRoutineTypeChange(code); onSearchQueryChange(""); }}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left min-h-[72px] ${bgClass} active:scale-[0.98]`}
                      >
                        <span className="text-3xl leading-none">{emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm ${textClass}`}>{label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{desc}</p>
                        </div>
                        <ArrowLeft className="h-4 w-4 text-muted-foreground rotate-180 shrink-0" />
                      </button>
                    ))}
                  </motion.div>
                ) : (
                  /* ── Step 2: Filters + Grid/List ── */
                  <motion.div
                    key="step-items"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 24 }}
                    transition={{ duration: 0.18 }}
                    className="flex-1 flex flex-col overflow-hidden"
                  >
                    {/* ── Name field — hidden when adding from an active workout session ── */}
                  {!addToRoutineCardName && !isAddingFromWorkout && (
                    <div className="shrink-0 px-4 pt-3 pb-1">
                      <div className="relative">
                        <label
                          htmlFor="routine-name-input"
                          className="absolute -top-2 left-3 px-1 text-[11px] font-medium text-brand bg-background z-10 leading-none"
                        >
                          {t("goals_routine_name_label")}
                        </label>
                        <div className="flex items-center gap-2 rounded-xl border-2 border-brand/40 focus-within:border-brand bg-background transition-colors px-3 h-12">
                          <Pencil className="h-4 w-4 text-brand/60 shrink-0" />
                          <input
                            id="routine-name-input"
                            ref={nameInputRef}
                            type="text"
                            value={routineName}
                            onChange={(e) => onRoutineNameChange(e.target.value)}
                            placeholder={
                              selectedRoutineType === 2
                                ? t("goals_routine_name_placeholder_diets")
                                : selectedRoutineType === 3
                                  ? t("goals_routine_name_placeholder_habits")
                                  : t("goals_routine_name_placeholder_exercises")
                            }
                            className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/50 min-w-0"
                            style={{ fontSize: "16px" }}
                            autoComplete="off"
                          />
                          {routineName && (
                            <button
                              onMouseDown={(e) => { e.preventDefault(); onRoutineNameChange(""); }}
                              className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                              aria-label="Limpar nome"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Unified filter bar ── */}
                    {(() => {
                      const activeFilterCount =
                        (selectedRoutineType === 1
                          ? (selectedWorkoutType !== null ? 1 : 0) + selectedMuscleGroups.size
                          : selectedRoutineType === 2
                            ? selectedDietCategories.size
                            : 0);
                      const hasSubFilters = selectedRoutineType === 1 || selectedRoutineType === 2;

                      return (
                        <div className="shrink-0 px-4 pt-2 pb-2 border-b border-border/30 space-y-2">
                          {/* Row: search + filter toggle */}
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                              <Input
                                type="text"
                                placeholder={
                                  selectedRoutineType === 1 ? t("goals_search_exercise")
                                    : selectedRoutineType === 2 ? t("goals_search_diet")
                                      : t("goals_search_habit")
                                }
                                value={searchQuery}
                                onChange={(e) => onSearchQueryChange(e.target.value)}
                                className="pl-10 h-10 rounded-xl"
                              />
                            </div>

                            {hasSubFilters && (
                              <button
                                type="button"
                                onClick={() => onShowMuscleFilterPanelChange(!showMuscleFilterPanel)}
                                className={`relative flex items-center justify-center w-10 h-10 rounded-xl border transition-all shrink-0 ${
                                  showMuscleFilterPanel || activeFilterCount > 0
                                    ? "border-brand bg-brand/10 text-brand"
                                    : "border-border/50 text-muted-foreground hover:border-brand/40"
                                }`}
                                aria-label="Filtros"
                              >
                                <SlidersHorizontal className="h-4 w-4" />
                                {activeFilterCount > 0 && (
                                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-white text-[9px] font-bold leading-none">
                                    {activeFilterCount}
                                  </span>
                                )}
                              </button>
                            )}
                          </div>

                          {/* Expandable filter panel */}
                          <AnimatePresence>
                            {showMuscleFilterPanel && hasSubFilters && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: "easeInOut" }}
                                className="overflow-hidden"
                              >
                                <div className="pt-1 pb-0.5 space-y-3">
                                  {/* Workout type pills */}
                                  {selectedRoutineType === 1 && (
                                    <div className="space-y-1.5">
                                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                                        {t("goals_type_label")}
                                      </p>
                                      <div className="flex gap-2">
                                        {[
                                          { value: null, label: t("goals_all") },
                                          { value: 1, label: t("goals_gym") },
                                          { value: 2, label: t("goals_home") },
                                        ].map((opt) => (
                                          <button
                                            key={String(opt.value)}
                                            type="button"
                                            onClick={() => onSelectedWorkoutTypeChange(opt.value)}
                                            className={`text-xs px-3 py-1.5 rounded-full border transition-all min-h-[32px] ${
                                              selectedWorkoutType === opt.value
                                                ? "border-brand bg-brand/15 text-brand font-medium"
                                                : "border-border/50 text-muted-foreground"
                                            }`}
                                          >
                                            {opt.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Muscle groups */}
                                  {selectedRoutineType === 1 && uniqueMuscleGroups.length > 0 && (
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                                          {t("goals_muscle_group")}
                                        </p>
                                        {selectedMuscleGroups.size > 0 && (
                                          <button
                                            onClick={() => onSelectedMuscleGroupsChange(new Set())}
                                            className="text-xs text-brand"
                                          >
                                            {t("goals_clear")}
                                          </button>
                                        )}
                                      </div>
                                      <div className="grid grid-cols-4 gap-1.5">
                                        {uniqueMuscleGroups.map((mg) => (
                                          <button
                                            key={mg}
                                            onClick={() => handleToggleMuscleGroup(mg)}
                                            className={`flex items-center justify-center py-2 px-1 rounded-xl border text-center transition-all min-h-[36px] ${
                                              selectedMuscleGroups.has(mg)
                                                ? "border-brand bg-brand/15 text-brand"
                                                : "border-border/50 text-muted-foreground"
                                            }`}
                                          >
                                            <span className="text-[10px] font-medium leading-tight">{mg}</span>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Diet categories */}
                                  {selectedRoutineType === 2 && (
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                                          {t("goals_category")}
                                        </p>
                                        {selectedDietCategories.size > 0 && (
                                          <button
                                            onClick={() => onSelectedDietCategoriesChange(new Set())}
                                            className="text-xs text-brand"
                                          >
                                            {t("goals_clear")}
                                          </button>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {uniqueDietCategories.length === 0
                                          ? <p className="text-xs text-muted-foreground">{t("goals_categories_loading")}</p>
                                          : uniqueDietCategories.map((cat) => (
                                            <button
                                              key={cat}
                                              onClick={() => handleToggleDietCategory(cat)}
                                              className={`px-3 py-1.5 text-xs rounded-full border transition-all min-h-[32px] ${
                                                selectedDietCategories.has(cat)
                                                  ? "border-brand bg-brand/20 text-brand"
                                                  : "border-border/60 text-muted-foreground"
                                              }`}
                                            >
                                              {cat}
                                            </button>
                                          ))
                                        }
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Active filter chips (visible when panel is collapsed) */}
                          {!showMuscleFilterPanel && activeFilterCount > 0 && (
                            <div className="flex gap-1.5 flex-wrap">
                              {selectedWorkoutType !== null && (
                                <button
                                  onClick={() => onSelectedWorkoutTypeChange(null)}
                                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-brand/15 text-brand border border-brand/30"
                                >
                                  {selectedWorkoutType === 1 ? t("goals_gym") : t("goals_home")}
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                              {Array.from(selectedMuscleGroups).map((mg) => (
                                <button
                                  key={mg}
                                  onClick={() => handleToggleMuscleGroup(mg)}
                                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-brand/15 text-brand border border-brand/30"
                                >
                                  {mg}
                                  <X className="h-3 w-3" />
                                </button>
                              ))}
                              {Array.from(selectedDietCategories).map((cat) => (
                                <button
                                  key={cat}
                                  onClick={() => handleToggleDietCategory(cat)}
                                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-brand/15 text-brand border border-brand/30"
                                >
                                  {cat}
                                  <X className="h-3 w-3" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* ── Item grid/list ── */}
                    <div className="flex-1 overflow-y-auto py-3">
                      {/* EXERCISES — 2-column photo grid */}
                      {selectedRoutineType === 1 && (
                        <>
                          <div className="grid grid-cols-2 gap-3 px-4">
                            {filteredWorkouts.map((exercise) => {
                              const isAlreadyAdded = userWorkouts.some((uw) => uw.workout_id === exercise.id);
                              const isSelected = selectedItems.has(exercise.id);
                              return (
                                <button
                                  key={exercise.key}
                                  onClick={async () => {
                                    if (!exercise.isLocal && !selectedItems.has(exercise.id)) {
                                      try {
                                        const created = await createCustomWorkoutDb(
                                          exercise.name, exercise.description,
                                          exercise.muscleGroup || "", exercise.catalogImage,
                                        );
                                        exercise.id = created.id;
                                        exercise.isLocal = true;
                                        handleSelectItem(created.id);
                                      } catch (err: any) {
                                        toast({ title: t("goals_error_add_exercise"), description: err?.message || t("goals_try_again"), variant: "destructive" });
                                      }
                                    } else {
                                      handleSelectItem(exercise.id);
                                    }
                                  }}
                                  className={`relative flex flex-col rounded-2xl border overflow-hidden text-left transition-all active:scale-[0.97] ${
                                    isSelected
                                      ? "border-brand ring-2 ring-brand/30"
                                      : isAlreadyAdded
                                        ? "border-green-500/50"
                                        : "border-border/50 bg-card"
                                  }`}
                                >
                                  {/* Photo area — tap to select */}
                                  <div className="relative w-full aspect-square overflow-hidden bg-muted/30">
                                    <ExerciseImage photo={exercise.photo} name={exercise.name} muscleGroup={exercise.muscleGroup} className="w-full h-full object-cover" />

                                    {/* Info button */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onImageZoomChange({ src: exercise.photo || null, name: exercise.name, description: exercise.description || undefined, muscleGroup: exercise.muscleGroup });
                                      }}
                                      className="absolute top-1.5 left-1.5 flex items-center justify-center w-6 h-6 rounded-full bg-black/50 backdrop-blur-sm text-white z-10"
                                      aria-label="Ver detalhes"
                                    >
                                      <Info className="h-3.5 w-3.5" />
                                    </button>

                                    {/* Selection overlay */}
                                    <AnimatePresence>
                                      {isSelected && (
                                        <motion.div
                                          initial={{ opacity: 0 }}
                                          animate={{ opacity: 1 }}
                                          exit={{ opacity: 0 }}
                                          className="absolute inset-0 bg-brand/20 flex items-center justify-center"
                                        >
                                          <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center shadow-lg">
                                            <Check className="h-5 w-5 text-white stroke-[3]" />
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>

                                  {/* Info row */}
                                  <div className={`px-2.5 py-2 transition-colors ${isSelected ? "bg-brand/8" : ""}`}>
                                    <p className="text-xs font-semibold leading-tight line-clamp-2">{exercise.name}</p>
                                    {exercise.muscleGroup && (
                                      <span className="inline-block text-[10px] font-medium text-brand bg-brand/10 px-1.5 py-0.5 rounded-full mt-1">
                                        {exercise.muscleGroup}
                                      </span>
                                    )}
                                    {isAlreadyAdded && !isSelected && (
                                      <span className="block text-[10px] text-green-500 font-medium mt-0.5">{t("goals_already_added")}</span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex justify-center pt-4 pb-4 px-4">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-full gap-2 text-xs h-9 border-dashed"
                              onClick={() => setCreateWorkoutDrawerOpen(true)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              {t("goals_not_found_exercise")}
                            </Button>
                          </div>
                        </>
                      )}

                      {/* DIETS — 2-column photo grid */}
                      {selectedRoutineType === 2 && (
                        <div className="grid grid-cols-2 gap-3 px-4">
                          {filteredDiets.map((diet) => {
                            const isAlreadyInRoutine = userDiets.some(
                              (ud) => ud.diet_id === diet.id && (addToRoutineCardName ? ud.name === addToRoutineCardName : !ud.name),
                            );
                            const isSelected = selectedItems.has(diet.id);
                            return (
                              <button
                                key={diet.id}
                                onClick={() => handleSelectItem(diet.id)}
                                className={`relative flex flex-col rounded-2xl border overflow-hidden text-left transition-all active:scale-[0.97] ${
                                  isSelected
                                    ? "border-brand ring-2 ring-brand/30"
                                    : isAlreadyInRoutine
                                      ? "border-green-500/50"
                                      : "border-border/50 bg-card"
                                }`}
                              >
                                <div className="relative w-full aspect-square overflow-hidden bg-muted/30">
                                  <DietImage photo={diet.photo} name={diet.name} category={diet.category} className="w-full h-full object-cover" />
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onImageZoomChange({ src: (diet as any).photo || (diet as any).image || null, name: diet.name, description: diet.description || undefined, category: diet.category });
                                    }}
                                    className="absolute top-1.5 left-1.5 flex items-center justify-center w-6 h-6 rounded-full bg-black/50 backdrop-blur-sm text-white z-10"
                                    aria-label="Ver detalhes"
                                  >
                                    <Info className="h-3.5 w-3.5" />
                                  </button>
                                  <AnimatePresence>
                                    {isSelected && (
                                      <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="absolute inset-0 bg-brand/20 flex items-center justify-center"
                                      >
                                        <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center shadow-lg">
                                          <Check className="h-5 w-5 text-white stroke-[3]" />
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                                <div className="px-2.5 py-2">
                                  <p className="text-xs font-semibold leading-tight line-clamp-2">{diet.name}</p>
                                  {diet.category && (
                                    <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground mt-1">{diet.category}</span>
                                  )}
                                  {(diet.calories ?? 0) > 0 && (
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{diet.calories} cal</p>
                                  )}
                                  {isAlreadyInRoutine && !isSelected && (
                                    <span className="block text-[10px] text-green-500 font-medium mt-0.5">{t("goals_already_added")}</span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* HABITS — list (no photos) */}
                      {selectedRoutineType === 3 && (
                        <div className="space-y-2 px-4">
                          {habits
                            .filter((h) => h.name.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map((habit) => {
                              const isAlreadyInRoutine = userHabits.some(
                                (uh) => uh.habit_id === habit.id && (addToRoutineCardName ? uh.name === addToRoutineCardName : !uh.name),
                              );
                              const isSelected = selectedItems.has(habit.id);
                              return (
                                <button
                                  key={habit.id}
                                  onClick={() => handleSelectItem(habit.id)}
                                  className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-left active:scale-[0.98] ${
                                    isSelected
                                      ? "border-brand bg-brand/10 ring-1 ring-brand/20"
                                      : isAlreadyInRoutine
                                        ? "border-green-500/40 bg-green-500/5"
                                        : "border-border/50 bg-card"
                                  }`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate">{habit.name}</p>
                                    {habit.description && (
                                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{habit.description}</p>
                                    )}
                                    {isAlreadyInRoutine && !isSelected && (
                                      <span className="text-[10px] text-green-500 font-medium">{t("goals_already_added")}</span>
                                    )}
                                  </div>
                                  <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                                    isSelected ? "border-brand bg-brand" : "border-border/60"
                                  }`}>
                                    {isSelected && <Check className="h-3.5 w-3.5 text-white stroke-[3]" />}
                                  </div>
                                </button>
                              );
                            })}
                        </div>
                      )}
                    </div>

                    {/* Sticky confirm button */}
                    <AnimatePresence>
                      {selectedItems.size > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 16 }}
                          transition={{ type: "spring", damping: 24, stiffness: 280 }}
                          className="shrink-0 px-4 pt-2 border-t border-border/30 bg-background/95 backdrop-blur-sm"
                          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
                        >
                          <Button
                            onClick={onNext}
                            className="w-full rounded-full h-12 text-base font-semibold"
                          >
                            {t("goals_next_n").replace("{n}", String(selectedItems.size))}
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      <CreateWorkoutDrawer
        open={createWorkoutDrawerOpen}
        onOpenChange={setCreateWorkoutDrawerOpen}
        muscleGroups={uniqueMuscleGroups}
        onCreated={(workout) => {
          onWorkoutCreated(workout);
          onSelectedItemsChange(new Set([...selectedItems, workout.id]));
        }}
      />
    </>
  );
}