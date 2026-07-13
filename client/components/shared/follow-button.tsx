import * as React from "react";
import { UserPlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
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
}

export function FollowButton({
  targetUserId,
  initialIsFollowing,
  variant = "default",
  onFollowChange,
}: FollowButtonProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [isFollowing, setIsFollowing] = React.useState(initialIsFollowing ?? false);
  const [isLoading, setIsLoading] = React.useState(false);

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

  const handleClick = React.useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();

      if (!user) {
        toast({
          title: t("follow_login_title"),
          description: t("follow_login_desc"),
        });
        return;
      }

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
    [user, isFollowing, isLoading, targetUserId, onFollowChange, t]
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

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading}
      variant={isFollowing ? "outline" : "default"}
      size="sm"
      className="rounded-full gap-2"
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
  );
}
