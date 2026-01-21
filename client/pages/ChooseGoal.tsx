import * as React from "react";

import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createGoal, type Goal, type GoalVisibility } from "@/lib/ritmofit";
import { toast } from "@/components/ui/use-toast";

const NEEDS_GOAL_CHOICE_KEY = "ritmofit:needsGoalChoice";

type GoalPreset = {
  id: string;
  title: string;
  caption: string;
  category: Goal["category"];
  frequency: string;
  durationDays: 7 | 21 | 30;
  visibility: GoalVisibility;
};

const PRESETS: GoalPreset[] = [
  {
    id: "treino_21",
    title: "Treinar 3x por semana",
    caption: "Comece com consistência. Pouco, mas sem falhar.",
    category: "Treino",
    frequency: "3x/semana",
    durationDays: 21,
    visibility: "Público",
  },
  {
    id: "agua_21",
    title: "Beber 2L de água por dia",
    caption: "Hidratação muda energia, humor e performance.",
    category: "Hidratação",
    frequency: "Todos os dias",
    durationDays: 21,
    visibility: "Público",
  },
  {
    id: "alimentacao_21",
    title: "Montar prato equilibrado no almoço",
    caption: "Proteína + carbo bom + salada. Constância > perfeição.",
    category: "Alimentação",
    frequency: "Seg–Sex",
    durationDays: 21,
    visibility: "Público",
  },
  {
    id: "sono_30",
    title: "Dormir antes das 23h",
    caption: "Sono é o atalho mais subestimado para resultados.",
    category: "Hidratação",
    frequency: "Todos os dias",
    durationDays: 30,
    visibility: "Seguidores",
  },
];

function BrandHeader() {
  return (
    <div className="flex items-center justify-center gap-3">
      <div className="relative grid h-10 w-10 place-items-center rounded-2xl bg-brand shadow-sm ring-1 ring-brand/30">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-foreground">
          <span className="text-sm font-semibold text-white">RF</span>
        </div>
        <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-brand-2 ring-2 ring-background" />
      </div>
      <div className="leading-tight">
        <div className="text-base font-semibold tracking-tight text-foreground">
          Ritmo<span className="text-brand">Fit</span>
        </div>
        <div className="text-xs text-muted-foreground">Escolha sua primeira meta</div>
      </div>
    </div>
  );
}

export default function ChooseGoal() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = React.useState<string>(PRESETS[0]?.id ?? "");
  const [busy, setBusy] = React.useState(false);

  const selected = React.useMemo(
    () => PRESETS.find((p) => p.id === selectedId) ?? null,
    [selectedId],
  );

  return (
    <div className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="mx-auto grid w-full max-w-2xl gap-6">
        <BrandHeader />

        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Escolha uma meta</h1>
          <p className="text-sm text-muted-foreground">
            Selecione uma meta pré pronta para começar. Você pode criar outras depois.
          </p>
        </div>

        <div className="grid gap-3">
          {PRESETS.map((p) => {
            const active = p.id === selectedId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "w-full rounded-3xl border border-border/60 bg-background/60 p-4 text-left transition",
                  "hover:bg-muted/10",
                  active ? "ring-2 ring-brand/25" : null,
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{p.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{p.caption}</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {p.category} · {p.frequency} · {p.durationDays} dias · {p.visibility}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "mt-1 h-5 w-5 shrink-0 rounded-full border",
                      active ? "border-brand bg-brand" : "border-border/60",
                    )}
                    aria-hidden="true"
                  />
                </div>
              </button>
            );
          })}
        </div>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Continuar</CardTitle>
            <CardDescription>
              Quando você confirmar, vamos criar essa meta e abrir a Home.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              className="rounded-full"
              disabled={!selected || busy}
              onClick={() => {
                if (!selected || busy) return;
                setBusy(true);
                try {
                  createGoal({
                    title: selected.title,
                    caption: selected.caption,
                    category: selected.category,
                    frequency: selected.frequency,
                    durationDays: selected.durationDays,
                    visibility: selected.visibility,
                  });

                  localStorage.removeItem(NEEDS_GOAL_CHOICE_KEY);

                  toast({
                    title: "Meta criada",
                    description: "Tudo pronto. Bora manter o ritmo.",
                  });
                  navigate("/", { replace: true });
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Criando…" : "Começar"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
