import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PostIncentiveButton } from "@/components/shared/post-incentive-button";
import { QuickIncentiveOverlay } from "@/components/shared/quick-incentive-overlay";
import { PostCommentsDialog } from "@/components/modals/post-comments-dialog";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import { PostCarousel } from "@/components/post/post-carousel";
import { UserInsignias } from "@/components/profile/user-insignias";
import { UserAvatar } from "@/components/shared/user-avatar";
import { FollowButton } from "@/components/shared/follow-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Flag, Trash2, Share2, Edit2, Target } from "lucide-react";
import { formatTimeAgo, cn } from "@/lib/utils";
import type { PostWithStats } from "@/services/post.service";
import type { PostIncentiveType } from "@/lib/ritmofit-db";
import { INCENTIVE_CONFIG } from "@/lib/incentive-config";
import { useNavigate } from "react-router-dom";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import { useLanguage } from "@/lib/language-context";
import { hapticLight, hapticMedium } from "@/lib/haptics";

interface PostCardProps {
  post: PostWithStats;
  currentUserId: string | undefined;
  togglingIncentives: Set<string>;
  /** Show a Follow button in the overlay (used in Discover sections) */
  showFollowButton?: boolean;
  /** When true the likes count button is disabled (parent is loading likes data) */
  likesLoading?: boolean;
  onToggleLike: (postId: string, type: PostIncentiveType) => void;
  onOpenLikes: (post: PostWithStats) => void;
  onOpenGoal: (post: PostWithStats) => void;
  onShare: (post: PostWithStats) => void;
  onReportUser: (post: PostWithStats) => void;
  onReportPost: (post: PostWithStats) => void;
  onEdit: (post: PostWithStats) => void;
  onDelete: (post: PostWithStats) => void;
}

export function PostCard({
  post,
  currentUserId,
  togglingIncentives,
  showFollowButton = false,
  likesLoading = false,
  onToggleLike,
  onOpenLikes,
  onOpenGoal,
  onShare,
  onReportUser,
  onReportPost,
  onEdit,
  onDelete,
}: PostCardProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const isOwner = post.user_id === currentUserId;
  const [quickOverlayVisible, setQuickOverlayVisible] = React.useState(false);
  const [burstType, setBurstType] = React.useState<PostIncentiveType | null>(null);
  const [badgeType, setBadgeType] = React.useState<PostIncentiveType | null>(null);
  const [badgeTick, setBadgeTick] = React.useState(0);
  const lastTapRef = React.useRef<number>(0);
  const badgeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [descExpanded, setDescExpanded] = React.useState(false);

  function renderWithHashtags(text: string) {
    return text.split(/(\s+)/).map((token, i) =>
      token.startsWith("#") && token.length > 1 ? (
        <span key={i} className="text-brand font-medium">{token}</span>
      ) : (
        token
      )
    );
  }
  const DESC_MAX_CHARS = 30;
  const description = post.description ?? "";
  const firstLine = description.split("\n")[0] ?? "";
  const isDescTruncatable =
    description.includes("\n") || description.length > DESC_MAX_CHARS;
  const truncatedDescription =
    firstLine.length > DESC_MAX_CHARS
      ? firstLine.slice(0, DESC_MAX_CHARS).trimEnd()
      : firstLine;

  const totalLikes = Object.values(post.likes).reduce(
    (sum: number, val: number) => sum + val,
    0,
  );
  const progressWidth = `${Math.min(100, Math.max(0, post.userGoal?.perc ?? 0))}%`;

  const badgeCfg = badgeType ? INCENTIVE_CONFIG[badgeType] : null;
  const badgeLabel = badgeType
    ? t(`incentive_${badgeType}` as Parameters<typeof t>[0])
    : null;

  function triggerBadge(type: PostIncentiveType) {
    if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current);
    setBadgeType(type);
    setBadgeTick((n) => n + 1);
    badgeTimerRef.current = setTimeout(() => setBadgeType(null), 3000);
  }

  React.useEffect(
    () => () => {
      if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current);
    },
    [],
  );

  return (
    <Card className="border-border/60 relative overflow-hidden fade-in rounded-xl mx-2">
      <CardContent className="space-y-3 p-0">
        {/* Image + overlay */}
        <div
          className="relative"
          onClick={() => {
            const now = Date.now();
            if (now - lastTapRef.current < 300) {
              setQuickOverlayVisible(true);
            }
            lastTapRef.current = now;
          }}
        >
          {post.photos && post.photos.length > 0 ? (
            <PostCarousel photos={post.photos} alt="Post" objectFit="contain" />
          ) : post.photo ? (
            <PostCarousel photos={[post.photo]} alt="Post" objectFit="contain" />
          ) : (
            <div className="relative w-full min-h-[56px] bg-muted/30" />
          )}

          <QuickIncentiveOverlay
            visible={quickOverlayVisible}
            userLikes={post.userLikes}
            onSelect={(type) => {
              setQuickOverlayVisible(false);
              triggerBadge(type);
              setBurstType(type);
              setTimeout(() => setBurstType(null), 600);
              onToggleLike(post.id, type);
            }}
            onDismiss={() => setQuickOverlayVisible(false)}
          />

          {/* Incentive confirmation badge — flies up from icon area, stays, flies back */}
          <AnimatePresence mode="wait">
            {badgeType && badgeCfg && (
              <motion.div
                key={`badge-${badgeTick}`}
                className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
                initial={{ opacity: 0, scale: 0.35, y: 72 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.35, y: 72 }}
                transition={{
                  opacity: { duration: 0.45, ease: "easeInOut" },
                  scale: { type: "spring", stiffness: 460, damping: 22 },
                  y: { type: "spring", stiffness: 460, damping: 22 },
                }}
              >
                <div
                  className={cn(
                    "flex items-center gap-2.5 rounded-full px-5 py-3",
                    "bg-black/75 backdrop-blur-md shadow-2xl border border-white/15",
                  )}
                >
                  <badgeCfg.Icon
                    className={cn("h-5 w-5 flex-shrink-0", badgeCfg.activeClassName)}
                  />
                  <span className="text-sm font-semibold text-white tracking-wide">
                    {badgeLabel}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* User info overlay */}
          <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-2 p-3 bg-gradient-to-t from-black/60 via-black/30 to-transparent">
            <button
              onClick={() => { hapticLight(); navigate(`/usuario/${post.user_id}`); }}
              className="flex items-center gap-2 active:opacity-70 transition-opacity min-w-0 flex-1"
            >
              <UserAvatar
                photo={post.userPhoto}
                nickname={post.userNickname}
                size="sm"
                className="border border-white/30 shrink-0"
              />
              <div className="flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5 min-w-0">
                {post.isVerified && <VerifiedBadge size="sm" />}
                <span className="text-xs font-medium text-white leading-none truncate">
                  {post.userNickname}
                </span>
                <span
                  className="inline-flex items-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <UserInsignias userId={post.user_id} />
                </span>
              </div>
            </button>

            <div className="flex items-center gap-2">
              {showFollowButton && !isOwner && (
                <FollowButton targetUserId={post.user_id} variant="overlay" />
              )}

              {/* Context menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 text-white active:bg-white/20"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => onShare(post)}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Compartilhar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {isOwner ? (
                    <>
                      <DropdownMenuItem onClick={() => onEdit(post)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Editar post
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete(post)}
                        className="text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir post
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem onClick={() => onReportUser(post)}>
                        <Flag className="h-4 w-4 mr-2" />
                        Denunciar usuário
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onReportPost(post)}>
                        <Flag className="h-4 w-4 mr-2" />
                        Denunciar post
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Incentive buttons + comments */}
        <div className="flex items-center px-2 pt-1 pb-0.5">
          {([1, 2, 3, 4, 5, 6] as PostIncentiveType[]).map((type) => {
            const isActive = post.userLikes.includes(type);
            return (
              <PostIncentiveButton
                key={type}
                type={type}
                isActive={isActive}
                onClick={() => {
                  if (!isActive) triggerBadge(type);
                  onToggleLike(post.id, type);
                }}
                loading={togglingIncentives.has(`${post.id}-${type}`)}
                burst={burstType === type}
              />
            );
          })}
          <div className="ml-auto">
            <PostCommentsDialog
              postId={post.id}
              commentCount={post.commentCount}
              hasActivity={post.hasActivity}
              isPostOwner={isOwner}
            />
          </div>
        </div>

        {/* Like count + timestamp */}
        <div className="flex items-center gap-2 px-3 pb-1">
          {totalLikes > 0 && (
            <button
              onClick={() => onOpenLikes(post)}
              disabled={likesLoading}
              className="text-xs font-semibold text-foreground active:text-brand transition-colors disabled:opacity-50 disabled:cursor-wait"
            >
              {totalLikes} incentivos
            </button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {formatTimeAgo(post.created_at)}
          </span>
        </div>

        {/* Description + goal */}
        <div className="px-3 pb-3 space-y-2">
          {description && (
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {!isDescTruncatable || descExpanded ? (
                <>
                  {renderWithHashtags(description)}
                  {isDescTruncatable && descExpanded && (
                    <>
                      {" "}
                      <button
                        type="button"
                        onClick={() => setDescExpanded(false)}
                        className="text-muted-foreground active:text-foreground transition-colors"
                      >
                        {t("feed_description_less")}
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  {renderWithHashtags(truncatedDescription)}
                  {"... "}
                  <button
                    type="button"
                    onClick={() => setDescExpanded(true)}
                    className="text-muted-foreground active:text-foreground transition-colors"
                  >
                    {t("feed_description_more")}
                  </button>
                </>
              )}
            </p>
          )}

          {post.userGoal && (
            <button
              onClick={() => { hapticMedium(); onOpenGoal(post); }}
              className="w-full text-left active:opacity-80 transition-opacity"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="h-3 w-3 text-brand flex-shrink-0" />
                <span className="text-xs font-medium text-foreground truncate flex-1">
                  {post.userGoal.description}
                </span>
                <span className="text-xs font-bold text-brand flex-shrink-0">
                  {Math.round(Math.min(100, post.userGoal.perc))}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-brand h-full rounded-full transition-all duration-500"
                  style={{ width: progressWidth }}
                />
              </div>
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
