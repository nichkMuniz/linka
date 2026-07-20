import * as React from "react";
import { Check, CheckCircle2, Pencil, Plus, Share2, Trash2, X } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/lib/language-context";
import { useKeyboardInputScroll } from "@/hooks/use-keyboard-input-scroll";
import { GoalShareDrawer } from "@/components/goals/goal-share-drawer";
import type { Routine, UserGoal } from "@/lib/ritmofit-db";

interface GoalDetailDrawerProps {
  goal: UserGoal | null;
  routines: Routine[];
  onClose: () => void;
  onEditGoal: (goal: UserGoal, updates: { duration: number; quantity: number }) => Promise<void>;
  onDeleteGoal: (goal: UserGoal) => Promise<void>;
  /** Vincula (goalId) ou desvincula (null) uma rotina da meta. */
  onToggleRoutineLink: (routineId: string, goalId: string | null) => Promise<void>;
  /** Quando true, oculta ações de editar/excluir e vinculação de rotinas (ex: perfil de outro usuário) */
  readOnly?: boolean;
}

export function GoalDetailDrawer({
  goal,
  routines,
  onClose,
  onEditGoal,
  onDeleteGoal,
  onToggleRoutineLink,
  readOnly = false,
}: GoalDetailDrawerProps) {
  const { t } = useLanguage();
  const [editing, setEditing] = React.useState(false);
  const [durationValue, setDurationValue] = React.useState("");
  const [frequencyValue, setFrequencyValue] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  // Meta em compartilhamento — guardada em estado próprio (em vez de um boolean)
  // para o card continuar montado enquanto este drawer fecha ao publicar.
  const [goalToShare, setGoalToShare] = React.useState<UserGoal | null>(null);
  // O form de edição (duração/frequência) fica no scroll — teclado não pode cobri-lo.
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  useKeyboardInputScroll(scrollRef, !!goal);

  const routineTypeLabel = (type: number) =>
    type === 2 ? t("goals_rt_diets") : type === 3 ? t("goals_rt_habits") : t("goals_rt_exercises");

  const handleToggleRoutine = async (routine: Routine, link: boolean) => {
    if (!goal) return;
    setTogglingId(routine.id);
    try {
      await onToggleRoutineLink(routine.id, link ? goal.goal_id : null);
    } finally {
      setTogglingId(null);
    }
  };

  // Reset state when a different goal is opened
  React.useEffect(() => {
    if (goal) {
      setEditing(false);
      setDurationValue(String(goal.duration));
      setFrequencyValue(String(goal.quantity));
      setDeleteConfirmOpen(false);
      setGoalToShare(null);
    }
  }, [goal?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!goal) return null;

  const isCompleted = goal.perc >= 100;
  const perc = Math.min(100, Math.round(goal.perc));
  const daysRemaining = Math.max(0, goal.duration - goal.days_completed);

  // Frequência = dias por semana, logo nunca passa de 7; e não faz sentido
  // executar mais dias do que a meta dura (duração 3 dias ⇒ no máx. 3x).
  const parsedDuration = parseInt(durationValue, 10);
  const maxFrequency = Math.min(
    7,
    Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 7,
  );

  const handleSave = async () => {
    const duration = parseInt(durationValue, 10);
    const rawQuantity = parseInt(frequencyValue, 10);
    if (!duration || duration < 1 || !rawQuantity || rawQuantity < 1) return;
    // Guarda final: o campo já barra valores fora da faixa, mas a duração pode
    // ter sido reduzida depois da frequência ter sido digitada.
    const quantity = Math.min(rawQuantity, Math.min(7, duration));
    setIsSaving(true);
    try {
      await onEditGoal(goal, { duration, quantity });
      setFrequencyValue(String(quantity));
      setEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Drawer open={!!goal} onOpenChange={(open) => !open && onClose()} handleOnly>
        <DrawerContent
          handleOnly
          handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
          className="!rounded-t-[32px] !border-0"
          style={{
            background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
            backdropFilter: "blur(40px) saturate(180%)",
            WebkitBackdropFilter: "blur(40px) saturate(180%)",
            borderTop: "1px solid rgba(255,255,255,.14)",
          }}
        >
          <DrawerHeader className="pb-0">
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5 shrink-0">{isCompleted ? "🏆" : "🎯"}</span>
              <DrawerTitle className="text-left text-base font-bold leading-snug flex-1" style={{ color: "#fff" }}>
                {goal.description}
              </DrawerTitle>
              {isCompleted && (
                <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t("goals_gd_completed_badge")}
                </span>
              )}
            </div>
          </DrawerHeader>

          <div
            ref={scrollRef}
            className="px-4 pt-5 space-y-5 overflow-y-auto"
            style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom) + var(--keyboard-height, 0px))" }}
          >
            {/* Progress */}
            <div className="space-y-2">
              <div className="flex items-end justify-between">
                <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,.5)" }}>
                  {t("goals_gd_progress")}
                </span>
                <span className="text-3xl font-bold text-emerald-400 tabular-nums leading-none">
                  {perc}%
                </span>
              </div>
              {/* Verde emerald (mesmo do "%" acima) num trilho translúcido:
                  sobre o vidro escuro o roxo do tema (bg-primary) se confundia
                  com o fundo. `[&>div]` mira o indicador do Radix. */}
              <Progress
                value={perc}
                className="h-3 rounded-full bg-white/10 [&>div]:bg-emerald-500"
              />
            </div>

            {editing ? (
              /* ── Edit form ── */
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="gd-duration" style={{ color: "#fff" }}>{t("goals_gd_edit_duration")}</Label>
                  <Input
                    id="gd-duration"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={durationValue}
                    onChange={(e) => {
                      setDurationValue(e.target.value);
                      // Baixar a duração abaixo da frequência deixaria o par
                      // inválido — acompanha o novo teto.
                      const d = parseInt(e.target.value, 10);
                      const f = parseInt(frequencyValue, 10);
                      if (Number.isFinite(d) && d > 0 && Number.isFinite(f) && f > d) {
                        setFrequencyValue(String(Math.min(7, d)));
                      }
                    }}
                    className="rounded-md"
                    style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gd-frequency" style={{ color: "#fff" }}>{t("goals_gd_edit_frequency")}</Label>
                  <Input
                    id="gd-frequency"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={maxFrequency}
                    value={frequencyValue}
                    onChange={(e) => {
                      // Mesmo padrão do wizard: só aceita a digitação dentro da
                      // faixa (o `max` do input não impede digitar no iOS).
                      const v = Number(e.target.value);
                      if (e.target.value === "" || (v >= 1 && v <= maxFrequency)) {
                        setFrequencyValue(e.target.value);
                      }
                    }}
                    className="rounded-md"
                    style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
                  />
                  <p className="text-xs" style={{ color: "rgba(255,255,255,.45)" }}>
                    {t("goals_gd_edit_frequency_hint").replace("{max}", String(maxFrequency))}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <Button
                    variant="outline"
                    className="rounded-full gap-2"
                    style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.12)" }}
                    disabled={isSaving}
                    onClick={() => {
                      setDurationValue(String(goal.duration));
                      setFrequencyValue(String(goal.quantity));
                      setEditing(false);
                    }}
                  >
                    <X className="h-4 w-4" />
                    {t("goals_gd_edit_cancel")}
                  </Button>
                  <Button
                    className="rounded-full"
                    style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
                    disabled={isSaving}
                    onClick={handleSave}
                  >
                    {isSaving ? t("goals_saving") : t("goals_gd_edit_save")}
                  </Button>
                </div>
              </div>
            ) : (
              /* ── View mode ── */
              <>
                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl p-4 text-center space-y-1" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                    <p className="text-3xl font-bold tabular-nums" style={{ color: "#fff" }}>{goal.days_completed}</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{t("goals_gd_days_done")}</p>
                  </div>
                  <div className="rounded-2xl p-4 text-center space-y-1" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                    <p className="text-3xl font-bold tabular-nums" style={{ color: "#fff" }}>
                      {isCompleted ? "—" : daysRemaining}
                    </p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{t("goals_gd_days_remaining")}</p>
                  </div>
                </div>

                {/* Linked routines — selecionáveis (oculto em modo readOnly) */}
                {!readOnly && (
                  <div className="space-y-2.5">
                    <p className="text-sm font-semibold" style={{ color: "#fff" }}>{t("goals_gd_linked_routines")}</p>
                    {routines.length === 0 ? (
                      <p className="text-sm" style={{ color: "rgba(255,255,255,.5)" }}>{t("goals_gd_no_routines_available")}</p>
                    ) : (
                      <>
                        <p className="text-xs" style={{ color: "rgba(255,255,255,.45)" }}>
                          {t("goals_gd_link_routines_hint")}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {routines.map((r) => {
                            const linkedHere = r.goal_id === goal.goal_id;
                            const label = r.name?.trim() || routineTypeLabel(r.type);
                            return (
                              <button
                                key={r.id}
                                type="button"
                                disabled={togglingId === r.id}
                                onClick={() => handleToggleRoutine(r, !linkedHere)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 disabled:opacity-50"
                                style={
                                  linkedHere
                                    ? { background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff", border: "1px solid transparent" }
                                    : { background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.14)" }
                                }
                              >
                                {linkedHere ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Actions (ocultos em modo readOnly) */}
                {!readOnly && (
                  <div className="space-y-2.5 pt-1">
                    {isCompleted && (
                      <Button
                        className="w-full rounded-full gap-2"
                        style={{ background: "#22c55e", color: "#fff" }}
                        onClick={() => setGoalToShare(goal)}
                      >
                        <Share2 className="h-4 w-4" />
                        {t("goals_gd_share")}
                      </Button>
                    )}
                    {!isCompleted && (
                      <Button
                        variant="outline"
                        className="w-full rounded-full gap-2"
                        style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.12)" }}
                        onClick={() => setEditing(true)}
                      >
                        <Pencil className="h-4 w-4" />
                        {t("goals_gd_edit")}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="w-full rounded-full text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
                      onClick={() => setDeleteConfirmOpen(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                      {t("goals_gd_delete")}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <GoalShareDrawer
        goal={goalToShare}
        onClose={() => setGoalToShare(null)}
        onShared={onClose}
      />

      <AlertDialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => !open && setDeleteConfirmOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("goals_delete_goal")}</AlertDialogTitle>
            <AlertDialogDescription>{t("goals_delete_goal_confirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("goals_cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={async (e) => {
                e.preventDefault();
                setIsDeleting(true);
                try {
                  await onDeleteGoal(goal);
                  setDeleteConfirmOpen(false);
                  onClose();
                } finally {
                  setIsDeleting(false);
                }
              }}
            >
              {isDeleting ? t("goals_saving") : t("goals_delete_goal")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
