import * as React from "react";
import { StoryWithUser } from "@/lib/ritmofit-db";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

  // Separate user's story from others
  const userStory = uniqueStories.find((s) => s.user_id === currentUserId);
  const otherStories = uniqueStories.filter((s) => s.user_id !== currentUserId);

  const handleViewFlow = () => {
    if (userStory) {
      onStoryClick(userStory);
    }
  };

  const handleNewFlow = () => {
    onAddStoryClick();
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 px-6 scroll-smooth">
      {/* Seu Flow Button - with menu if user has a story */}
      {userStory ? (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button className="shrink-0 flex flex-col items-center gap-1 group cursor-pointer">
              <div className="relative">
                <div className="h-14 w-14 rounded-full overflow-hidden ring-2 ring-brand transition-all">
                  {userStory.userPhoto ? (
                    <img
                      src={userStory.userPhoto}
                      alt={userStory.userNickname}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-muted" />
                  )}
                </div>
                <div className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full ring-1 ring-background" />
              </div>
              <span className="text-xs text-center truncate max-w-[60px] font-semibold text-brand">
                Seu flow
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuItem onClick={handleViewFlow}>
              Ver flow
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleNewFlow}>
              Novo flow
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <button
          onClick={onAddStoryClick}
          className="shrink-0 flex flex-col items-center gap-1 group cursor-pointer hover:opacity-80 transition-opacity"
        >
          <div className="relative h-14 w-14 rounded-full bg-muted flex items-center justify-center ring-2 ring-transparent group-hover:ring-brand transition-all">
            <Plus className="h-5 w-5" />
          </div>
          <span className="text-xs text-center whitespace-nowrap">Seu flow</span>
        </button>
      )}

      {/* Other Stories */}
      {otherStories.length > 0 &&
        otherStories.map((story) => (
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
            </div>
            <span className="text-xs text-center truncate max-w-[60px]">
              {story.userNickname.split(" ")[0]}
            </span>
          </button>
        ))}
    </div>
  );
}
