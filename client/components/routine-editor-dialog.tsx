import * as React from "react";
import { Plus, Trash2 } from "lucide-react";

import type { GoalCategory, GoalVisibility, Routine } from "@/lib/ritmofit";
import { createRoutine, uid, updateRoutine } from "@/lib/ritmofit";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StepDraft = { id: string; title: string; detail: string };

const categoryOptions: Array<{ value: GoalCategory; label: string }> = [
  { value: "Treino", label: "Treino" },
  { value: "Alimentação", label: "Alimentação" },
  { value: "Hábito", label: "Hábito" },
];

const visibilityOptions: Array<{ value: GoalVisibility; label: string }> = [
  { value: "Público", label: "Público" },
  { value: "Seguidores", label: "Seguidores" },
];

export function RoutineEditorDialog({
  open,
  onOpenChange,
  routine,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  routine: Routine | null;
  onSaved: () => void;
}) {
  const isEdit = Boolean(routine);

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState<GoalCategory>("Treino");
  const [visibility, setVisibility] = React.useState<GoalVisibility>("Público");
  const [steps, setSteps] = React.useState<StepDraft[]>([]);

  React.useEffect(() => {
    if (!open) return;

    setTitle(routine?.title ?? "");
    setDescription(routine?.description ?? "");
    setCategory(routine?.category ?? "Treino");
    setVisibility(routine?.visibility ?? "Público");

    const nextSteps: StepDraft[] = (routine?.steps ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      detail: s.detail,
    }));

    setSteps(nextSteps.length ? nextSteps : [{ id: uid("rs"), title: "", detail: "" }]);
  }, [open, routine]);

  const canSave = title.trim().length >= 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(92vw,720px)] rounded-3xl border-border/60">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar rotina" : "Nova rotina"}</DialogTitle>
          <DialogDescription>
            Crie uma rotina que outras pessoas podem copiar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <div className="text-sm font-medium">Título</div>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <div className="text-sm font-medium">Descrição</div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[92px]"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <div className="text-sm font-medium">Tipo</div>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as GoalCategory)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">Visibilidade</div>
              <Select
                value={visibility}
                onValueChange={(v) => setVisibility(v as GoalVisibility)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {visibilityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">Passos</div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="rounded-full"
                onClick={() =>
                  setSteps((prev) => [...prev, { id: uid("rs"), title: "", detail: "" }])
                }
              >
                <Plus className="h-4 w-4" />
                Adicionar passo
              </Button>
            </div>

            <div className="grid gap-3">
              {steps.map((s, idx) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-border/60 bg-muted/20 p-4"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold text-muted-foreground">
                      Passo {idx + 1}
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className={cn(
                        "h-9 w-9 rounded-full",
                        steps.length === 1 ? "opacity-50" : null,
                      )}
                      aria-label="Remover passo"
                      disabled={steps.length === 1}
                      onClick={() =>
                        setSteps((prev) => prev.filter((p) => p.id !== s.id))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid gap-2">
                    <Input
                      value={s.title}
                      placeholder="Ex: Aquecimento 5 min"
                      onChange={(e) => {
                        const v = e.target.value;
                        setSteps((prev) =>
                          prev.map((p) => (p.id === s.id ? { ...p, title: v } : p)),
                        );
                      }}
                    />
                    <Textarea
                      value={s.detail}
                      placeholder="Detalhes (opcional)"
                      className="min-h-[72px]"
                      onChange={(e) => {
                        const v = e.target.value;
                        setSteps((prev) =>
                          prev.map((p) => (p.id === s.id ? { ...p, detail: v } : p)),
                        );
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              className="rounded-full"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              className="rounded-full"
              disabled={!canSave}
              onClick={() => {
                const trimmed = title.trim();

                if (isEdit && routine) {
                  updateRoutine(routine.id, (r) => ({
                    ...r,
                    title: trimmed,
                    description: description.trim(),
                    category,
                    visibility,
                    steps: steps.map((st) => ({
                      id: st.id,
                      title: st.title.trim(),
                      detail: st.detail.trim(),
                    })),
                  }));
                } else {
                  createRoutine({
                    title: trimmed,
                    description: description.trim(),
                    category,
                    visibility,
                    steps: steps.map((st) => ({
                      title: st.title,
                      detail: st.detail,
                    })),
                  });
                }

                onSaved();
                onOpenChange(false);
              }}
            >
              Salvar rotina
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
