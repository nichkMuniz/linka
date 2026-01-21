import * as React from "react";

import { Check, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { toast } from "@/components/ui/use-toast";
import { createGoal, type Goal, type GoalVisibility } from "@/lib/ritmofit";
import { cn } from "@/lib/utils";

const NEEDS_GOAL_CHOICE_KEY = "ritmofit:needsGoalChoice";

type GoalPreset = {
  id: string;
  title: string;
  caption: string;
  imageUrl: string;
  category: Goal["category"];
  frequency: string;
  durationDays: 7 | 21 | 30;
  visibility: GoalVisibility;
};

const PRESETS: GoalPreset[] = [
  {
    id: "treino_21",
    title: "Treinar 3x/semana",
    caption: "Foco em consistência (sem perfeccionismo).",
    imageUrl: "https://images.pexels.com/photos/841130/pexels-photo-841130.jpeg",
    category: "Treino",
    frequency: "3x/semana",
    durationDays: 21,
    visibility: "Público",
  },
  {
    id: "agua_21",
    title: "Beber água (2L/dia)",
    caption: "Energia, humor e performance começam aqui.",
    imageUrl: "https://images.pexels.com/photos/416528/pexels-photo-416528.jpeg",
    category: "Hábito",
    frequency: "Todos os dias",
    durationDays: 21,
    visibility: "Público",
  },
  {
    id: "alimentacao_21",
    title: "Prato equilibrado no almoço",
    caption: "Proteína + carbo bom + salada.",
    imageUrl: "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg",
    category: "Alimentação",
    frequency: "Seg–Sex",
    durationDays: 21,
    visibility: "Público",
  },
  {
    id: "sono_30",
    title: "Dormir antes das 23h",
    caption: "Mais foco e recuperação (sem drama).",
    imageUrl: "https://images.pexels.com/photos/935777/pexels-photo-935777.jpeg",
    category: "Hábito",
    frequency: "Todos os dias",
    durationDays: 30,
    visibility: "Seguidores",
  },
  {
    id: "passos_21",
    title: "Caminhar 20 min",
    caption: "Movimento leve, todo dia, sem pressão.",
    imageUrl: "https://images.pexels.com/photos/2402777/pexels-photo-2402777.jpeg",
    category: "Hábito",
    frequency: "Todos os dias",
    durationDays: 21,
    visibility: "Público",
  },
];

function BrandHeader({ selectedCount }: { selectedCount: number }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <div className="relative grid h-10 w-10 place-items-center rounded-2xl bg-brand shadow-sm ring-1 ring-brand/30">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-foreground">
          <span className="text-sm font-semibold text-white">RF</span>
        </div>
        <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-brand-2 ring-2 ring-background" />
      </div>
      <div className="leading-tight">
        <div className="flex items-center justify-center gap-2 text-base font-semibold tracking-tight text-foreground">
          Ritmo<span className="text-brand">Fit</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            {selectedCount} selecionada{selectedCount === 1 ? "" : "s"}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          Escolha suas primeiras metas (pode marcar mais de uma)
        </div>
      </div>
    </div>
  );
}

function PresetCard({
  preset,
  selected,
  onToggle,
}: {
  preset: GoalPreset;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(preset.id)}
      className={cn(
        "group relative w-full overflow-hidden rounded-3xl border text-left transition",
        "border-border/60 bg-background/60 hover:bg-muted/10",
        selected ? "ring-2 ring-brand/25" : null,
      )}
    >
      <div className="relative">
        <AspectRatio ratio={16 / 9}>
          <img
            src={preset.imageUrl}
            alt={preset.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            className={cn(
              "h-full w-full object-cover transition duration-300",
              "group-hover:scale-[1.02]",
            )}
          />
        </AspectRatio>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/85 via-background/30 to-transparent" />

        <div className="absolute right-3 top-3">
          <div
            className={cn(
              "grid h-8 w-8 place-items-center rounded-full border backdrop-blur",
              selected
                ? "border-brand bg-brand text-white"
                : "border-border/60 bg-background/70 text-muted-foreground",
            )}
            aria-hidden="true"
          >
            <Check className="h-4 w-4" />
          </div>
        </div>

        <div className="absolute bottom-3 left-3 right-3">
          <div className="text-sm font-semibold text-foreground">
            {preset.title}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">{preset.caption}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 p-4 pt-3">
        <Badge variant="secondary" className="rounded-full">
          {preset.category}
        </Badge>
        <Badge variant="outline" className="rounded-full">
          {preset.frequency}
        </Badge>
        <Badge variant="outline" className="rounded-full">
          {preset.durationDays} dias
        </Badge>
        <Badge variant="outline" className="rounded-full">
          {preset.visibility}
        </Badge>
      </div>
    </button>
  );
}

export default function ChooseGoal() {
  const navigate = useNavigate();

  const [selectedIds, setSelectedIds] = React.useState<string[]>(
    PRESETS[0]?.id ? [PRESETS[0].id] : [],
  );
  const [busy, setBusy] = React.useState(false);

  const selectedPresets = React.useMemo(
    () => PRESETS.filter((p) => selectedIds.includes(p.id)),
    [selectedIds],
  );

  const onToggle = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  };

  const onConfirm = () => {
    if (busy) return;

    if (!selectedPresets.length) {
      toast({
        title: "Escolha pelo menos uma meta",
        description: "Marque uma ou mais metas para começar.",
      });
      return;
    }

    setBusy(true);
    try {
      for (const preset of selectedPresets) {
        createGoal({
          title: preset.title,
          caption: preset.caption,
          category: preset.category,
          frequency: preset.frequency,
          durationDays: preset.durationDays,
          visibility: preset.visibility,
        });
      }

      localStorage.removeItem(NEEDS_GOAL_CHOICE_KEY);

      toast({
        title:
          selectedPresets.length === 1
            ? "Meta criada"
            : `${selectedPresets.length} metas criadas`,
        description: "Tudo pronto. Bora manter o ritmo.",
      });

      navigate("/", { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-dvh bg-background">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-brand-2/10 blur-3xl" />
      </div>

      <div className="relative grid min-h-dvh place-items-center p-6">
        <div className="mx-auto grid w-full max-w-5xl gap-6">
          <BrandHeader selectedCount={selectedPresets.length} />

          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              Suas metas iniciais
            </h1>
            <p className="text-sm text-muted-foreground">
              Escolha algumas metas prontas para começar hoje. Depois você cria outras
              do seu jeito.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PRESETS.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                selected={selectedIds.includes(preset.id)}
                onToggle={onToggle}
              />
            ))}
          </div>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Continuar</CardTitle>
              <CardDescription>
                Vamos criar suas metas e abrir a Home para você começar a postar e
                receber incentivo.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {selectedPresets.length ? (
                  selectedPresets.map((p) => (
                    <Badge key={p.id} variant="secondary" className="rounded-full">
                      {p.title}
                    </Badge>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Nenhuma meta selecionada.
                  </div>
                )}
              </div>

              <Button
                type="button"
                className="rounded-full"
                disabled={!selectedPresets.length || busy}
                onClick={onConfirm}
              >
                {busy
                  ? "Criando…"
                  : selectedPresets.length === 1
                    ? "Começar"
                    : `Começar (${selectedPresets.length})`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
