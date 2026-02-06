import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StoryWithUser } from "@/lib/ritmofit-db";
import { X, ChevronRight } from "lucide-react";

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
  React.useEffect(() => {
    if (!open) return;

    // Auto-close after 5 seconds
    const timer = setTimeout(() => {
      onOpenChange(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, [open, onOpenChange, story]);

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
        <div className="relative w-full h-full flex flex-col">
          {/* Header with user info and close button */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 z-10">
            <div className="flex items-center gap-3">
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
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="text-white hover:text-gray-300"
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

            {/* Description Overlay */}
            {story.description && (
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent z-10">
                <p className="text-sm text-white">
                  {story.description}
                </p>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-gray-800 z-10">
            <div className="h-full bg-white/60 animate-pulse" />
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
