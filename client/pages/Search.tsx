import * as React from "react";
import { Dumbbell, Search as SearchIcon, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type SearchResult =
  | {
      type: "user";
      name: string;
      handle: string;
      bio: string;
    }
  | {
      type: "workout";
      title: string;
      subtitle: string;
      tags: string[];
    };

const seed: SearchResult[] = [
  {
    type: "user",
    name: "Ana",
    handle: "@ana.fit",
    bio: "Foco em hábitos e constância. Água, sono e disciplina.",
  },
  {
    type: "user",
    name: "Bruno",
    handle: "@bruno.nutri",
    bio: "Nutrição simples, consistente e sem terrorismo.",
  },
  {
    type: "workout",
    title: "Treino A (peito + tríceps)",
    subtitle: "45–60 min · intermediário",
    tags: ["hipertrofia", "academia"],
  },
  {
    type: "workout",
    title: "Treino B (pernas)",
    subtitle: "50–70 min · pesado",
    tags: ["força", "pernas"],
  },
  {
    type: "workout",
    title: "Rotina de água 2L",
    subtitle: "Checklist diário",
    tags: ["hábito", "saúde"],
  },
];

function AvatarCircle({ label }: { label: string }) {
  return (
    <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-brand-3 via-brand to-brand-2 text-sm font-semibold text-white shadow-sm ring-1 ring-brand/20">
      {label}
    </div>
  );
}

export default function Search() {
  const [q, setQ] = React.useState("");

  const results = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return seed;

    return seed.filter((r) => {
      if (r.type === "user") {
        return (
          r.name.toLowerCase().includes(term) ||
          r.handle.toLowerCase().includes(term) ||
          r.bio.toLowerCase().includes(term)
        );
      }
      return (
        r.title.toLowerCase().includes(term) ||
        r.subtitle.toLowerCase().includes(term) ||
        r.tags.some((t) => t.toLowerCase().includes(term))
      );
    });
  }, [q]);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Buscar</h1>
        <p className="text-sm text-muted-foreground">
          Pesquise por pessoas, treinos e hábitos.
        </p>
      </div>

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Digite um nome, @usuário ou treino..."
          className="h-11 rounded-full pl-10"
        />
      </div>

      <div className="grid gap-3">
        {results.map((r, idx) => {
          if (r.type === "user") {
            return (
              <Card key={`${r.handle}_${idx}`} className="border-border/60">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <AvatarCircle label={r.name.slice(0, 1).toUpperCase()} />
                    <div className="leading-tight">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.handle}</div>
                      </div>
                      <div className="text-sm text-muted-foreground">{r.bio}</div>
                    </div>
                  </div>
                  <Button variant="outline" className="rounded-full">
                    Seguir
                  </Button>
                </CardContent>
              </Card>
            );
          }

          return (
            <Card key={`${r.title}_${idx}`} className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Dumbbell className="h-4 w-4 text-brand" />
                  {r.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">{r.subtitle}</div>
                <div className="flex flex-wrap gap-2">
                  {r.tags.map((t) => (
                    <span
                      key={t}
                      className={cn(
                        "rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground",
                      )}
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button className="rounded-full gap-2">
                    <User className="h-4 w-4" />
                    Ver criadores
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
