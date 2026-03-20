import * as React from "react";
import { ShoppingBag, Dumbbell, Trophy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const COMING_SOON_FEATURES = [
  {
    icon: <ShoppingBag className="h-6 w-6 text-brand" />,
    title: "Equipamentos Fitness",
    description: "Pesos, elásticos, tapetes e acessórios para seu treino",
  },
  {
    icon: <Zap className="h-6 w-6 text-yellow-500" />,
    title: "Suplementos & Nutrição",
    description: "Proteínas, vitaminas e produtos para complementar sua dieta",
  },
  {
    icon: <Trophy className="h-6 w-6 text-emerald-500" />,
    title: "Planos Premium",
    description: "Desbloqueie metas ilimitadas, rotinas avançadas e análises detalhadas",
  },
  {
    icon: <Dumbbell className="h-6 w-6 text-blue-500" />,
    title: "Programas de Treino",
    description: "Planos criados por personal trainers parceiros",
  },
];

export default function Store() {
  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-brand/10 border border-brand/20 mx-auto">
          <ShoppingBag className="h-8 w-8 text-brand" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Loja RitmoFit</h1>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Estamos preparando algo incrível para você. Em breve, tudo que você precisa
          para alcançar seus objetivos em um só lugar.
        </p>
        <span className="inline-block bg-brand/10 text-brand text-xs font-semibold px-3 py-1 rounded-full border border-brand/20">
          Em breve
        </span>
      </div>

      {/* Features preview */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          O que vem por aí
        </p>
        <div className="grid gap-3">
          {COMING_SOON_FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-4 p-4 rounded-lg border border-border/60 bg-muted/20"
            >
              <div className="flex-shrink-0 mt-0.5">{feature.icon}</div>
              <div>
                <p className="text-sm font-semibold">{feature.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center space-y-3 pt-2">
        <p className="text-xs text-muted-foreground">
          Quer ser notificado quando a loja abrir?
        </p>
        <Button variant="outline" className="rounded-full" disabled>
          Me avise quando abrir
        </Button>
      </div>
    </div>
  );
}
