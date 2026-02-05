import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StoryWithUser } from "@/lib/ritmofit-db";
import { X } from "lucide-react";

interface StoryViewerModalProps {
  story: StoryWithUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StoryViewerModal({
  story,
  open,
  onOpenChange,
}: StoryViewerModalProps) {
  React.useEffect(() => {
    if (!open) return;

    // Auto-close after 5 seconds
    const timer = setTimeout(() => {
      onOpenChange(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, [open, onOpenChange]);

  if (!story) return null;

  const isVideo = story.media_url?.includes(".mp4") ||
    story.media_url?.includes(".webm") ||
    story.media_url?.includes(".mov") || (story.media_url?.startsWith("data:") && story.media_url?.includes("video"));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] p-0 border-0 bg-black/95">
        <div className="relative w-full h-full flex flex-col">
          {/* Header with user info and close button */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
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

          {/* Media and Description */}
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4 min-h-[300px]">
            {isVideo ? (
              <video
                src={story.media_url}
                controls
                className="max-h-[60vh] max-w-full rounded-lg"
                autoPlay
              />
            ) : (
              <img
                src={story.media_url}
                alt="Story"
                className="max-h-[60vh] max-w-full rounded-lg object-contain"
              />
            )}

            {story.description && (
              <p className="text-sm text-gray-100 text-center max-w-md">
                {story.description}
              </p>
            )}
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-gray-800">
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
