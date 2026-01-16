import * as React from "react";
import { ImagePlus } from "lucide-react";

import { Goal, dayLabel, goalProgressPercent } from "@/lib/ritmofit";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/use-toast";

async function fileToDataUrl(file: File) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:${file.type};base64,${btoa(binary)}`;
}

export function CompleteTodayDialog({
  goal,
  open,
  onOpenChange,
  onComplete,
}: {
  goal: Goal;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onComplete: (next: {
    caption?: string;
    imageDataUrl?: string;
    incrementDays: number;
  }) => void;
}) {
  const [caption, setCaption] = React.useState(goal.caption ?? "");
  const [imageDataUrl, setImageDataUrl] = React.useState(goal.imageDataUrl ?? "");
  const [daysToAdd, setDaysToAdd] = React.useState(1);

  React.useEffect(() => {
    if (!open) return;
    setCaption(goal.caption ?? "");
    setImageDataUrl(goal.imageDataUrl ?? "");
    setDaysToAdd(1);
  }, [open, goal.caption, goal.imageDataUrl]);

  const pctNow = goalProgressPercent(goal);
  const pctAfter = goalProgressPercent({
    ...goal,
    completedDays: Math.min(goal.completedDays + daysToAdd, goal.durationDays),
  });

  const onPickFile: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Atualizar rotina</DialogTitle>
          <DialogDescription>
            Atualize seu progresso e, se quiser, atualize a foto e a legenda do post.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">{goal.title}</div>
              <div className="text-xs text-muted-foreground">
                {goal.completedDays}/{goal.durationDays} {dayLabel(goal.durationDays)}
              </div>
            </div>
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Agora: {pctNow}%</span>
                <span>Após: {pctAfter}%</span>
              </div>
              <Progress value={pctAfter} className="h-2" />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Adicionar:</span>
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDaysToAdd(n)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition",
                    daysToAdd === n
                      ? "border-brand/40 bg-brand text-white"
                      : "border-border/60 bg-background hover:bg-muted",
                  )}
                >
                  {n} dia{n > 1 ? "s" : ""}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium">Foto do post (opcional)</div>
              <label className="relative block cursor-pointer overflow-hidden rounded-2xl border border-dashed border-border/70 bg-muted/20">
                {imageDataUrl ? (
                  <img
                    src={imageDataUrl}
                    alt="Prévia da foto"
                    className="h-44 w-full object-cover"
                  />
                ) : (
                  <div className="grid h-44 place-items-center">
                    <div className="flex flex-col items-center gap-2 px-6 text-center">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-background shadow-sm ring-1 ring-border/60">
                        <ImagePlus className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Clique para adicionar/alterar a foto
                      </div>
                    </div>
                  </div>
                )}

                <Input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={onPickFile}
                />
              </label>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Legenda (opcional)</div>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Como foi hoje? O que você quer que a galera incentive?"
                className="min-h-[176px]"
              />
              <div className="text-xs text-muted-foreground">
                Dica: escreva uma frase curta. Ex: “Treino feito. Sem desculpas.”
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => {
              onComplete({ incrementDays: daysToAdd });
              onOpenChange(false);
            }}
          >
            Só atualizar progresso
          </Button>
          <Button
            className="rounded-full"
            onClick={() => {
              onComplete({
                caption,
                imageDataUrl,
                incrementDays: daysToAdd,
              });
              onOpenChange(false);
            }}
          >
            Atualizar rotina
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
