import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PostIncentiveButton } from "@/components/shared/post-incentive-button";
import { QuickIncentiveOverlay } from "@/components/shared/quick-incentive-overlay";
import { PostCommentsDialog } from "@/components/modals/post-comments-dialog";
import { PostCarousel } from "@/components/post/post-carousel";
import { UserInsignias } from "@/components/profile/user-insignias";
import { UserAvatar } from "@/components/shared/user-avatar";
import { FollowButton } from "@/components/shared/follow-button";
import { WorkoutDetailButton } from "@/components/shared/workout-detail-dialog";
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
import { getPostGradient, GLASS_TOP, GLASS_ACTION, DESC_MAX_CHARS, renderWithHashtags } from "@/lib/post-visuals";

interface PostCardProps {
  post: PostWithStats;
  currentUserId: string | undefined;
  togglingIncentives: Set<string>;
  showFollowButton?: boolean;
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
  const [carouselIndex, setCarouselIndex] = React.useState(0);

  const description = post.description ?? "";
  const isDescTruncatable = description.includes("\n") || description.length > DESC_MAX_CHARS;
  const truncatedDescription = description.length > DESC_MAX_CHARS
    ? description.slice(0, DESC_MAX_CHARS).trimEnd()
    : description.split("\n")[0] ?? "";

  const totalLikes = Object.values(post.likes).reduce((sum: number, val: number) => sum + val, 0);
  const progressWidth = `${Math.min(100, Math.max(0, post.userGoal?.perc ?? 0))}%`;

  const badgeCfg = badgeType ? INCENTIVE_CONFIG[badgeType] : null;
  const badgeLabel = badgeType ? t(`incentive_${badgeType}` as Parameters<typeof t>[0]) : null;

  function triggerBadge(type: PostIncentiveType) {
    if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current);
    setBadgeType(type);
    setBadgeTick((n) => n + 1);
    badgeTimerRef.current = setTimeout(() => setBadgeType(null), 3000);
  }

  React.useEffect(() => () => { if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current); }, []);

  const hasPhotos = (post.photos && post.photos.length > 0) || !!post.photo;
  const photos = post.photos && post.photos.length > 0
    ? post.photos
    : post.photo ? [post.photo] : null;

  return (
    <div className="relative overflow-hidden fade-in mb-4 mx-3" style={{ borderRadius: "28px", boxShadow: "0 20px 44px -16px rgba(0,0,0,.7)" }}>
      {/* Clickable photo area — double-tap opens quick incentive overlay */}
      <div
        className="relative cursor-pointer select-none"
        onClick={() => {
          const now = Date.now();
          if (now - lastTapRef.current < 300) setQuickOverlayVisible(true);
          lastTapRef.current = now;
        }}
      >
        {/* Photo or gradient background */}
        {hasPhotos && photos ? (
          <PostCarousel
            photos={photos}
            alt="Post"
            objectFit="cover"
            hideDots
            hideCounter
            tall
            onIndexChange={setCarouselIndex}
          />
        ) : (
          <div className="w-full rounded-lg" style={{ height: "calc(100dvh - max(14px, env(safe-area-inset-top) + 6px) - 314px - env(safe-area-inset-bottom))", maxHeight: "500px", background: getPostGradient(post.id) }} />
        )}

        {/* Dark gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to bottom,rgba(0,0,0,.1) 0%,transparent 28%,transparent 55%,rgba(0,0,0,.65) 100%)" }}
        />

        {/* ── Compact pill — user identity (left side) ── */}
        <div
          className="absolute top-3 left-3 inline-flex items-center gap-2 pointer-events-auto z-10"
          style={{ height: "44px", borderRadius: "22px", padding: "0 12px 0 6px", ...GLASS_TOP }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="flex-shrink-0 active:opacity-70 transition-opacity"
            onClick={() => { hapticLight(); navigate(`/usuario/${post.user_id}`); }}
          >
            <UserAvatar
              photo={post.userPhoto}
              nickname={post.userNickname}
              size="sm"
              className="border border-white/30"
            />
          </button>

          <button
            className="min-w-0 text-left active:opacity-70 transition-opacity"
            onClick={() => { hapticLight(); navigate(`/usuario/${post.user_id}`); }}
          >
            <div className="text-[13px] font-semibold text-white flex items-center gap-1 leading-tight" style={{ maxWidth: "120px" }}>
              <span className="truncate">{post.userNickname}</span>
              {post.isVerified && <VerifiedBadge size="sm" />}
              <span className="inline-flex items-center flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <UserInsignias userId={post.user_id} />
              </span>
            </div>
            <div className="text-[10.5px] text-white/60 leading-tight">{formatTimeAgo(post.created_at)}</div>
          </button>

          {post.userGoal && (
            <button
              className="flex-shrink-0 text-[10.5px] font-semibold text-white px-2 py-0.5 rounded-full active:opacity-70 transition-opacity"
              style={{ background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.18)" }}
              onClick={() => { hapticMedium(); onOpenGoal(post); }}
            >
              🎯 {Math.round(Math.min(100, post.userGoal.perc))}%
            </button>
          )}
        </div>

        {/* ── Detached actions — right side ── */}
        <div
          className="absolute top-3 right-3 flex items-center gap-1.5 pointer-events-auto z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {showFollowButton && !isOwner && (
            <FollowButton targetUserId={post.user_id} variant="overlay" />
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center justify-center text-white active:scale-90 transition-transform"
                style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,.28)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,.16)" }}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onShare(post)}>
                <Share2 className="h-4 w-4 mr-2" />
                {t("share_title")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {isOwner ? (
                <>
                  <DropdownMenuItem onClick={() => onEdit(post)}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    {t("post_edit_label")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(post)}
                    className="text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t("post_delete_label")}
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => onReportUser(post)}>
                    <Flag className="h-4 w-4 mr-2" />
                    {t("report_user")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onReportPost(post)}>
                    <Flag className="h-4 w-4 mr-2" />
                    {t("report_post")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ── Bottom: description + glass action bar ── */}
        <div
          className="absolute bottom-3 left-3 right-3 z-10 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Description */}
          {description && (
            <p
              className={cn("text-[13px] text-white leading-snug mb-2.5 px-1", isDescTruncatable && "cursor-pointer")}
              style={{
                textShadow: "0 1px 8px rgba(0,0,0,.5)",
                ...(isDescTruncatable && descExpanded ? {
                  background: "rgba(0,0,0,.45)",
                  backdropFilter: "blur(14px)",
                  WebkitBackdropFilter: "blur(14px)",
                  borderRadius: "14px",
                  padding: "8px 12px",
                  marginBottom: "10px",
                } : {}),
              }}
              onClick={() => { if (isDescTruncatable) setDescExpanded((v) => !v); }}
            >
              {!isDescTruncatable || descExpanded ? (
                <>
                  {renderWithHashtags(description)}
                  {isDescTruncatable && descExpanded && (
                    <> <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDescExpanded(false); }}
                      className="text-white/50"
                    >
                      {t("feed_description_less")}
                    </button></>
                  )}
                </>
              ) : (
                <>
                  {renderWithHashtags(truncatedDescription)}
                  {"... "}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDescExpanded(true); }}
                    className="text-white/50"
                  >
                    {t("feed_description_more")}
                  </button>
                </>
              )}
            </p>
          )}

          {/* Goal progress bar (if goal but no perc badge shown) */}
          {post.userGoal && !post.userGoal.perc && (
            <button
              onClick={() => { hapticMedium(); onOpenGoal(post); }}
              className="w-full text-left mb-2 active:opacity-80 transition-opacity px-1"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="h-3 w-3 text-[#9db8ff] flex-shrink-0" />
                <span className="text-[11px] text-white/80 truncate flex-1">{post.userGoal.description}</span>
                <span className="text-[11px] font-bold text-white flex-shrink-0">{Math.round(Math.min(100, post.userGoal.perc))}%</span>
              </div>
              <div className="w-full rounded-full h-1 overflow-hidden" style={{ background: "rgba(255,255,255,.15)" }}>
                <div className="h-full rounded-full" style={{ width: progressWidth, background: "linear-gradient(90deg,#5b8cff,#9d6bff)" }} />
              </div>
            </button>
          )}

          {/* Workout summary — "Ver treino" pill opens the detail modal */}
          {post.workoutSummary && (
            <div className="mb-2.5 px-1">
              <WorkoutDetailButton summary={post.workoutSummary} />
            </div>
          )}

          {/* Carousel indicator — sits right above the incentive action bar */}
          {photos && photos.length > 1 && (
            <div className="flex justify-center gap-1 mb-2.5 pointer-events-none">
              {photos.map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-200",
                    carouselIndex === index ? "w-4 bg-white" : "w-1.5 bg-white/50",
                  )}
                  style={{ boxShadow: "0 1px 4px rgba(0,0,0,.45)" }}
                />
              ))}
            </div>
          )}

          {/* Glass action bar */}
          <div
            className="flex items-center justify-between px-1.5"
            style={{ height: "52px", borderRadius: "26px", ...GLASS_ACTION }}
          >
            <div className="flex gap-1.5">
              {([1, 2, 3, 4, 5, 6] as PostIncentiveType[]).map((type) => {
                const isActive = post.userLikes.includes(type);
                return (
                  <PostIncentiveButton
                    key={type}
                    type={type}
                    isActive={isActive}
                    onClick={() => {
                      if (!isActive) triggerBadge(type);
                      setBurstType(type);
                      setTimeout(() => setBurstType(null), 600);
                      onToggleLike(post.id, type);
                    }}
                    loading={togglingIncentives.has(`${post.id}-${type}`)}
                    burst={burstType === type}
                  />
                );
              })}
            </div>

            <div className="flex items-center gap-2 pr-1 text-white">
              {totalLikes > 0 && (
                <button
                  onClick={() => onOpenLikes(post)}
                  disabled={likesLoading}
                  className="text-[13px] font-semibold text-white disabled:opacity-50"
                >
                  {totalLikes}
                </button>
              )}
              <span className="h-[18px] w-px" style={{ background: "rgba(255,255,255,.2)" }} />
              <div className="flex items-center gap-1 text-white">
                <PostCommentsDialog
                  postId={post.id}
                  commentCount={post.commentCount}
                  hasActivity={post.hasActivity}
                  isPostOwner={isOwner}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quick incentive overlay */}
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

        {/* Incentive badge animation */}
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
              <div className={cn(
                "flex items-center gap-2.5 rounded-full px-5 py-3",
                "bg-black/75 backdrop-blur-md shadow-2xl border border-white/15",
              )}>
                <badgeCfg.Icon className={cn("h-5 w-5 flex-shrink-0", badgeCfg.activeClassName)} />
                <span className="text-sm font-semibold text-white tracking-wide">{badgeLabel}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
