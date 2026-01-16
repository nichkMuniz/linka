import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Check, ChevronLeft, Plus, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { createGoal, GoalCategory, GoalVisibility } from "@/lib/ritmofit";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

const schema = z.object({
  title: z
    .string()
    .min(6, "Escreva um tdtulo com pelo menos 6 caracteres")
    .max(80, "Tdtulo muito longo"),
  category: z.enum(["Treino", "Alimentação", "Hábito"]),
  frequency: z
    .string()
    .min(2, "Ex: Diário, 5x/semana, Seg–Sex")
    .max(30, "Muito longo"),
  durationDays: z.enum(["7", "21", "30"]),
  visibility: z.enum(["Público", "Seguidores"]),
});

type Values = z.infer<typeof schema>;

const categories: { value: GoalCategory; label: string; hint: string }[] = [
  { value: "Treino", label: "Treino", hint: "Treinos e constância" },
  {
    value: "Alimentação",
    label: "Alimentação",
    hint: "Refeições e disciplina",
  },
  { value: "Hábito", label: "Hábito", hint: "Água, sono e rotina" },
];

const visibilities: { value: GoalVisibility; label: string; hint: string }[] = [
  {
    value: "Público",
    label: "Público",
    hint: "Qualquer pessoa pode ver e incentivar",
  },
  {
    value: "Seguidores",
    label: "Seguidores",
    hint: "Apenas seguidores podem ver",
  },
];

function PreviewItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

export default function CreateGoal() {
  const navigate = useNavigate();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      category: "Treino",
      frequency: "Diário",
      durationDays: "21",
      visibility: "Público",
    },
  });

  const values = form.watch();

  const onSubmit = (v: Values) => {
    createGoal({
      title: v.title,
      category: v.category,
      frequency: v.frequency,
      durationDays: Number(v.durationDays) as 7 | 21 | 30,
      visibility: v.visibility,
    });

    toast({
      title: "Meta criada",
      description: "Agora ela aparece no feed para receber incentivo.",
    });

    navigate("/");
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_0.9fr] md:items-start">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button
                asChild
                size="sm"
                variant="ghost"
                className="rounded-full"
              >
                <Link to="/">
                  <ChevronLeft className="h-4 w-4" />
                  Voltar
                </Link>
              </Button>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Criar postagem (meta)
            </h1>
            <p className="text-sm text-muted-foreground">
              Disciplina n3o 9 motiva73o. 9 sistema.
            </p>
          </div>
        </div>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Campos</CardTitle>
            <CardDescription>
              Tdtulo, categoria, frequancia, dura73o e visibilidade.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                className="grid gap-4"
                onSubmit={form.handleSubmit(onSubmit)}
              >
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tdtulo da meta</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Treinar 4x por semana"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Escreva algo objetivo e f1cil de acompanhar diariamente.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {
                            categories.find((c) => c.value === field.value)
                              ?.hint
                          }
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="frequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frequancia</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: 5x/semana" {...field} />
                        </FormControl>
                        <FormDescription>
                          Ajuda a pessoa a saber exatamente o que cumprir.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="durationDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dura73o</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="7">7 dias</SelectItem>
                            <SelectItem value="21">21 dias</SelectItem>
                            <SelectItem value="30">30 dias</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Ciclos curtos ajudam na consistancia e prova social.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="visibility"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Visibilidade</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {visibilities.map((v) => (
                              <SelectItem key={v.value} value={v.value}>
                                {v.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {
                            visibilities.find((v) => v.value === field.value)
                              ?.hint
                          }
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button type="submit" className="rounded-full gap-2">
                    <Plus className="h-4 w-4" />
                    Publicar meta
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => {
                      form.reset();
                      toast({
                        title: "Formul1rio limpo",
                        description: "Pronto para criar outra meta.",
                      });
                    }}
                  >
                    Limpar
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="border-t border-border/60 bg-muted/30">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="h-4 w-4 text-emerald-500" />
              Dica: comece oferecendo acesso gratuito para testes e feedback.
            </div>
          </CardFooter>
        </Card>
      </div>

      <aside className="space-y-4">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Preview do card</CardTitle>
            <CardDescription>
              Como esta meta vai aparecer no feed (estilo Instagram).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-sm font-semibold text-white shadow-sm ring-1 ring-emerald-500/20">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold">Voca</div>
                <div className="text-xs text-muted-foreground">@voce</div>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="space-y-1">
                <div className="text-sm font-semibold">
                  {values.title?.trim()
                    ? values.title
                    : "Sua meta vai aparecer aqui"}
                </div>
                <div className="text-xs text-muted-foreground">
                  0/{values.durationDays} dias 7 0%
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-[0%] rounded-full bg-emerald-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <PreviewItem label="Categoria" value={values.category} />
                <PreviewItem label="Frequancia" value={values.frequency} />
                <PreviewItem
                  label="Dura73o"
                  value={`${values.durationDays} dias`}
                />
                <PreviewItem label="Visibilidade" value={values.visibility} />
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {["Te apoio", "Continua", "Orgulho"].map((t) => (
                  <span
                    key={t}
                    className={cn(
                      "rounded-full border border-border/60 bg-background px-3 py-1 text-xs text-muted-foreground",
                    )}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">
              Pr3ximos passos (Fase 2)
            </CardTitle>
            <CardDescription>
              Seguir pessoas, notifica75es e streak autom1tico.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Quando voca quiser tornar isso real (login + banco de dados), a
              melhor integra73o 9 com Supabase.
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-full"
              onClick={() =>
                toast({
                  title: "Supabase",
                  description:
                    "Conecte Supabase via MCP e eu crio login + tabelas para metas, progresso e incentivos.",
                })
              }
            >
              Entender integra73o
            </Button>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
