import * as React from "react";
import { Trash2, X } from "lucide-react";

import type { StoryGroup, StoryItem } from "@/lib/ritmofit";
import { deleteStoryItemDb, getStoriesDb } from "@/lib/ritmofit-db";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

const STORY_DURATION_MS = 5000;

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

function safeStorageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

const SEEN_KEY = "ritmofit:stories-seen:v1";

function markSeen(ownerHandle: string) {
  const raw = safeStorageGet(SEEN_KEY);
  let obj: Record<string, string> = {};
  try {
    obj = raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    obj = {};
  }
  obj[ownerHandle] = new Date().toISOString();
  safeStorageSet(SEEN_KEY, JSON.stringify(obj));
}

export function StoryViewerDialog({
  open,
  onOpenChange,
  story,
  canDelete,
  onStoriesChange,
  onRequestNextStory,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  story: StoryGroup | null;
  canDelete?: boolean;
  onStoriesChange?: (next: StoryGroup[]) => void;
  onRequestNextStory?: () => void;
}) {
  const items = story?.items ?? [];
  const [index, setIndex] = React.useState(0);
  const [progress, setProgress] = React.useState(0);

  const current: StoryItem | undefined = items[index];

  React.useEffect(() => {
    if (!open) {
      setIndex(0);
      setProgress(0);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    setIndex(0);
    setProgress(0);
  }, [open, story?.id]);

  React.useEffect(() => {
    if (!open || !story || !items.length) return;
    markSeen(story.ownerHandle);
  }, [open, story, items.length]);

  React.useEffect(() => {
    if (!open || !items.length) return;

    setProgress(0);

    const startedAt = Date.now();
    const tick = () => {
      const next = (Date.now() - startedAt) / STORY_DURATION_MS;
      setProgress(Math.max(0, Math.min(1, next)));
      if (next >= 1) {
        setIndex((prev) => {
          const atEnd = prev >= items.length - 1;
          if (atEnd) {
            if (onRequestNextStory) {
              onRequestNextStory();
            } else {
              onOpenChange(false);
            }
            return prev;
          }
          return prev + 1;
        });
      }
    };

    const id = window.setInterval(tick, 50);
    return () => window.clearInterval(id);
  }, [open, index, items.length, onOpenChange, onRequestNextStory]);

  const goPrev = React.useCallback(() => {
    setIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const goNext = React.useCallback(() => {
    setIndex((prev) => {
      if (prev >= items.length - 1) {
        if (onRequestNextStory) {
          onRequestNextStory();
        } else {
          onOpenChange(false);
        }
        return prev;
      }
      return prev + 1;
    });
  }, [items.length, onOpenChange, onRequestNextStory]);

  if (!story) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(92vw,460px)] overflow-hidden rounded-3xl border-border/60 bg-black p-0 text-white">
        <DialogHeader className="sr-only">
          <DialogTitle>Story</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <div className="absolute left-0 right-0 top-0 z-10 p-3">
            <div className="flex items-center gap-1">
              {items.map((_, i) => {
                const filled = i < index;
                const active = i === index;

                return (
                  <div
                    key={i}
                    className="h-1 flex-1 overflow-hidden rounded-full bg-white/25"
                    aria-hidden="true"
                  >
                    <div
                      className={cn(
                        "h-full bg-white transition-[width]",
                        filled ? "w-full" : active ? "w-[var(--p)]" : "w-0",
                      )}
                      style={
                        active
                          ? ({ "--p": `${Math.round(progress * 100)}%` } as any)
                          : undefined
                      }
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-white/10 ring-1 ring-white/15">
                  <span className="text-xs font-semibold">
                    {initials(story.ownerName || story.ownerHandle)}
                  </span>
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-semibold">{story.ownerName}</div>
                  <div className="text-xs text-white/70">
                    {story.ownerHandle}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {canDelete && current ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full text-white hover:bg-white/10"
                    aria-label="Excluir story"
                    onClick={async () => {
                      await deleteStoryItemDb(story.ownerHandle, current.id);
                      const nextGroups = await getStoriesDb();
                      onStoriesChange?.(nextGroups);

                      toast({
                        title: "Story excluído",
                        description: "Removemos esse story.",
                      });

                      if (index >= items.length - 1) {
                        onOpenChange(false);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full text-white hover:bg-white/10"
                  aria-label="Fechar"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div
            className="relative grid h-[70vh] min-h-[440px] w-full place-items-center bg-black"
            onClick={(e) => {
              const rect = (
                e.currentTarget as HTMLDivElement
              ).getBoundingClientRect();
              const x = e.clientX - rect.left;
              if (x < rect.width / 2) goPrev();
              else goNext();
            }}
            role="button"
            tabIndex={0}
            aria-label="Avançar story"
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") goPrev();
              if (e.key === "ArrowRight") goNext();
              if (e.key === "Escape") onOpenChange(false);
            }}
          >
            {current?.imageDataUrl ? (
              <img
                src={current.imageDataUrl}
                alt="Story"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="p-8 text-center">
                <div className="text-xl font-semibold">{current?.text}</div>
              </div>
            )}

            {current?.text && current?.imageDataUrl ? (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent p-4">
                <div className="text-sm leading-snug">{current.text}</div>
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
