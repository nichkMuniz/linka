import * as React from "react";
import { StoryWithUser } from "@/lib/ritmofit-db";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface StoriesCarouselProps {
  stories: StoryWithUser[];
  onAddStoryClick: () => void;
  onStoryClick: (story: StoryWithUser) => void;
  currentUserId: string;
}

export function StoriesCarousel({
  stories,
  onAddStoryClick,
  onStoryClick,
  currentUserId,
}: StoriesCarouselProps) {
  // Group stories by user and take only the first one per user (most recent)
  const storyMap = new Map<string, StoryWithUser>();
  stories.forEach((story) => {
    if (!storyMap.has(story.user_id)) {
      storyMap.set(story.user_id, story);
    }
  });

  const uniqueStories = Array.from(storyMap.values());
  // Sort by created_at to show newest first
  uniqueStories.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 px-4 -mx-4 scroll-smooth">
      {/* Add Story Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onAddStoryClick}
        className="shrink-0 flex flex-col items-center gap-1 h-auto py-2 px-3 rounded-lg"
      >
        <div className="relative h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <Plus className="h-5 w-5" />
        </div>
        <span className="text-xs text-center whitespace-nowrap">Sua story</span>
      </Button>

      {/* Stories */}
      {uniqueStories.length > 0 ? (
        uniqueStories.map((story) => (
          <button
            key={story.id}
            onClick={() => onStoryClick(story)}
            className="shrink-0 flex flex-col items-center gap-1 group cursor-pointer"
          >
            <div className="relative">
              <div className="h-14 w-14 rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-brand transition-all">
                {story.userPhoto ? (
                  <img
                    src={story.userPhoto}
                    alt={story.userNickname}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-muted" />
                )}
              </div>
              {story.user_id === currentUserId && (
                <div className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full ring-1 ring-background" />
              )}
            </div>
            <span className="text-xs text-center truncate max-w-[60px]">
              {story.user_id === currentUserId
                ? "Você"
                : story.userNickname.split(" ")[0]}
            </span>
          </button>
        ))
      ) : (
        <div className="w-full text-center py-4 text-xs text-muted-foreground">
          Sem stories no momento
        </div>
      )}
    </div>
  );
}
