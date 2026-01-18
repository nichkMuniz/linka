import * as React from "react";
import { Plus, Image as ImageIcon } from "lucide-react";

import type { StoryGroup } from "@/lib/ritmofit";
import { addStoryItem, getStories } from "@/lib/ritmofit";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { StoryViewerDialog } from "@/components/story-viewer-dialog";

function initials(name: string) {
  const parts = name.trim().split(/\s+/g);
  return (
    (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase()
  );
}

function safeStorageGet(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

const SEEN_KEY = "ritmofit:stories-seen:v1";

function isSeen(ownerHandle: string) {
  const raw = safeStorageGet(SEEN_KEY);
  if (!raw) return false;
  try {
    const obj = JSON.parse(raw) as Record<string, string>;
    return Boolean(obj[ownerHandle]);
  } catch {
    return false;
  }
}

async function fileToDataUrl(file: File) {
  const reader = new FileReader();
  const promise = new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Falha ao ler imagem"));
  });
  reader.readAsDataURL(file);
  return promise;
}

export function StoriesBar() {
  const [stories, setStories] = React.useState<StoryGroup[]>([]);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string>("");
  const [caption, setCaption] = React.useState("");

  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [activeStory, setActiveStory] = React.useState<StoryGroup | null>(null);

  React.useEffect(() => {
    setStories(getStories());
  }, []);

  React.useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }

    let canceled = false;
    fileToDataUrl(file)
      .then((url) => {
        if (canceled) return;
        setPreviewUrl(url);
      })
      .catch(() => {
        if (canceled) return;
        toast({
          title: "Erro",
          description: "Não conseguimos carregar a imagem.",
        });
        setFile(null);
      });

    return () => {
      canceled = true;
    };
  }, [file]);

  const openStory = (s: StoryGroup) => {
    setActiveStory(s);
    setViewerOpen(true);
  };

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Stories</div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="rounded-full"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </div>

      <div className="flex flex-nowrap gap-3 overflow-x-auto pb-1">
        <button
          type="button"
          className="flex shrink-0 flex-col items-center gap-2"
          onClick={() => setCreateOpen(true)}
        >
          <div className="relative">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-brand-3 via-brand to-brand-2 p-[2px]">
              <div className="grid h-full w-full place-items-center rounded-full bg-background ring-1 ring-border/60">
                <span className="text-sm font-semibold text-foreground">V</span>
              </div>
            </div>
            <span className="absolute bottom-0 right-0 grid h-6 w-6 place-items-center rounded-full bg-brand text-white ring-2 ring-background">
              <Plus className="h-4 w-4" />
            </span>
          </div>
          <span className="max-w-[5.5rem] truncate text-[11px] text-muted-foreground">
            Seu story
          </span>
        </button>

        {stories.map((s) => {
          const seen = isSeen(s.ownerHandle);

          return (
            <button
              key={s.id}
              type="button"
              className="flex shrink-0 flex-col items-center gap-2"
              onClick={() => openStory(s)}
            >
              <div
                className={cn(
                  "grid h-16 w-16 place-items-center rounded-full p-[2px]",
                  seen
                    ? "bg-muted"
                    : "bg-gradient-to-br from-brand-3 via-brand to-brand-2",
                )}
              >
                <div className="grid h-full w-full place-items-center rounded-full bg-background ring-1 ring-border/60">
                  <span className="text-sm font-semibold text-foreground">
                    {initials(s.ownerName || s.ownerHandle)}
                  </span>
                </div>
              </div>
              <span className="max-w-[5.5rem] truncate text-[11px] text-muted-foreground">
                {s.ownerName}
              </span>
            </button>
          );
        })}
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(v) => {
          setCreateOpen(v);
          if (!v) {
            setFile(null);
            setPreviewUrl("");
            setCaption("");
          }
        }}
      >
        <DialogContent className="max-w-[min(92vw,520px)] rounded-3xl border-border/60">
          <DialogHeader>
            <DialogTitle>Novo story</DialogTitle>
            <DialogDescription>
              Poste algo rápido (expira em 24 horas).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <div className="text-sm font-medium">Foto (opcional)</div>
              <Input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div
              className={cn(
                "relative overflow-hidden rounded-2xl border border-border/60 bg-muted/40",
                previewUrl ? "bg-transparent" : null,
              )}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Prévia"
                  className="h-56 w-full object-cover"
                />
              ) : (
                <div className="grid h-56 place-items-center">
                  <div className="flex items-center gap-2 rounded-full bg-background/80 px-4 py-2 text-xs text-muted-foreground ring-1 ring-border/60">
                    <ImageIcon className="h-4 w-4" />
                    Sem foto
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">Texto</div>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Ex: Treino feito. Sem desculpas."
                className="min-h-[92px]"
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                className="rounded-full"
                onClick={() => setCreateOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="rounded-full"
                onClick={() => {
                  addStoryItem({ imageDataUrl: previewUrl, text: caption });
                  setStories(getStories());
                  setCreateOpen(false);
                  toast({
                    title: "Story publicado",
                    description: "Aparece para os outros e expira em 24h.",
                  });
                }}
                disabled={!previewUrl && !caption.trim()}
              >
                Publicar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <StoryViewerDialog
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        story={activeStory}
        canDelete={activeStory?.ownerHandle === "@voce"}
        onStoriesChange={(nextGroups) => {
          setStories(nextGroups);
          const still = nextGroups.find((g) => g.id === activeStory?.id) ?? null;
          setActiveStory(still);
        }}
      />
    </div>
  );
}
