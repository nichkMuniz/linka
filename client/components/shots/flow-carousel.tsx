import * as React from "react";
import { StoryWithUser } from "@/lib/ritmofit-db";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";

interface FlowCarouselProps {
  stories: StoryWithUser[];
  onAddStoryClick: () => void;
  onStoryClick: (story: StoryWithUser) => void;
  currentUserId: string;
  currentUserPhoto?: string | null;
  currentUserGender?: string | null;
  currentUserNickname?: string | null;
  isOwnerViewing?: boolean;
  viewedStoryIds?: Set<string>;
}

export function FlowCarousel({
  stories,
  onAddStoryClick,
  onStoryClick,
  currentUserId,
  currentUserPhoto,
  currentUserGender,
  currentUserNickname,
  isOwnerViewing,
  viewedStoryIds,
}: FlowCarouselProps) {
  // Group stories by user — always overwrite so the last entry (oldest, since array is newest-first) is stored.
  // This ensures clicking opens from the first (oldest) story posted.
  const storyMap = new Map<string, StoryWithUser>();
  stories.forEach((story) => {
    storyMap.set(story.user_id, story);
  });

  const uniqueStories = Array.from(storyMap.values());
  // Sort avatars by newest first so most recent activity appears first
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
    <div className="flex gap-3 overflow-x-auto pb-4 px-4 pt-2 scroll-smooth">
      {/* Seu Flow Button - with menu if user has a story */}
      {userStory ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="shrink-0 flex flex-col items-center gap-1 group cursor-pointer">
              <div className="relative">
                <div className="h-[60px] w-[60px] rounded-full p-[3px] bg-brand-gradient transition-all">
                  <div className="h-full w-full rounded-full overflow-hidden ring-[2.5px] ring-background">
                    <UserAvatar
                      photo={currentUserPhoto ?? userStory.userPhoto}
                      gender={currentUserGender ?? userStory.userGender}
                      nickname={currentUserNickname ?? userStory.userNickname}
                      className="h-full w-full"
                    />
                  </div>
                </div>
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
          <div className="relative h-14 w-14">
            <div className="h-14 w-14 rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-brand transition-all">
              <UserAvatar
                photo={currentUserPhoto}
                gender={currentUserGender}
                nickname={currentUserNickname ?? "Seu flow"}
                className="h-full w-full"
              />
            </div>
            <div className="absolute bottom-0 right-0 h-5 w-5 bg-brand rounded-full flex items-center justify-center ring-2 ring-background">
              <Plus className="h-3 w-3 text-white" />
            </div>
          </div>
          <span className="text-xs text-center whitespace-nowrap">
            Seu flow
          </span>
        </button>
      )}

      {/* Other Stories */}
      {otherStories.length > 0 &&
        otherStories.map((story) => {
          const isViewed = viewedStoryIds?.has(story.id) ?? false;
          return (
            <button
              key={story.id}
              onClick={() => onStoryClick(story)}
              className="shrink-0 flex flex-col items-center gap-1 group cursor-pointer"
            >
              <div className="relative">
                <div className={`h-[60px] w-[60px] rounded-full p-[3px] transition-all ${
                  isViewed
                    ? "bg-muted-foreground/30"
                    : "bg-brand-gradient"
                }`}>
                  <div className="h-full w-full rounded-full overflow-hidden ring-[2.5px] ring-background">
                    <UserAvatar
                      photo={story.userPhoto}
                      gender={story.userGender}
                      nickname={story.userNickname}
                      className="h-full w-full"
                    />
                  </div>
                </div>
              </div>
              <span className={`text-xs text-center truncate max-w-[60px] ${isViewed ? "text-muted-foreground" : ""}`}>
                {story.userNickname.split(" ")[0]}
              </span>
            </button>
          );
        })}
    </div>
  );
}
