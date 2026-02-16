import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PostIncentiveButton } from "@/components/post-incentive-button";
import { toast } from "@/components/ui/use-toast";
import {
  getReelsDb,
  toggleReelIncentiveDb,
  addReelCommentDb,
  getReelCommentsDb,
  deleteReelCommentDb,
  followUserDb,
  unfollowUserDb,
  isFollowingDb,
  type ReelWithUser,
  type ReelComment,
  type PostIncentiveType,
} from "@/lib/ritmofit-db";
import {
  MessageCircle,
  Send,
  Trash2,
  UserPlus,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

export default function Reels({ footerHeight = 70 }: { footerHeight?: number }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [reels, setReels] = React.useState<ReelWithUser[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [visibleReelId, setVisibleReelId] = React.useState<string | null>(null);
  const [togglingReelId, setTogglingReelId] = React.useState<string | null>(null);

  const [commentsOpen, setCommentsOpen] = React.useState(false);
  const [selectedReel, setSelectedReel] = React.useState<ReelWithUser | null>(null);

  const [comments, setComments] = React.useState<ReelComment[]>([]);
  const [commentText, setCommentText] = React.useState("");

  const [quickCommentText, setQuickCommentText] = React.useState("");

  const containerRef = React.useRef<HTMLDivElement>(null);
  const videoRefsMap = React.useRef<Record<string, HTMLVideoElement>>({});

  const availableHeight = `calc(100dvh - ${footerHeight}px)`;

  // Load reels
  React.useEffect(() => {
    (async () => {
      try {
        const data = await getReelsDb();
        setReels(data);
      } catch (err: any) {
        toast({
          title: "Erro ao carregar reels",
          description: err?.message,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Intersection observer
  React.useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const reelId = entry.target.getAttribute("data-reel-id");

          if (!reelId) return;

          const video = videoRefsMap.current[reelId];

          if (entry.isIntersecting) {
            setVisibleReelId(reelId);
            video?.play().catch(() => {});
          } else {
            video?.pause();
          }
        });
      },
      {
        root: containerRef.current,
        threshold: 0.6,
      }
    );

    const nodes = containerRef.current.querySelectorAll("[data-reel-id]");
    nodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, [reels]);

  async function handleQuickComment() {
    if (!quickCommentText.trim() || !visibleReelId) return;

    try {
      await addReelCommentDb(visibleReelId, quickCommentText);

      setQuickCommentText("");

      toast({
        title: "Comentário enviado",
      });
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message,
      });
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center bg-black text-white h-full">
        Carregando...
      </div>
    );

  return (
    <div
      style={{
        height: availableHeight,
        width: "100%",
        position: "relative",
        overflow: "hidden",
        background: "black",
      }}
    >
      {/* CONTAINER SCROLL */}
      <div
        ref={containerRef}
        style={{
          height: "100%",
          width: "100%",
          overflowY: "scroll",
          overflowX: "hidden",
          scrollSnapType: "y mandatory",
        }}
      >
        {reels.map((reel) => (
          <div
            key={reel.id}
            data-reel-id={reel.id}
            style={{
              height: availableHeight,
              width: "100%",
              scrollSnapAlign: "start",
              position: "relative",
            }}
          >
            {/* VIDEO */}
            <video
              ref={(el) => {
                if (el) videoRefsMap.current[reel.id] = el;
              }}
              src={reel.video_url}
              muted
              loop
              playsInline
              style={{
                height: "100%",
                width: "100%",
                objectFit: "cover",
              }}
            />

            {/* USER */}
            <div
              style={{
                position: "absolute",
                top: 20,
                left: 20,
                color: "white",
                fontWeight: "bold",
              }}
            >
              {reel.userNickname}
            </div>

            {/* INCENTIVES */}
            <div
              style={{
                position: "absolute",
                right: 10,
                bottom: 140,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {[1, 2, 3, 4, 5, 6].map((type) => (
                <PostIncentiveButton
                  key={type}
                  type={type as PostIncentiveType}
                  isActive={(reel.userLikes || []).includes(type as any)}
                  onClick={() => toggleReelIncentiveDb(reel.id, type as any)}
                  loading={false}
                />
              ))}

              <button onClick={() => setSelectedReel(reel)}>
                <MessageCircle color="white" size={28} />
              </button>
            </div>

            {/* COMMENT INPUT */}
            {user && (
              <div
                style={{
                  position: "absolute",
                  bottom: footerHeight + 10,
                  left: 10,
                  right: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    background: "rgba(0,0,0,0.5)",
                    padding: 10,
                    borderRadius: 30,
                  }}
                >
                  <Input
                    value={quickCommentText}
                    onChange={(e) => setQuickCommentText(e.target.value)}
                    placeholder="Comente..."
                    className="bg-transparent border-0 text-white"
                  />

                  <Button onClick={handleQuickComment}>
                    <Send size={18} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* COMMENTS DRAWER */}
      <Drawer
        open={selectedReel !== null}
        onOpenChange={() => setSelectedReel(null)}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Comentários</DrawerTitle>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
