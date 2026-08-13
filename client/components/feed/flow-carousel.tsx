import { useNavigate } from "react-router-dom";
import { StoryWithUser } from "@/lib/ritmofit-db";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { hapticLight } from "@/lib/haptics";
import { prefetchFlowMedia } from "@/lib/media-prefetch";
import { pickFlowEntry } from "@/lib/flow-entry";

interface FlowCarouselProps {
  stories: StoryWithUser[];
  onAddStoryClick: () => void;
  currentUserId: string;
  currentUserPhoto?: string | null;
  currentUserNickname?: string | null;
  viewedStoryIds?: Set<string>;
  onStoryView?: (storyId: string) => void;
}

export function FlowCarousel({
  stories,
  onAddStoryClick,
  currentUserId,
  currentUserPhoto,
  currentUserNickname,
  viewedStoryIds,
  onStoryView,
}: FlowCarouselProps) {
  const navigate = useNavigate();
  // Group stories by user — always overwrite so the last entry (oldest, since array is newest-first) is stored.
  // This ensures clicking opens from the first (oldest) story posted.
  const storyMap = new Map<string, StoryWithUser>();
  stories.forEach((story) => {
    storyMap.set(story.user_id, story);
  });

  // All story ids per user (not just the oldest representative) — needed so the ring
  // reflects "has anything new" instead of only the state of a single fixed story id.
  const storiesByUserId = new Map<string, StoryWithUser[]>();
  stories.forEach((story) => {
    const list = storiesByUserId.get(story.user_id);
    if (list) list.push(story);
    else storiesByUserId.set(story.user_id, [story]);
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
    if (!userStory) return;
    // A página do flow ainda vai buscar os flows no banco antes de montar o player —
    // começar o download aqui aproveita essa janela em vez de esperar por ela.
    prefetchFlowMedia(userStory, "auto");
    navigate(`/flows/${userStory.id}`);
  };

  const CONIC_GRADIENTS = [
    "conic-gradient(from 200deg,#ff8a2a,#d8567a,#7b3ff2,#3a8dff,#ff8a2a)",
    "conic-gradient(from 40deg,#3a8dff,#7b3ff2,#ff8a2a,#3a8dff)",
    "conic-gradient(from 120deg,#4fb87a,#3a8dff,#7b3ff2,#4fb87a)",
    "conic-gradient(from 300deg,#7b3ff2,#3a8dff,#4fb87a,#7b3ff2)",
  ];

  function storyRing(userId: string) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
    return CONIC_GRADIENTS[hash % CONIC_GRADIENTS.length];
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 px-4 pt-2 scroll-smooth" style={{ scrollbarWidth: "none" }}>
      {/* Seu Flow Button */}
      {userStory ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="shrink-0 flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform">
              <div
                className="h-[62px] w-[62px] rounded-full p-[2.5px]"
                style={{ background: storyRing(currentUserId) }}
              >
                <div className="h-full w-full rounded-full overflow-hidden" style={{ border: "2px solid #06070c" }}>
                  <UserAvatar
                    photo={currentUserPhoto ?? userStory.userPhoto}
                    nickname={currentUserNickname ?? userStory.userNickname}
                    className="h-full w-full"
                  />
                </div>
              </div>
              <span className="text-[11px] text-center truncate max-w-[62px] text-white/85 font-medium">
                Você
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuItem onClick={handleViewFlow}>
              Ver flow
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAddStoryClick}>
              Novo flow
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <button
          onClick={() => { hapticLight(); onAddStoryClick(); }}
          className="shrink-0 flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
        >
          <div className="relative h-[62px] w-[62px]">
            <div
              className="h-[62px] w-[62px] rounded-full p-[2.5px]"
              style={{ background: "linear-gradient(rgba(255,255,255,.28),rgba(255,255,255,.1))", border: "1px dashed rgba(255,255,255,.3)" }}
            >
              <div className="h-full w-full rounded-full overflow-hidden" style={{ border: "2px solid #06070c" }}>
                <UserAvatar
                  photo={currentUserPhoto}
                  nickname={currentUserNickname ?? "Você"}
                  className="h-full w-full"
                />
              </div>
            </div>
            <div
              className="absolute bottom-0 right-0 h-[22px] w-[22px] rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", border: "2px solid #06070c" }}
            >
              <Plus className="h-3 w-3 text-white" />
            </div>
          </div>
          <span className="text-[11px] text-center text-white/65 whitespace-nowrap">
            Você
          </span>
        </button>
      )}

      {/* Other Stories */}
      {otherStories.length > 0 &&
        otherStories.map((story) => {
          const userStoryList = storiesByUserId.get(story.user_id) ?? [story];
          const isViewed = userStoryList.every((s) => viewedStoryIds?.has(s.id) ?? false);
          const entryStory = pickFlowEntry(userStoryList, viewedStoryIds) ?? story;
          return (
            <button
              key={story.id}
              // O dedo encostou → o clipe começa a baixar antes mesmo da navegação,
              // então o viewer abre com o vídeo pronto em vez de tela preta.
              onPointerDown={() => prefetchFlowMedia(entryStory, "auto")}
              onClick={() => {
                hapticLight();
                // Abre no 1º flow não visto — quem já viu os antigos vai direto ao novo.
                // Marca só esse (o que realmente será aberto): marcar o grupo inteiro
                // fazia o próximo toque achar que tudo tinha sido visto e voltar ao 1º.
                onStoryView?.(entryStory.id);
                navigate(`/flows/${entryStory.id}`);
              }}
              className="shrink-0 flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
            >
              <div
                className="h-[62px] w-[62px] rounded-full p-[2.5px]"
                style={{ background: isViewed ? "rgba(255,255,255,.18)" : storyRing(story.user_id) }}
              >
                <div className="h-full w-full rounded-full overflow-hidden" style={{ border: "2px solid #06070c" }}>
                  <UserAvatar
                    photo={story.userPhoto}
                    nickname={story.userNickname}
                    className="h-full w-full"
                  />
                </div>
              </div>
              <span className={`text-[11px] text-center truncate max-w-[62px] ${isViewed ? "text-white/40" : "text-white/85"}`}>
                {story.userNickname.split(" ")[0]}
              </span>
            </button>
          );
        })}
    </div>
  );
}
