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
import { toast } from "@/components/ui/use-toast";
import {
  createCustomGoalAndSelectDb,
  getUserGoalsDb,
  type ProgrammedGoal,
  type UserGoal,
} from "@/lib/ritmofit-db";
import { useLanguage } from "@/lib/language-context";

const GOAL_TYPES = [
  { value: 1 as const, emoji: "💪", label: "Fitness", color: "bg-blue-500/10 text-blue-600 border-blue-300 dark:border-blue-700" },
  { value: 2 as const, emoji: "🏥", label: "Saúde", color: "bg-emerald-500/10 text-emerald-600 border-emerald-300 dark:border-emerald-700" },
  { value: 3 as const, emoji: "✨", label: "Hábitos", color: "bg-orange-500/10 text-orange-600 border-orange-300 dark:border-orange-700" },
];

const DURATION_PRESETS = [
  { value: 30, label: "30 dias" },
  { value: 60, label: "60 dias" },
  { value: 90, label: "90 dias" },
];

interface CreateGoalDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onCreated: (data: {
    goalId: string;
    freshUserGoals: UserGoal[];
    newGoal: ProgrammedGoal;
  }) => void;
}

export function CreateGoalDrawer({
  open,
  onOpenChange,
  userId,
  onCreated,
}: CreateGoalDrawerProps) {
  const { t } = useLanguage();
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<1 | 2 | 3>(1);
  const [duration, setDuration] = React.useState(30);
  const [customDuration, setCustomDuration] = React.useState("");
  const [useCustomDuration, setUseCustomDuration] = React.useState(false);
  const [quantity, setQuantity] = React.useState(1);
  const [isCreating, setIsCreating] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setDescription("");
      setType(1);
      setDuration(30);
      setCustomDuration("");
      setUseCustomDuration(false);
      setQuantity(1);
    }
  }, [open]);

  const effectiveDuration = useCustomDuration ? Math.max(1, Number(customDuration) || 1) : duration;

  const handleCreate = async () => {
    if (!description.trim()) {
      toast({ title: t("goals_create_desc_required"), description: t("goals_create_desc_required_desc"), variant: "destructive" });
      return;
    }
    setIsCreating(true);
    try {
      const goalId = await createCustomGoalAndSelectDb(userId, description.trim(), type, effectiveDuration, quantity);
      const freshUserGoals = await getUserGoalsDb();
      onCreated({
        goalId,
        freshUserGoals,
        newGoal: {
          id: goalId,
          description: description.trim(),
          duration: effectiveDuration,
          quantity,
          type,
          created_by_user: 1,
        },
      });
      toast({ title: t("goals_created_toast"), description: description.trim() });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: t("goals_create_error"), description: err?.message || t("goals_create_error_retry"), variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh] flex flex-col modal-enter" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DrawerHeader className="shrink-0 pb-2">
          <DrawerTitle>{t("goals_create_title")}</DrawerTitle>
          <p className="text-xs text-muted-foreground mt-0.5">{t("goals_create_subtitle")}</p>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-8">
          <div className="space-y-5">
            {/* Goal description */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">{t("goals_create_label_desc")}</Label>
              <Input
                placeholder={t("goals_create_placeholder")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={120}
                style={{ fontSize: "16px" }}
              />
              <p className="text-xs text-muted-foreground">{description.length}/120</p>
            </div>

            {/* Goal type */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">{t("goals_create_label_type")}</Label>
              <div className="grid grid-cols-3 gap-2">
                {GOAL_TYPES.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={`rounded-xl border-2 px-2 py-3 text-xs font-semibold transition-all flex flex-col items-center gap-1 ${
                      type === opt.value
                        ? opt.color + " border-current shadow-sm"
                        : "border-border/50 text-muted-foreground hover:border-border"
                    }`}
                  >
                    <span className="text-xl">{opt.emoji}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration presets */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">{t("goals_create_label_duration")}</Label>
              <div className="flex gap-2 flex-wrap">
                {DURATION_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => { setDuration(p.value); setUseCustomDuration(false); }}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold border transition-all ${
                      !useCustomDuration && duration === p.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border/60 text-muted-foreground hover:border-border"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setUseCustomDuration(true)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold border transition-all ${
                    useCustomDuration
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border/60 text-muted-foreground hover:border-border"
                  }`}
                >
                  {t("goals_create_custom_days")}
                </button>
              </div>
              {useCustomDuration && (
                <Input
                  type="number"
                  min={1}
                  max={365}
                  placeholder="Ex: 45"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                  className="w-32 text-center"
                  style={{ fontSize: "16px" }}
                  autoFocus
                />
              )}
            </div>

            {/* Frequency */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">{t("goals_create_label_freq")}</Label>
              <p className="text-xs text-muted-foreground">{t("goals_create_freq_hint")}</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="h-9 w-9 rounded-full border border-border flex items-center justify-center text-lg font-bold hover:bg-muted transition-colors"
                  aria-label="Diminuir"
                >
                  −
                </button>
                <span className="text-lg font-bold w-8 text-center">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="h-9 w-9 rounded-full border border-border flex items-center justify-center text-lg font-bold hover:bg-muted transition-colors"
                  aria-label="Aumentar"
                >
                  +
                </button>
                <span className="text-xs text-muted-foreground">{quantity === 1 ? t("goals_create_freq_daily") : t("goals_create_freq_every").replace("{n}", String(quantity))}</span>
              </div>
            </div>

            <Button
              onClick={handleCreate}
              disabled={isCreating || !description.trim()}
              className="w-full rounded-full h-11 text-sm font-semibold"
            >
              {isCreating ? t("goals_creating") : t("goals_create_btn")}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
