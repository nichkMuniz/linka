import * as React from "react";
import { Plus, Trash2, Search, Check } from "lucide-react";

import type { GoalCategory, GoalVisibility, Routine, WorkoutExercise } from "@/lib/ritmofit";
import {
  createRoutine,
  uid,
  updateRoutine,
  WORKOUT_EXERCISES,
  WORKOUT_MUSCLE_GROUPS,
} from "@/lib/ritmofit";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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

type ItemDraft = {
  id: string;
  name: string;
  exerciseId?: string;
  muscleGroup?: string;
  imageUrl?: string;
};

const categoryOptions: Array<{ value: GoalCategory; label: string }> = [
  { value: "Treino", label: "Treino" },
  { value: "Alimentação", label: "Alimentação" },
  { value: "Hábito", label: "Hábito" },
];

const visibilityOptions: Array<{ value: GoalVisibility; label: string }> = [
  { value: "Público", label: "Público" },
  { value: "Seguidores", label: "Seguidores" },
];

const suggestions: Record<Exclude<GoalCategory, "Treino">, string[]> = {
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
      help: "Escolha por grupo muscular (com imagem) ou adicione manualmente.",
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

function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function exerciseMatches(ex: WorkoutExercise, query: string) {
  const q = norm(query.trim());
  if (!q) return true;
  return norm(ex.name).includes(q) || norm(ex.muscleGroup).includes(q);
}

function WorkoutExerciseCard({
  exercise,
  selected,
  onToggle,
}: {
  exercise: WorkoutExercise;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "group flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3 text-left transition-colors hover:bg-muted/30",
        selected ? "bg-brand/10 ring-2 ring-brand/30" : null,
      )}
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-1 ring-border/60">
        <img
          src={exercise.imageUrl}
          alt={exercise.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        {selected ? (
          <span className="absolute bottom-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-brand text-white shadow-sm ring-2 ring-background">
            <Check className="h-4 w-4" />
          </span>
        ) : null}
      </div>

      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{exercise.name}</div>
        <div className="text-xs text-muted-foreground">{exercise.muscleGroup}</div>
      </div>
    </button>
  );
}

function WorkoutPicker({
  selectedItems,
  onToggleExercise,
  onAddCustom,
}: {
  selectedItems: ItemDraft[];
  onToggleExercise: (ex: WorkoutExercise) => void;
  onAddCustom: (name: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [custom, setCustom] = React.useState("");

  const selectedByExerciseId = React.useMemo(() => {
    const set = new Set<string>();
    for (const it of selectedItems) {
      if (it.exerciseId) set.add(it.exerciseId);
    }
    return set;
  }, [selectedItems]);

  const filtered = React.useMemo(() => {
    return WORKOUT_EXERCISES.filter((ex) => exerciseMatches(ex, query));
  }, [query]);

  const byGroup = React.useMemo(() => {
    const map = new Map<string, WorkoutExercise[]>();
    for (const g of WORKOUT_MUSCLE_GROUPS) map.set(g, []);
    for (const ex of filtered) {
      const arr = map.get(ex.muscleGroup) ?? [];
      arr.push(ex);
      map.set(ex.muscleGroup, arr);
    }
    return map;
  }, [filtered]);

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <div className="text-sm font-medium">Selecionados</div>
        {selectedItems.length ? (
          <div className="flex flex-wrap gap-2">
            {selectedItems.map((it) => (
              <div
                key={it.id}
                className="flex items-center gap-2 rounded-full bg-muted/40 py-1 pl-1 pr-2 text-xs ring-1 ring-border/60"
              >
                {it.imageUrl ? (
                  <img
                    src={it.imageUrl}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-background text-[10px] font-semibold ring-1 ring-border/60">
                    EX
                  </div>
                )}
                <span className="max-w-[10rem] truncate">{it.name}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full"
                  aria-label={`Remover ${it.name}`}
                  onClick={() => onToggleExercise({
                    id: it.exerciseId ?? it.id,
                    name: it.name,
                    muscleGroup: (it.muscleGroup ?? "Peito") as any,
                    imageUrl: it.imageUrl ?? "",
                  })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
            Nenhum exercício ainda. Selecione abaixo.
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <div className="text-sm font-medium">Buscar</div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex: peito, supino, costas..."
            className="pl-9"
          />
        </div>
      </div>

      <Accordion
        type="multiple"
        defaultValue={WORKOUT_MUSCLE_GROUPS.slice(0, 3)}
        className="rounded-2xl border border-border/60"
      >
        {WORKOUT_MUSCLE_GROUPS.map((group) => {
          const list = byGroup.get(group) ?? [];
          if (!list.length) return null;

          return (
            <AccordionItem key={group} value={group} className="border-border/60 px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex w-full items-center justify-between gap-3">
                  <div className="text-sm font-semibold">{group}</div>
                  <div className="text-xs text-muted-foreground">{list.length} opções</div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-2 md:grid-cols-2">
                  {list.map((ex) => (
                    <WorkoutExerciseCard
                      key={ex.id}
                      exercise={ex}
                      selected={selectedByExerciseId.has(ex.id)}
                      onToggle={() => onToggleExercise(ex)}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <div className="grid gap-2">
        <div className="text-sm font-medium">Adicionar manualmente</div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Ex: Barra fixa supinada"
          />
          <Button
            type="button"
            className="rounded-full"
            onClick={() => {
              const trimmed = custom.trim();
              if (!trimmed) return;
              onAddCustom(trimmed);
              setCustom("");
            }}
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          Use isso se não encontrar na lista.
        </div>
      </div>
    </div>
  );
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

    const nextCategory = routine?.category ?? "Treino";

    setTitle(routine?.title ?? "");
    setCategory(nextCategory);
    setVisibility(routine?.visibility ?? "Público");

    const nextItems: ItemDraft[] = (routine?.steps ?? []).map((s) => ({
      id: s.id,
      name: s.title,
      exerciseId: s.exerciseId,
      muscleGroup: s.muscleGroup,
      imageUrl: s.imageUrl,
    }));

    if (nextCategory === "Treino") {
      setItems(nextItems);
      return;
    }

    setItems(nextItems.length ? nextItems : [{ id: uid("ri"), name: "" }]);
  }, [open, routine]);

  const canSave = title.trim().length >= 2;
  const meta = itemsMeta(category);
  const datalistId = `ritmofit-${category}-items`;

  const toggleExercise = React.useCallback((ex: WorkoutExercise) => {
    setItems((prev) => {
      const existing = prev.find((p) => p.exerciseId === ex.id);
      if (existing) return prev.filter((p) => p.id !== existing.id);

      return [
        ...prev,
        {
          id: uid("ri"),
          name: ex.name,
          exerciseId: ex.id,
          muscleGroup: ex.muscleGroup,
          imageUrl: ex.imageUrl,
        },
      ];
    });
  }, []);

  const addCustomWorkoutItem = React.useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setItems((prev) => [...prev, { id: uid("ri"), name: trimmed }]);
  }, []);

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
            <div>
              <div className="text-sm font-medium">{meta.label}</div>
              <div className="text-xs text-muted-foreground">{meta.help}</div>
            </div>

            {category === "Treino" ? (
              <WorkoutPicker
                selectedItems={items}
                onToggleExercise={toggleExercise}
                onAddCustom={addCustomWorkoutItem}
              />
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">Lista</div>

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
                              prev.map((p) =>
                                p.id === it.id ? { ...p, name: v } : p,
                              ),
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

                {category !== "Treino" ? (
                  <datalist id={datalistId}>
                    {suggestions[category as Exclude<GoalCategory, "Treino">].map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                ) : null}
              </>
            )}
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
                  .map((i) => ({
                    id: i.id,
                    title: i.name.trim(),
                    detail: "",
                    exerciseId: i.exerciseId,
                    muscleGroup: i.muscleGroup,
                    imageUrl: i.imageUrl,
                  }))
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
                      exerciseId: s.exerciseId,
                      muscleGroup: s.muscleGroup,
                      imageUrl: s.imageUrl,
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
