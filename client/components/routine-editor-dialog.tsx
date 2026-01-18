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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ItemDraft = { id: string; name: string };

const categoryOptions: Array<{ value: GoalCategory; label: string }> = [
  { value: "Treino", label: "Treino" },
  { value: "Alimentação", label: "Alimentação" },
  { value: "Hábito", label: "Hábito" },
];

const visibilityOptions: Array<{ value: GoalVisibility; label: string }> = [
  { value: "Público", label: "Público" },
  { value: "Seguidores", label: "Seguidores" },
];

const suggestions: Record<GoalCategory, string[]> = {
  Treino: [
    "Supino reto",
    "Supino inclinado",
    "Crucifixo",
    "Desenvolvimento",
    "Elevação lateral",
    "Remada curvada",
    "Puxada na barra",
    "Rosca direta",
    "Rosca martelo",
    "Tríceps corda",
    "Tríceps testa",
    "Agachamento",
    "Leg press",
    "Stiff",
    "Cadeira extensora",
    "Cadeira flexora",
    "Panturrilha",
    "Abdominal",
    "Corrida",
    "Bicicleta",
  ],
  "Alimentação": [
    "Arroz",
    "Feijão",
    "Frango",
    "Ovo",
    "Carne",
    "Peixe",
    "Batata",
    "Macarrão",
    "Aveia",
    "Iogurte",
    "Banana",
    "Maçã",
    "Salada",
    "Legumes",
    "Castanhas",
    "Whey",
    "Água",
  ],
  "Hábito": [
    "Beber 2L de água",
    "Dormir 7–8 horas",
    "Alongar 10 min",
    "Caminhar 30 min",
    "10k passos",
    "Meditar 5 min",
    "Ler 10 páginas",
    "Sem refrigerante",
    "Sem açúcar",
    "Preparar marmita",
  ],
};

function itemsMeta(category: GoalCategory) {
  if (category === "Treino") {
    return {
      label: "Exercícios",
      placeholder: "Ex: Supino reto",
      help: "Digite e escolha da lista (ou escreva o seu).",
    };
  }

  if (category === "Alimentação") {
    return {
      label: "Comidas",
      placeholder: "Ex: Frango",
      help: "Liste os alimentos que fazem parte dessa rotina.",
    };
  }

  return {
    label: "Hábitos",
    placeholder: "Ex: Beber 2L de água",
    help: "Liste hábitos simples que você quer repetir.",
  };
}

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
  const [category, setCategory] = React.useState<GoalCategory>("Treino");
  const [visibility, setVisibility] = React.useState<GoalVisibility>("Público");
  const [items, setItems] = React.useState<ItemDraft[]>([]);

  React.useEffect(() => {
    if (!open) return;

    setTitle(routine?.title ?? "");
    setCategory(routine?.category ?? "Treino");
    setVisibility(routine?.visibility ?? "Público");

    const nextItems: ItemDraft[] = (routine?.steps ?? []).map((s) => ({
      id: s.id,
      name: s.title,
    }));

    setItems(
      nextItems.length ? nextItems : [{ id: uid("ri"), name: "" }],
    );
  }, [open, routine]);

  const canSave = title.trim().length >= 2;
  const meta = itemsMeta(category);
  const datalistId = `ritmofit-${category}-items`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(92vw,720px)] rounded-3xl border-border/60">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar rotina" : "Nova rotina"}</DialogTitle>
          <DialogDescription>
            Coloque um nome e liste os itens. O resto fica fácil de copiar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <div className="text-sm font-medium">Título</div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Peito + tríceps"
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
              <div>
                <div className="text-sm font-medium">{meta.label}</div>
                <div className="text-xs text-muted-foreground">{meta.help}</div>
              </div>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="rounded-full"
                onClick={() =>
                  setItems((prev) => [...prev, { id: uid("ri"), name: "" }])
                }
              >
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
            </div>

            <div className="grid gap-3">
              {items.map((it, idx) => (
                <div
                  key={it.id}
                  className="flex items-start gap-2 rounded-2xl border border-border/60 bg-muted/20 p-3"
                >
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-background ring-1 ring-border/60">
                    <span className="text-xs font-semibold">{idx + 1}</span>
                  </div>

                  <div className="flex-1">
                    <Input
                      value={it.name}
                      placeholder={meta.placeholder}
                      list={datalistId}
                      onChange={(e) => {
                        const v = e.target.value;
                        setItems((prev) =>
                          prev.map((p) => (p.id === it.id ? { ...p, name: v } : p)),
                        );
                      }}
                    />
                  </div>

                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "h-9 w-9 rounded-full",
                      items.length === 1 ? "opacity-50" : null,
                    )}
                    aria-label="Remover item"
                    disabled={items.length === 1}
                    onClick={() =>
                      setItems((prev) => prev.filter((p) => p.id !== it.id))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <datalist id={datalistId}>
              {suggestions[category].map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
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

                const nextSteps = items
                  .map((i) => ({ id: i.id, title: i.name.trim(), detail: "" }))
                  .filter((i) => i.title.length > 0);

                if (isEdit && routine) {
                  updateRoutine(routine.id, (r) => ({
                    ...r,
                    title: trimmed,
                    description: "",
                    category,
                    visibility,
                    steps: nextSteps,
                  }));
                } else {
                  createRoutine({
                    title: trimmed,
                    description: "",
                    category,
                    visibility,
                    steps: nextSteps.map((s) => ({
                      title: s.title,
                      detail: "",
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
