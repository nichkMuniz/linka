import { TrendingUp, Trophy } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useLanguage } from "@/lib/language-context";
import type { RankingUser, SearchUser } from "@/lib/ritmofit-db";

interface RankingTabProps {
  ranking: RankingUser[];
  /** usado para filtrar o ranking a quem o usuário segue (+ ele mesmo) */
  followers: SearchUser[];
  currentUserId?: string;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
}

/**
 * Aba "Ranking" da Comunidade — leaderboard de pontos entre o próprio usuário e
 * quem ele segue. Puramente apresentacional (extraído de `Community.tsx`); não
 * tem estado próprio, recebe os dados por props.
 */
export function RankingTab({ ranking, followers, currentUserId, onScroll }: RankingTabProps) {
  const { t } = useLanguage();

  const visible = ranking.filter((rankUser) => {
    if (rankUser.userId === currentUserId) return true;
    return followers.some((f) => f.id === rankUser.userId);
  });

  return (
    <>
      {/* Single scrollable container */}
      <div data-community-scroll-container onScroll={onScroll} className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 pt-4">
        <h1 className="text-2xl font-bold tracking-tight pb-1">{t("community_ranking")}</h1>
        {ranking.length > 0 ? (
          <div className="space-y-2">
            {visible.map((rankUser, index) => {
              const medalEmoji =
                index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "";
              const isCurrentUser = rankUser.userId === currentUserId;

              return (
                <div
                  key={rankUser.userId}
                  className="rounded-xl p-4"
                  style={{
                    background: "linear-gradient(rgba(255,255,255,.09),rgba(255,255,255,.03))",
                    backdropFilter: "blur(20px) saturate(170%)",
                    WebkitBackdropFilter: "blur(20px) saturate(170%)",
                    border: isCurrentUser ? "1px solid rgba(91,140,255,.4)" : "1px solid rgba(255,255,255,.10)",
                    boxShadow: isCurrentUser ? "0 0 0 1px rgba(91,140,255,.2)" : "inset 0 1px 0 rgba(255,255,255,.18)",
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-12 text-center">
                      {medalEmoji ? (
                        <span className="text-2xl">{medalEmoji}</span>
                      ) : (
                        <span className="text-lg font-bold text-white/40">#{index + 1}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 flex-1">
                      <UserAvatar photo={rankUser.userPhoto} nickname={rankUser.userNickname} size="lg" />
                      <div className="flex-1">
                        <p className="font-semibold text-sm">
                          {rankUser.userNickname}
                          {isCurrentUser && <span className="ml-1 text-xs text-brand">({t("ranking_you")})</span>}
                        </p>
                      </div>
                    </div>

                    <div className="flex-shrink-0 text-right">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-4 w-4 text-brand" />
                        <span className="font-bold text-brand">{rankUser.points}</span>
                      </div>
                      <p className="text-xs text-white/40">{t("ranking_points")}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl p-6 text-center" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}>
            <Trophy className="h-12 w-12 text-white/30 mx-auto mb-3" />
            <p className="text-sm font-medium mb-1">{t("ranking_empty")}</p>
            <p className="text-sm text-white/50">{t("ranking_empty_desc")}</p>
          </div>
        )}
      </div>
    </>
  );
}
