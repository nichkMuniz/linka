import * as React from "react";
import { UserPlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import { followUserDb, unfollowUserDb, isFollowingDb } from "@/lib/ritmofit-db";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/language-context";

interface FollowButtonProps {
  targetUserId: string;
  /**
   * Estado inicial de seguimento. Se omitido, o componente busca o status
   * automaticamente via `isFollowingDb`.
   */
  initialIsFollowing?: boolean;
  /** "default" usa Button do Shadcn (perfil). "overlay" usa estilo pill sobre vídeo (shots). */
  variant?: "default" | "overlay";
  onFollowChange?: (isFollowing: boolean) => void;
  /** Nome exibido na confirmação de deixar de seguir ("Deixar de seguir {nome}?"). */
  targetName?: string;
}

export function FollowButton({
  targetUserId,
  initialIsFollowing,
  variant = "default",
  onFollowChange,
  targetName,
}: FollowButtonProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [isFollowing, setIsFollowing] = React.useState(initialIsFollowing ?? false);
  const [isLoading, setIsLoading] = React.useState(false);
  // Deixar de seguir pede confirmação (2026-09-30): "Seguindo" fica ao lado de
  // nomes e cards tocáveis, e um toque sem querer desfazia o follow na hora.
  // Seguir continua direto — é a ação barata e fácil de desfazer.
  const [confirmUnfollowOpen, setConfirmUnfollowOpen] = React.useState(false);

  // Se initialIsFollowing não foi passado, busca o status automaticamente
  React.useEffect(() => {
    if (initialIsFollowing !== undefined) {
      setIsFollowing(initialIsFollowing);
      return;
    }
    if (!user) return;
    isFollowingDb(targetUserId)
      .then(setIsFollowing)
      .catch(() => {});
  }, [targetUserId, initialIsFollowing, user]);

  const toggleFollow = React.useCallback(
    async () => {
      if (isLoading) return;

      const wasFollowing = isFollowing;
      setIsFollowing(!wasFollowing);
      setIsLoading(true);

      try {
        const success = wasFollowing
          ? await unfollowUserDb(targetUserId)
          : await followUserDb(targetUserId);

        if (!success) {
          setIsFollowing(wasFollowing);
          toast({ title: t("error"), description: t("retry"), variant: "destructive" });
        } else {
          onFollowChange?.(!wasFollowing);
          toast({
            title: wasFollowing ? t("follow_toast_unfollowed_title") : t("follow_btn_following"),
            description: wasFollowing
              ? t("follow_toast_unfollowed_desc")
              : t("follow_toast_followed_desc"),
          });
        }
      } catch (err: any) {
        setIsFollowing(wasFollowing);
        toast({
          title: t("error"),
          description: err?.message || t("retry"),
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [isFollowing, isLoading, targetUserId, onFollowChange, t]
  );

  const handleClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();

      if (!user) {
        toast({
          title: t("follow_login_title"),
          description: t("follow_login_desc"),
        });
        return;
      }

      if (isLoading) return;
      if (isFollowing) {
        setConfirmUnfollowOpen(true);
        return;
      }
      void toggleFollow();
    },
    [user, isFollowing, isLoading, toggleFollow, t]
  );

  // O diálogo vai num portal, mas eventos React sobem pela árvore de
  // componentes: sem este `contents`, tocar no diálogo (ou no fundo escuro)
  // disparava o onClick do card em volta — ex.: a notificação navegava.
  const confirmDialog = (
    <span
      className="contents"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <AlertDialog open={confirmUnfollowOpen} onOpenChange={setConfirmUnfollowOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {targetName
                ? t("follow_unfollow_confirm_title").replace("{name}", targetName)
                : t("follow_unfollow_confirm_title_generic")}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("follow_unfollow_confirm_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmUnfollowOpen(false);
                void toggleFollow();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("follow_unfollow_confirm_cta")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </span>
  );

  if (variant === "overlay") {
    if (isFollowing) return null;
    return (
      <button
        onClick={handleClick}
        disabled={isLoading}
        className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-all disabled:opacity-50 bg-white text-black hover:bg-white/90"
      >
        <UserPlus className="h-3 w-3" />
        {t("follow_btn_follow")}
      </button>
    );
  }

  // Hierarquia de botões do app (docs/15 §6): "Seguir" é a ação principal
  // (branco); "Seguindo" é estado, então vira secundário (vidro) — antes o
  // outline escuro parecia o botão mais forte da linha.
  return (
    <>
    <Button
      onClick={handleClick}
      disabled={isLoading}
      size="sm"
      className={
        isFollowing
          ? "rounded-full gap-2 border-0 bg-white/[.09] text-white/85 hover:bg-white/[.14]"
          : "rounded-full gap-2 bg-white text-[#0a0b12] hover:bg-white/90"
      }
    >
      {isFollowing ? (
        <>
          <Check className="h-4 w-4" />
          {t("follow_btn_following")}
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4" />
          {t("follow_btn_follow")}
        </>
      )}
    </Button>
    {confirmDialog}
    </>
  );
}
