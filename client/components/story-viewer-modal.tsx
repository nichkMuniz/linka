import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getStoryLikesDb,
  getUserStoryLikesDb,
  toggleStoryLikeDb,
  getStoryCommentsDb,
  addStoryCommentDb,
  deleteStoryCommentDb,
  type StoryWithUser,
  type PostIncentiveType,
  type StoryComment,
} from "@/lib/ritmofit-db";
import { X, ChevronRight, Send, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PostIncentiveButton } from "@/components/post-incentive-button";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";

interface StoryViewerModalProps {
  story: StoryWithUser | null;
  stories: StoryWithUser[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNextStory: () => void;
}

export function StoryViewerModal({
  story,
  stories,
  open,
  onOpenChange,
  onNextStory,
}: StoryViewerModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [likes, setLikes] = React.useState<Record<string, any>>({});
  const [userLikes, setUserLikes] = React.useState<PostIncentiveType[]>([]);
  const [comments, setComments] = React.useState<StoryComment[]>([]);
  const [newComment, setNewComment] = React.useState("");
  const [isAddingComment, setIsAddingComment] = React.useState(false);
  const [togglingLikeId, setTogglingLikeId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!open || !story) return;

    const loadStoryData = async () => {
      try {
        const [likesData, userLikesData, commentsData] = await Promise.all([
          getStoryLikesDb(story.id),
          getUserStoryLikesDb(story.id),
          getStoryCommentsDb(story.id),
        ]);

        setLikes(likesData);
        setUserLikes(userLikesData);
        setComments(commentsData);
      } catch (err) {
        console.error("Error loading story data:", err);
      }
    };

    loadStoryData();

    // Auto-close after 8 seconds
    const timer = setTimeout(() => {
      onOpenChange(false);
    }, 8000);

    return () => clearTimeout(timer);
  }, [open, onOpenChange, story]);

  const handleToggleLike = React.useCallback(
    async (incentiveType: PostIncentiveType) => {
      if (!story || !user) return;

      setTogglingLikeId(story.id);
      try {
        await toggleStoryLikeDb(story.id, incentiveType);

        // Update local state
        const wasActive = userLikes.includes(incentiveType);
        setUserLikes(
          wasActive
            ? userLikes.filter((t) => t !== incentiveType)
            : [...userLikes, incentiveType],
        );

        // Update likes count
        setLikes((prev) => {
          const updated = { ...prev };
          const fieldMap: Record<PostIncentiveType, string> = {
            1: "apoio",
            2: "continua",
            3: "ganhador",
            4: "consegueMais",
            5: "limiteMaior",
            6: "maisAlgum",
          };
          const field = fieldMap[incentiveType];
          if (field) {
            updated[field] = (updated[field] || 0) + (wasActive ? -1 : 1);
          }
          return updated;
        });
      } catch (err: any) {
        console.error("Error toggling story like:", err);
        toast({
          title: "Erro ao reagir",
          description: err?.message || "Tente novamente.",
        });
      } finally {
        setTogglingLikeId(null);
      }
    },
    [story, user, userLikes],
  );

  const handleAddComment = React.useCallback(async () => {
    if (!story || !user || !newComment.trim()) return;

    setIsAddingComment(true);
    try {
      const comment = await addStoryCommentDb(story.id, newComment);
      if (comment) {
        setComments((prev) => [...prev, comment]);
        setNewComment("");
        toast({
          title: "Comentário adicionado!",
          description: "Seu comentário foi compartilhado.",
        });
      }
    } catch (err: any) {
      console.error("Error adding comment:", err);
      toast({
        title: "Erro ao adicionar comentário",
        description: err?.message || "Tente novamente.",
      });
    } finally {
      setIsAddingComment(false);
    }
  }, [story, user, newComment]);

  const handleDeleteComment = React.useCallback(
    async (commentId: string) => {
      try {
        const success = await deleteStoryCommentDb(commentId);
        if (success) {
          setComments((prev) => prev.filter((c) => c.id !== commentId));
          toast({
            title: "Comentário removido",
          });
        }
      } catch (err: any) {
        console.error("Error deleting comment:", err);
        toast({
          title: "Erro ao remover comentário",
          description: err?.message || "Tente novamente.",
        });
      }
    },
    [],
  );

  if (!story) return null;

  const isVideo =
    story.media_url?.includes(".mp4") ||
    story.media_url?.includes(".webm") ||
    story.media_url?.includes(".mov") ||
    (story.media_url?.startsWith("data:") &&
      story.media_url?.includes("video"));

  // Check if there are more stories to skip to
  const currentIndex = stories.findIndex((s) => s.id === story?.id);
  const hasNextStory = currentIndex < stories.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none p-0 border-0 bg-black">
        <DialogTitle className="sr-only">Story viewer</DialogTitle>
        <div className="relative w-full h-full flex flex-col">
          {/* Header with user info and close button */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 z-10">
            <button
              onClick={() => {
                onOpenChange(false);
                navigate(`/usuario/${story.user_id}`);
              }}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity flex-1"
            >
              {story.userPhoto && (
                <img
                  src={story.userPhoto}
                  alt={story.userNickname}
                  className="h-10 w-10 rounded-full object-cover"
                />
              )}
              <div>
                <p className="text-sm font-semibold text-white">
                  {story.userNickname}
                </p>
                <p className="text-xs text-gray-400">
                  {formatTimeAgo(story.created_at)}
                </p>
              </div>
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="text-white hover:text-gray-300 shrink-0"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Media - Full Screen */}
          <div className="flex-1 flex items-center justify-center relative">
            {isVideo ? (
              <video
                src={story.media_url}
                className="w-full h-full object-cover"
                autoPlay
              />
            ) : (
              <img
                src={story.media_url}
                alt="Story"
                className="w-full h-full object-cover"
              />
            )}

            {/* Skip Button */}
            {hasNextStory && (
              <button
                onClick={onNextStory}
                className="absolute bottom-4 right-4 bg-white/20 hover:bg-white/30 text-white p-3 rounded-full transition-colors z-20"
                aria-label="Próximo story"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}

            {/* Incentive Buttons - Right Side */}
            <div className="absolute right-4 bottom-20 flex flex-col gap-2 z-20">
              {([1, 2, 3, 4, 5, 6] as PostIncentiveType[]).map((type) => (
                <PostIncentiveButton
                  key={type}
                  type={type}
                  isActive={userLikes.includes(type)}
                  onClick={() => handleToggleLike(type)}
                  loading={togglingLikeId === story.id}
                />
              ))}
            </div>

            {/* Description Overlay */}
            {story.description && (
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10">
                <p className="text-sm text-white">{story.description}</p>
              </div>
            )}
          </div>

          {/* Bottom Section - Comments */}
          <div className="shrink-0 bg-black/90 border-t border-white/10 p-3 space-y-3 max-h-32 flex flex-col z-20">
            {/* Comments List */}
            {comments.length > 0 && (
              <div className="overflow-y-auto flex-1 space-y-2 max-h-20">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex items-start gap-2 text-xs">
                    <div className="flex-1">
                      <span className="font-semibold text-white">
                        {comment.userName}
                      </span>
                      <span className="text-white/70 ml-2">{comment.text}</span>
                    </div>
                    {user?.id === comment.userId && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="text-red-400 hover:text-red-500 shrink-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Comment Input */}
            {user && (
              <div className="flex gap-2 items-center bg-white/10 rounded-full px-3 py-1.5">
                <Input
                  type="text"
                  placeholder="Comentário..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && newComment.trim()) {
                      handleAddComment();
                    }
                  }}
                  className="flex-1 bg-transparent border-0 text-xs text-white placeholder-white/50 focus:outline-none focus-visible:ring-0 h-6"
                  disabled={isAddingComment}
                />
                <button
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || isAddingComment}
                  className="text-white hover:text-brand disabled:opacity-50 shrink-0"
                >
                  <Send className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatTimeAgo(date: string): string {
  const now = new Date();
  const storyTime = new Date(date);
  const diffMs = now.getTime() - storyTime.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return "agora";
  if (diffMins < 60) return `${diffMins}m atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;

  return storyTime.toLocaleDateString("pt-BR");
}
