import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PostIncentiveButton } from "@/components/shared/post-incentive-button";
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
import { formatTimeAgo } from "@/lib/utils";
import type { PostWithStats } from "@/services/post.service";
import type { PostIncentiveType } from "@/lib/ritmofit-db";
import { useNavigate } from "react-router-dom";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";

interface PostCardProps {
  post: PostWithStats;
  currentUserId: string | undefined;
  togglingIncentives: Set<string>;
  /** Show a Follow button in the overlay (used in Discover sections) */
  showFollowButton?: boolean;
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
  const isOwner = post.user_id === currentUserId;
  const totalLikes = Object.values(post.likes).reduce(
    (sum: number, val: number) => sum + val,
    0,
  );
  const progressWidth = `${Math.min(100, Math.max(0, post.userGoal?.perc ?? 0))}%`;

  return (
    <Card className="border-border/60 relative overflow-hidden fade-in">
      <CardContent className="space-y-3 p-0">
        {/* Image + overlay */}
        <div className="relative">
          {post.photos && post.photos.length > 0 ? (
            <PostCarousel photos={post.photos} alt="Post" />
          ) : post.photo ? (
            <div className="relative aspect-square md:aspect-auto md:h-[450px] bg-slate-900/20 flex items-center justify-center overflow-hidden rounded-lg">
              <ImageWithFallback
                src={post.photo}
                alt="Post"
                fallback="/placeholder.svg"
                className="max-w-full max-h-full w-auto h-auto object-contain"
              />
            </div>
          ) : (
            /* Post sem mídia — placeholder mínimo para o overlay não colapsar */
            <div className="relative w-full min-h-[56px] bg-muted/30 rounded-lg" />
          )}

          {/* User info overlay */}
          <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-2 p-3 bg-gradient-to-t from-black/60 via-black/30 to-transparent">
            <button
              onClick={() => navigate(`/usuario/${post.user_id}`)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0 flex-1"
            >
              <UserAvatar
                photo={post.userPhoto}
                gender={post.userGender}
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
                    className="h-8 w-8 text-white hover:bg-white/20"
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
          {([1, 2, 3, 4, 5, 6] as PostIncentiveType[]).map((type) => (
            <PostIncentiveButton
              key={type}
              type={type}
              isActive={post.userLikes.includes(type)}
              onClick={() => onToggleLike(post.id, type)}
              loading={togglingIncentives.has(`${post.id}-${type}`)}
            />
          ))}
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
              className="text-xs font-semibold text-foreground hover:text-brand transition-colors"
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
          {post.description && (
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {post.description}
            </p>
          )}

          {post.userGoal && (
            <button
              onClick={() => onOpenGoal(post)}
              className="w-full text-left group"
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