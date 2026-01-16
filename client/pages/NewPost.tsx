import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Clock,
  Dumbbell,
  Droplets,
  Hourglass,
  ImagePlus,
  PlusSquare,
  Repeat,
  Timer,
  Utensils,
  X,
  ArrowLeft,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { createGoal, GoalCategory } from "@/lib/ritmofit";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";

const schema = z.object({
  title: z
    .string()
    .min(4, "Escreva um título curto (ex: Treino de hoje)")
    .max(80, "Título muito longo"),
  caption: z.string().max(280, "Legenda muito longa").optional(),
  category: z.enum(["Treino", "Alimentação", "Hábito"]),
  frequency: z
    .string()
    .min(2, "Ex: Diário, 5x/semana, Seg–Sex")
    .max(30, "Muito longo"),
  durationDays: z.enum(["7", "21", "30"]),
});

type Values = z.infer<typeof schema>;

const categories: { value: GoalCategory; label: string }[] = [
  { value: "Treino", label: "Treino" },
  { value: "Alimentação", label: "Alimentação" },
  { value: "Hábito", label: "Hábito" },
];

const categoryIcon: Record<GoalCategory, React.ComponentType<{ className?: string }>> = {
  Treino: Dumbbell,
  Alimentação: Utensils,
  Hábito: Droplets,
};

const durationMeta: Record<
  Values["durationDays"],
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  "7": { label: "7 dias", Icon: Clock },
  "21": { label: "21 dias", Icon: Timer },
  "30": { label: "30 dias", Icon: Hourglass },
};

async function fileToDataUrl(file: File) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:${file.type};base64,${btoa(binary)}`;
}

export default function NewPost() {
  const navigate = useNavigate();
  const [imageDataUrl, setImageDataUrl] = React.useState<string>("");
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const autoOpenedRef = React.useRef(false);

  React.useEffect(() => {
    // Tentativa de fluxo "camera-first".
    // Alguns navegadores bloqueiam abrir o seletor sem gesto do usuário; nesse caso, o botão fica disponível.
    if (autoOpenedRef.current) return;
    if (imageDataUrl) return;

    autoOpenedRef.current = true;
    const id = window.setTimeout(() => {
      fileInputRef.current?.click();
    }, 350);

    return () => window.clearTimeout(id);
  }, [imageDataUrl]);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      caption: "",
      category: "Treino",
      frequency: "Diário",
      durationDays: "21",
    },
  });

  const onPickFile: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    // permite selecionar o mesmo arquivo novamente depois
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Arquivo inválido",
        description: "Selecione uma imagem (jpg, png, etc).",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 2_500_000) {
      toast({
        title: "Imagem muito grande",
        description: "Use uma imagem menor (até ~2,5MB) para o protótipo.",
        variant: "destructive",
      });
      return;
    }

    const dataUrl = await fileToDataUrl(file);
    setImageDataUrl(dataUrl);

    // melhora o fluxo: após escolher foto, o usuário vai direto para os campos
    window.setTimeout(() => form.setFocus("title"), 50);
  };

  const onSubmit = (v: Values) => {
    if (!imageDataUrl) {
      toast({
        title: "Adicione uma foto",
        description: "Para este MVP, o post começa pela imagem (estilo Instagram).",
        variant: "destructive",
      });
      return;
    }

    createGoal({
      title: v.title,
      caption: v.caption ?? "",
      imageDataUrl,
      category: v.category,
      frequency: v.frequency,
      durationDays: Number(v.durationDays) as 7 | 21 | 30,
      visibility: "Público",
    });

    toast({
      title: "Post publicado",
      description: "Seu post já aparece no feed para receber incentivo.",
    });

    navigate("/");
  };

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      {!imageDataUrl ? (
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Nova postagem</h1>
            <p className="text-sm text-muted-foreground">
              Poste sua rotina do dia para receber incentivo dos seus amigos.
            </p>
          </div>
          <Button asChild variant="ghost" size="icon" className="h-11 w-11 rounded-full">
            <Link to="/" aria-label="Cancelar">
              <X className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-full"
            aria-label="Voltar"
            onClick={() => {
              setImageDataUrl("");
              autoOpenedRef.current = false;
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <Button asChild variant="ghost" size="icon" className="h-11 w-11 rounded-full">
            <Link to="/" aria-label="Cancelar">
              <X className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      )}

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">
            {!imageDataUrl ? "Criar post" : "Completar postagem"}
          </CardTitle>
          <CardDescription>
            {!imageDataUrl
              ? "1) Escolha uma foto. 2) Depois preencha os detalhes."
              : "Foto selecionada — confira a miniatura e publique."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="grid gap-5" onSubmit={form.handleSubmit(onSubmit)}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={onPickFile}
              />

              {!imageDataUrl ? (
                <div className="grid gap-4">
                  <div className="grid place-items-center rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 py-10 text-center">
                    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-background shadow-sm ring-1 ring-border/60">
                      <ImagePlus className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <div className="mt-3 text-base font-semibold tracking-tight">
                      Comece pela foto
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Selecione uma imagem para publicar sua rotina.
                    </div>

                    <div className="mt-5 w-full max-w-sm">
                      <Button
                        type="button"
                        className="w-full rounded-full gap-2"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <ImagePlus className="h-4 w-4" />
                        Escolher foto
                      </Button>
                    </div>

                    <div className="mt-3 text-xs text-muted-foreground">
                      Depois de escolher a foto, aparecem os campos de título, legenda e configurações.
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid gap-5">
                    <div className="grid gap-3 md:grid-cols-[auto_1fr] md:items-start">
                      <div className="relative h-20 w-20">
                        <img
                          src={imageDataUrl}
                          alt="Miniatura da foto"
                          className="h-20 w-20 rounded-2xl object-cover ring-1 ring-border/60"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setImageDataUrl("");
                            autoOpenedRef.current = false;
                          }}
                          className="absolute -right-1 -top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-background/95 text-foreground shadow-sm ring-1 ring-border/60 transition hover:bg-background"
                          aria-label="Remover imagem"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="grid gap-3">
                        <FormField
                          control={form.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Título</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: Treino do dia (pernas)" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-full gap-2"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <ImagePlus className="h-4 w-4" />
                            Trocar foto
                          </Button>
                        </div>
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="caption"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Legenda</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Ex: Hoje foi difícil, mas eu apareci. 1% melhor."
                              className="min-h-[120px]"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Conte como foi e o que você quer que as pessoas incentivem.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid gap-4 md:grid-cols-3">
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => {
                          const Icon = categoryIcon[field.value];

                          return (
                            <FormItem>
                              <FormLabel>Categoria</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger>
                                    <div className="flex items-center gap-2">
                                      <Icon className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm">{field.value}</span>
                                    </div>
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {categories.map((c) => {
                                    const ItemIcon = categoryIcon[c.value];
                                    return (
                                      <SelectItem key={c.value} value={c.value}>
                                        <span className="flex items-center gap-2">
                                          <ItemIcon className="h-4 w-4 text-muted-foreground" />
                                          {c.label}
                                        </span>
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />

                      <FormField
                        control={form.control}
                        name="frequency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Frequência</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Repeat className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input className="pl-9" placeholder="Ex: Diário" {...field} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="durationDays"
                        render={({ field }) => {
                          const Icon = durationMeta[field.value].Icon;

                          return (
                            <FormItem>
                              <FormLabel>Duração</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger>
                                    <div className="flex items-center gap-2">
                                      <Icon className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm">{durationMeta[field.value].label}</span>
                                    </div>
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {Object.entries(durationMeta).map(([value, meta]) => (
                                    <SelectItem key={value} value={value}>
                                      <span className="flex items-center gap-2">
                                        <meta.Icon className="h-4 w-4 text-muted-foreground" />
                                        {meta.label}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                    </div>

                    <div className="flex flex-wrap justify-center gap-2 pt-2">
                      <Button type="submit" className="w-full max-w-sm rounded-full gap-2">
                        <PlusSquare className="h-4 w-4" />
                        Publicar
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
