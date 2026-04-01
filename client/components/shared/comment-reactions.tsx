import * as React from "react";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getCommentReactionsDb,
  toggleCommentReactionDb,
  groupCommentReactions,
  type CommentReactionSummary,
} from "@/lib/ritmofit-db";
import { useAuth } from "@/hooks/useAuth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const QUICK_EMOJIS = ["❤️", "🔥", "💪", "😂", "👏", "🥇"];

interface CommentReactionsProps {
  commentType: "post" | "shot" | "flow" | "checkin";
  commentId: string;
  /** ID do dono do comentário — usado para enviar notificação de reação */
  commentOwnerId?: string;
  /** ID do conteúdo pai (postId, shotId, flowId ou checkInId) — necessário para a notificação navegar corretamente */
  sourceId?: string;
  /** Se true, usa estilo claro (fundo dark como no FlowViewer) */
  dark?: boolean;
  /** Se true, oculta o botão de reagir (próprio comentário do usuário) */
  isOwnComment?: boolean;
}

export function CommentReactions({ commentType, commentId, commentOwnerId, sourceId, dark = false, isOwnComment = false }: CommentReactionsProps) {
  const { user } = useAuth();
  const [reactions, setReactions] = React.useState<CommentReactionSummary[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getCommentReactionsDb(commentType, [commentId]).then((records) => {
      if (cancelled) return;
      setReactions(groupCommentReactions(records, user?.id ?? null));
    });
    return () => { cancelled = true; };
  }, [commentType, commentId, user?.id]);



  const handleReact = async (emoji: string) => {
    if (!user) return;
    setLoading(emoji);
    setOpen(false);

    // Optimistic update
    setReactions((prev) => {
      const existing = prev.find((r) => r.emoji === emoji);
      if (existing) {
        if (existing.userReacted) {
          // remove
          return prev
            .map((r) => r.emoji === emoji ? { ...r, count: r.count - 1, userReacted: false } : r)
            .filter((r) => r.count > 0);
        } else {
          return prev.map((r) => r.emoji === emoji ? { ...r, count: r.count + 1, userReacted: true } : r);
        }
      } else {
        return [...prev, { emoji, count: 1, userReacted: true }];
      }
    });

    try {
      await toggleCommentReactionDb(commentType, commentId, emoji, commentOwnerId, sourceId);
    } catch {
      // Reverte em caso de erro — rebusca do servidor
      getCommentReactionsDb(commentType, [commentId]).then((records) => {
        setReactions(groupCommentReactions(records, user?.id ?? null));
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1">
      {/* Reações existentes */}
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => handleReact(r.emoji)}
          disabled={loading === r.emoji || !user}
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium transition-all",
            dark
              ? r.userReacted
                ? "bg-white/30 text-white ring-1 ring-white/60"
                : "bg-white/10 text-white/80 hover:bg-white/20"
              : r.userReacted
                ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          <span>{r.emoji}</span>
          <span>{r.count}</span>
        </button>
      ))}

      {/* Botão para abrir o picker de emojis rápidos — oculto no próprio comentário */}
      {user && !isOwnComment && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center rounded-full p-0.5 transition-colors",
                dark
                  ? "text-white/50 hover:text-white hover:bg-white/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
              aria-label="Reagir ao comentário"
            >
              <Smile className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>

          <PopoverContent
            side="top"
            align="start"
            sideOffset={8}
            className={cn(
              "z-[300] flex w-auto gap-1 rounded-full px-2 py-1.5 shadow-xl border-0 p-0",
              dark ? "bg-zinc-800" : "bg-popover",
            )}
          >
            {QUICK_EMOJIS.map((emoji) => {
              const reaction = reactions.find((r) => r.emoji === emoji);
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleReact(emoji)}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-base transition-all hover:scale-125",
                    reaction?.userReacted && "scale-110",
                  )}
                  aria-label={emoji}
                >
                  {emoji}
                </button>
              );
            })}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
