import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Camera, ImagePlus, PlusSquare, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { createGoal, GoalCategory, GoalVisibility } from "@/lib/ritmofit";
import { cn } from "@/lib/utils";
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
  visibility: z.enum(["Público", "Seguidores"]),
});

type Values = z.infer<typeof schema>;

const categories: { value: GoalCategory; label: string }[] = [
  { value: "Treino", label: "Treino" },
  { value: "Alimentação", label: "Alimentação" },
  { value: "Hábito", label: "Hábito" },
];

const visibilities: { value: GoalVisibility; label: string }[] = [
  { value: "Público", label: "Público" },
  { value: "Seguidores", label: "Seguidores" },
];

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
  const cameraInputRef = React.useRef<HTMLInputElement | null>(null);
  const galleryInputRef = React.useRef<HTMLInputElement | null>(null);
  const autoOpenedRef = React.useRef(false);

  React.useEffect(() => {
    // Tentativa de fluxo "camera-first".
    // Alguns navegadores bloqueiam abrir o seletor sem gesto do usuário; nesse caso, o botão fica disponível.
    if (autoOpenedRef.current) return;
    if (imageDataUrl) return;

    autoOpenedRef.current = true;
    const id = window.setTimeout(() => {
      cameraInputRef.current?.click();
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
      visibility: "Público",
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
      visibility: v.visibility,
    });

    toast({
      title: "Post publicado",
      description: "Seu post já aparece no feed para receber incentivo.",
    });

    navigate("/");
  };

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Nova postagem</h1>
          <p className="text-sm text-muted-foreground">
            Poste sua rotina do dia para receber incentivo dos seus amigos.
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/">Cancelar</Link>
        </Button>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Criar post (estilo Instagram)</CardTitle>
          <CardDescription>
            Adicione uma imagem (opcional) e descreva sua rotina/objetivo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="grid gap-5" onSubmit={form.handleSubmit(onSubmit)}>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={onPickFile}
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={onPickFile}
              />

              {!imageDataUrl ? (
                <div className="grid gap-4">
                  <div className="grid place-items-center rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 py-10 text-center">
                    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-background shadow-sm ring-1 ring-border/60">
                      <Camera className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <div className="mt-3 text-base font-semibold tracking-tight">
                      Comece pela foto
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Abra a câmera ou escolha uma imagem da galeria.
                    </div>

                    <div className="mt-5 grid w-full max-w-sm gap-2 sm:grid-cols-2">
                      <Button
                        type="button"
                        className="rounded-full gap-2"
                        onClick={() => cameraInputRef.current?.click()}
                      >
                        <Camera className="h-4 w-4" />
                        Câmera
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full gap-2"
                        onClick={() => galleryInputRef.current?.click()}
                      >
                        <ImagePlus className="h-4 w-4" />
                        Galeria
                      </Button>
                    </div>

                    <div className="mt-3 text-xs text-muted-foreground">
                      Depois de escolher a foto, aparecem os campos de título, legenda e configurações.
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium">Foto</div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-full gap-2"
                            onClick={() => cameraInputRef.current?.click()}
                          >
                            <Camera className="h-4 w-4" />
                            Câmera
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-full gap-2"
                            onClick={() => galleryInputRef.current?.click()}
                          >
                            <ImagePlus className="h-4 w-4" />
                            Galeria
                          </Button>
                        </div>
                      </div>

                      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border/60 bg-muted">
                        <img
                          src={imageDataUrl}
                          alt="Prévia da imagem do post"
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setImageDataUrl("");
                            autoOpenedRef.current = false;
                          }}
                          className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm ring-1 ring-border/60 transition hover:bg-background"
                          aria-label="Remover imagem"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-4">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Título</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ex: Treino do dia (pernas)"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Pense como uma postagem: curto, direto e específico.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

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
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categoria</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
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
                          <Select value={field.value} onValueChange={field.onChange}>
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="frequency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Frequência</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Diário" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="durationDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duração</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex flex-wrap justify-end gap-2 pt-2">
                    <Button type="submit" className="rounded-full gap-2">
                      <PlusSquare className="h-4 w-4" />
                      Publicar
                    </Button>
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
