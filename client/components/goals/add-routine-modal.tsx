import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Search,
  Filter,
  ChevronDown,
  Plus,
} from "lucide-react";
import { ExerciseImage } from "@/components/shared/exercise-image";
import { DietImage } from "@/components/shared/diet-image";
import { ExecuteAtDrawer } from "@/components/goals/execute-at-drawer";
import { CreateWorkoutDrawer } from "@/components/goals/create-workout-drawer";
import { useLanguage } from "@/lib/language-context";
import { toast } from "@/components/ui/use-toast";
import { createCustomWorkoutDb, type Workout, type Diet, type Habit, type UserWorkoutWithDetails, type UserDietWithDetails } from "@/lib/ritmofit-db";

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
  onAddToRoutineCardNameChange: (name: string | null) => void;

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

  showExecuteAtStep: boolean;
  onShowExecuteAtStepChange: (v: boolean) => void;

  isAddingRoutine: boolean;

  filteredWorkouts: UnifiedExercise[];
  filteredDiets: Diet[];
  habits: Habit[];
  uniqueMuscleGroups: string[];
  uniqueDietCategories: string[];

  userWorkouts: UserWorkoutWithDetails[];
  userDiets: UserDietWithDetails[];
  userHabits: any[];

  imageZoom: import("@/components/shared/image-zoom-drawer").ImageZoomItem | null;
  onImageZoomChange: (v: import("@/components/shared/image-zoom-drawer").ImageZoomItem | null) => void;

  onSaveRoutines: (executeAtOverrides?: (string | null)[]) => Promise<void>;

  // for CreateWorkoutDrawer
  onWorkoutCreated: (workout: Workout) => void;
}

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
  onAddToRoutineCardNameChange,
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
  showExecuteAtStep,
  onShowExecuteAtStepChange,
  isAddingRoutine,
  filteredWorkouts,
  filteredDiets,
  habits,
  uniqueMuscleGroups,
  uniqueDietCategories,
  userWorkouts,
  userDiets,
  userHabits,
  onImageZoomChange,
  onSaveRoutines,
  onWorkoutCreated,
}: AddRoutineModalProps) {
  const { t } = useLanguage();
  const [createWorkoutDrawerOpen, setCreateWorkoutDrawerOpen] = React.useState(false);
  const [createWorkoutInitialName, setCreateWorkoutInitialName] = React.useState("");

  const handleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    onSelectedItemsChange(newSelected);
  };

  const handleToggleMuscleGroup = (muscleGroup: string) => {
    const newSelected = new Set(selectedMuscleGroups);
    if (newSelected.has(muscleGroup)) {
      newSelected.delete(muscleGroup);
    } else {
      newSelected.add(muscleGroup);
    }
    onSelectedMuscleGroupsChange(newSelected);
  };

  const handleToggleDietCategory = (category: string) => {
    const newSelected = new Set(selectedDietCategories);
    if (newSelected.has(category)) {
      newSelected.delete(category);
    } else {
      newSelected.add(category);
    }
    onSelectedDietCategoriesChange(newSelected);
  };

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(o) => {
          onOpenChange(o);
          if (!o) onIsAddingFromWorkoutChange(false);
        }}
      >
        <DrawerContent
          className="flex flex-col modal-enter rounded-none"
          style={{ height: "100dvh", maxHeight: "100dvh", marginTop: 0 }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* absorve o foco inicial no iOS para evitar que o teclado abra automaticamente */}
          <span tabIndex={0} aria-hidden className="absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden" />
          {/* Header — always visible */}
          <DrawerHeader className="shrink-0 pb-2">
            <div className="flex items-center justify-between">
              <DrawerTitle>
                {selectedRoutineType !== null
                  ? selectedRoutineType === 1
                    ? t("goals_rt_exercises")
                    : selectedRoutineType === 2
                      ? t("goals_rt_diets")
                      : t("goals_rt_habits")
                  : t("goals_add_routine_title")}
              </DrawerTitle>
              {selectedRoutineType !== null && !isAddingFromWorkout && (
                <button
                  onClick={() => {
                    onSelectedRoutineTypeChange(null);
                    onSelectedItemsChange(new Set());
                    onSearchQueryChange("");
                    onSelectedMuscleGroupsChange(new Set());
                    onSelectedDietCategoriesChange(new Set());
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 -mr-2 min-h-[44px] flex items-center"
                >
                  {t("goals_back")}
                </button>
              )}
            </div>
            {addToRoutineCardName && selectedRoutineType !== null && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-brand/10 border border-brand/20 rounded-lg mt-1">
                <span className="text-xs text-brand">{t("goals_adding_to")}</span>
                <span className="text-xs font-semibold text-brand">{addToRoutineCardName}</span>
              </div>
            )}
          </DrawerHeader>

          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Type Selection step */}
            {selectedRoutineType === null ? (
              <div className="flex flex-col gap-5 px-4 pb-4 overflow-y-auto">
                <div className="rounded-xl border-2 border-brand/40 bg-brand/5 p-4 space-y-2">
                  <Label htmlFor="routine_name" className="text-sm font-semibold text-brand">
                    {t("goals_routine_name_label")}
                  </Label>
                  <Input
                    id="routine_name"
                    type="text"
                    value={routineName}
                    onChange={(e) => onRoutineNameChange(e.target.value)}
                    className="h-10 border-brand/30 focus:border-brand bg-background"
                    placeholder={t("goals_routine_name_placeholder_exercises")}
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">{t("goals_select_type")}</p>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { code: 1, label: t("goals_rt_exercises"), emoji: "🏋️", desc: t("goals_rt_exercises_desc") },
                      { code: 2, label: t("goals_rt_diets"), emoji: "🥗", desc: t("goals_rt_diets_desc") },
                      { code: 3, label: t("goals_rt_habits"), emoji: "✅", desc: t("goals_rt_habits_desc") },
                    ].map(({ code, label, emoji, desc }) => (
                      <button
                        key={code}
                        onClick={() => { onSelectedRoutineTypeChange(code); onSearchQueryChange(""); }}
                        className="p-4 border border-border/60 rounded-lg hover:bg-muted/50 hover:border-border transition-colors text-left flex items-center gap-3 min-h-[64px]"
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
                {/* Sticky filters section */}
                <div className="shrink-0 px-4 pb-2 space-y-2 border-b border-border/30">
                  {/* Search — all types */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder={
                        selectedRoutineType === 1
                          ? t("goals_search_exercise")
                          : selectedRoutineType === 2
                            ? t("goals_search_diet")
                            : t("goals_search_habit")
                      }
                      value={searchQuery}
                      onChange={(e) => onSearchQueryChange(e.target.value)}
                      className="pl-10 h-10"
                    />
                  </div>

                  {/* Workout type pills */}
                  {selectedRoutineType === 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-medium">{t("goals_type_label")}</span>
                      {[
                        { value: null, label: t("goals_all") },
                        { value: 1, label: t("goals_gym") },
                        { value: 2, label: t("goals_home") },
                      ].map((opt) => (
                        <button
                          key={String(opt.value)}
                          type="button"
                          onClick={() => onSelectedWorkoutTypeChange(opt.value)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-all min-h-[32px] ${selectedWorkoutType === opt.value
                            ? "border-brand bg-brand/15 text-brand font-medium"
                            : "border-border/50 text-muted-foreground hover:border-brand/40"
                            }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Muscle group filter */}
                  {selectedRoutineType === 1 && uniqueMuscleGroups.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => onShowMuscleFilterPanelChange(!showMuscleFilterPanel)}
                          className="flex items-center gap-1.5 min-h-[36px]"
                        >
                          <Filter className={`h-3.5 w-3.5 ${selectedMuscleGroups.size > 0 ? "text-brand" : "text-muted-foreground"}`} />
                          <span className={`text-xs font-medium ${selectedMuscleGroups.size > 0 ? "text-brand" : "text-muted-foreground"}`}>
                            {t("goals_muscle_group")}{selectedMuscleGroups.size > 0 ? ` (${selectedMuscleGroups.size})` : ""}
                          </span>
                          <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${showMuscleFilterPanel ? "rotate-180" : ""}`} />
                        </button>
                        {selectedMuscleGroups.size > 0 && (
                          <button onClick={() => onSelectedMuscleGroupsChange(new Set())} className="text-xs text-brand">
                            {t("goals_clear")}
                          </button>
                        )}
                      </div>
                      {showMuscleFilterPanel && (
                        <div className="grid grid-cols-4 gap-1.5 pb-1">
                          {uniqueMuscleGroups.map((muscleGroup) => (
                            <button
                              key={muscleGroup}
                              onClick={() => handleToggleMuscleGroup(muscleGroup)}
                              className={`flex items-center justify-center py-2 px-1 rounded-xl border text-center transition-all min-h-[36px] ${selectedMuscleGroups.has(muscleGroup)
                                ? "border-brand bg-brand/15 text-brand"
                                : "border-border/50 text-muted-foreground"
                                }`}
                            >
                              <span className="text-[10px] font-medium leading-tight">{muscleGroup}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Diet category filter */}
                  {selectedRoutineType === 2 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => onShowMuscleFilterPanelChange(!showMuscleFilterPanel)}
                          className="flex items-center gap-1.5 min-h-[36px]"
                        >
                          <Filter className={`h-3.5 w-3.5 ${selectedDietCategories.size > 0 ? "text-brand" : "text-muted-foreground"}`} />
                          <span className={`text-xs font-medium ${selectedDietCategories.size > 0 ? "text-brand" : "text-muted-foreground"}`}>
                            {t("goals_category")}{selectedDietCategories.size > 0 ? ` (${selectedDietCategories.size})` : ""}
                          </span>
                          <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${showMuscleFilterPanel ? "rotate-180" : ""}`} />
                        </button>
                        {selectedDietCategories.size > 0 && (
                          <button onClick={() => onSelectedDietCategoriesChange(new Set())} className="text-xs text-brand">
                            {t("goals_clear")}
                          </button>
                        )}
                      </div>
                      {showMuscleFilterPanel && (
                        <div className="flex flex-wrap gap-2 pb-1">
                          {uniqueDietCategories.length === 0 ? (
                            <p className="text-xs text-muted-foreground">{t("goals_categories_loading")}</p>
                          ) : (
                            uniqueDietCategories.map((cat) => (
                              <button
                                key={cat}
                                onClick={() => handleToggleDietCategory(cat)}
                                className={`px-3 py-1.5 text-xs rounded-full border transition-all min-h-[32px] ${selectedDietCategories.has(cat)
                                  ? "border-brand bg-brand/20 text-brand"
                                  : "border-border/60 text-muted-foreground"
                                  }`}
                              >
                                {cat}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Scrollable items list — takes all remaining space */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                  {selectedRoutineType === 1 &&
                    filteredWorkouts.map((exercise) => {
                      const isAlreadySelected = userWorkouts.some((uw) => uw.workout_id === exercise.id);
                      const isNewSelection = selectedItems.has(exercise.id);

                      return (
                        <button
                          key={exercise.key}
                          onClick={async () => {
                            if (!exercise.isLocal && !selectedItems.has(exercise.id)) {
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
                                  title: t("goals_error_add_exercise"),
                                  description: err?.message || t("goals_try_again"),
                                  variant: "destructive",
                                });
                              }
                            } else {
                              handleSelectItem(exercise.id);
                            }
                          }}
                          className={`w-full p-3 rounded-lg border transition-all text-left min-h-[64px] ${isNewSelection
                            ? "border-brand bg-brand/10"
                            : isAlreadySelected
                              ? "border-green-500/40 bg-green-500/5"
                              : "border-border/60 hover:border-border/80"
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="flex-shrink-0 rounded overflow-hidden"
                              onClick={(e) => { e.stopPropagation(); onImageZoomChange({ src: exercise.photo || null, name: exercise.name, description: exercise.description || undefined, muscleGroup: exercise.muscleGroup }); }}
                            >
                              <ExerciseImage photo={exercise.photo} name={exercise.name} muscleGroup={exercise.muscleGroup} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">{exercise.name}</span>
                                {isAlreadySelected && !isNewSelection && (
                                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">{t("goals_already_added")}</span>
                                )}
                              </div>
                              {exercise.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{exercise.description}</p>
                              )}
                              {exercise.muscleGroup && (
                                <span className="inline-block text-[10px] font-medium text-brand bg-brand/10 px-2 py-0.5 rounded-full mt-1">
                                  {exercise.muscleGroup}
                                </span>
                              )}
                            </div>
                            <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${isNewSelection ? "border-brand bg-brand" : "border-border/60"}`}>
                              {isNewSelection && <span className="text-white text-[10px] font-bold">✓</span>}
                            </div>
                          </div>
                        </button>
                      );
                    })}

                  {selectedRoutineType === 1 && (
                    <div className="flex justify-center pt-2 pb-1">
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
                        {t("goals_not_found_exercise")}
                      </Button>
                    </div>
                  )}

                  {selectedRoutineType === 2 &&
                    filteredDiets.map((diet) => {
                      const isAlreadyInRoutine = userDiets.some(
                        (ud) => ud.diet_id === diet.id && (addToRoutineCardName ? ud.name === addToRoutineCardName : !ud.name),
                      );
                      const isNewSelection = selectedItems.has(diet.id);
                      return (
                        <button
                          key={diet.id}
                          onClick={() => handleSelectItem(diet.id)}
                          className={`w-full p-3 rounded-lg border transition-all text-left min-h-[64px] ${isNewSelection
                            ? "border-brand bg-brand/10"
                            : isAlreadyInRoutine
                              ? "border-green-500/40 bg-green-500/5"
                              : "border-border/60 hover:border-border/80"
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="flex-shrink-0 rounded overflow-hidden"
                              onClick={(e) => { e.stopPropagation(); onImageZoomChange({ src: (diet as any).photo || (diet as any).image || null, name: diet.name, description: diet.description || undefined, category: diet.category }); }}
                            >
                              <DietImage photo={diet.photo} name={diet.name} category={diet.category} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate flex-1">{diet.name}</span>
                                {isAlreadyInRoutine && !isNewSelection && (
                                  <span className="text-xs text-green-600 dark:text-green-400 font-medium flex-shrink-0">{t("goals_already_added")}</span>
                                )}
                              </div>
                              {diet.category && (
                                <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground mt-1">{diet.category}</span>
                              )}
                              {(diet.calories ?? 0) > 0 && (
                                <p className="text-xs text-muted-foreground mt-0.5">{diet.calories} cal</p>
                              )}
                            </div>
                            <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${isNewSelection ? "border-brand bg-brand" : "border-border/60"}`}>
                              {isNewSelection && <span className="text-white text-[10px] font-bold">✓</span>}
                            </div>
                          </div>
                        </button>
                      );
                    })}

                  {selectedRoutineType === 3 &&
                    habits.filter((h) => h.name.toLowerCase().includes(searchQuery.toLowerCase())).map((habit) => {
                      const isAlreadyInRoutine = userHabits.some(
                        (uh) => uh.habit_id === habit.id && (addToRoutineCardName ? uh.name === addToRoutineCardName : !uh.name),
                      );
                      const isNewSelection = selectedItems.has(habit.id);
                      return (
                        <button
                          key={habit.id}
                          onClick={() => handleSelectItem(habit.id)}
                          className={`w-full p-3 rounded-lg border transition-all text-left min-h-[56px] ${isNewSelection
                            ? "border-brand bg-brand/10"
                            : isAlreadyInRoutine
                              ? "border-green-500/40 bg-green-500/5"
                              : "border-border/60 hover:border-border/80"
                            }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium truncate">{habit.name}</span>
                                {isAlreadyInRoutine && !isNewSelection && (
                                  <span className="text-xs text-green-600 dark:text-green-400 font-medium flex-shrink-0">{t("goals_already_added")}</span>
                                )}
                              </div>
                              {habit.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{habit.description}</p>
                              )}
                            </div>
                            <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${isNewSelection ? "border-brand bg-brand" : "border-border/60"}`}>
                              {isNewSelection && <span className="text-white text-[10px] font-bold">✓</span>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                </div>

                {/* Sticky footer — confirm button */}
                {selectedItems.size > 0 && (
                  <div className="shrink-0 px-4 pt-2 pb-4 border-t border-border/30 bg-background/95 backdrop-blur-sm"
                    style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
                  >
                    <Button
                      onClick={() => onShowExecuteAtStepChange(true)}
                      disabled={isAddingRoutine}
                      className="w-full rounded-full h-12 text-base font-semibold"
                    >
                      {t("goals_next_n").replace("{n}", String(selectedItems.size))}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <ExecuteAtDrawer
        open={showExecuteAtStep}
        onOpenChange={(v) => { if (!v) onShowExecuteAtStepChange(false); }}
        isSaving={isAddingRoutine}
        onConfirm={(executeDates) => {
          onSaveRoutines(executeDates.length > 0 ? executeDates : [null]);
          onShowExecuteAtStepChange(false);
        }}
      />

      <CreateWorkoutDrawer
        open={createWorkoutDrawerOpen}
        onOpenChange={setCreateWorkoutDrawerOpen}
        muscleGroups={uniqueMuscleGroups}
        initialName={createWorkoutInitialName}
        onCreated={(workout) => {
          onWorkoutCreated(workout);
          onSelectedItemsChange(new Set([...selectedItems, workout.id]));
        }}
      />
    </>
  );
}
