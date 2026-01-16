import * as React from "react";
import { MessageCircle, Send, Volume2, VolumeX } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Reel = {
  id: string;
  title: string;
  author: string;
  handle: string;
  videoUrl: string;
  posterUrl: string;
};

const reels: Reel[] = [
  {
    id: "r1",
    title: "Treino rápido: 5 min de HIIT",
    author: "Ana",
    handle: "@ana.fit",
    // Pexels mp4 (pode variar por CDN; para MVP serve bem)
    videoUrl:
      "https://videos.pexels.com/video-files/3761540/3761540-hd_720_1366_30fps.mp4",
    posterUrl:
      "https://images.pexels.com/photos/841130/pexels-photo-841130.jpeg",
  },
  {
    id: "r2",
    title: "Mobilidade para ombro (sem dor)",
    author: "Nicholas",
    handle: "@nicholas",
    videoUrl:
      "https://videos.pexels.com/video-files/4763823/4763823-hd_720_1280_30fps.mp4",
    posterUrl:
      "https://images.pexels.com/photos/28427829/pexels-photo-28427829.jpeg",
  },
  {
    id: "r3",
    title: "Ideia de marmita: prato equilibrado",
    author: "Bruno",
    handle: "@bruno.nutri",
    videoUrl:
      "https://videos.pexels.com/video-files/3830500/3830500-hd_720_1280_25fps.mp4",
    posterUrl:
      "https://images.pexels.com/photos/33489594/pexels-photo-33489594.jpeg",
  },
];

function ReelItem({ reel, muted }: { reel: Reel; muted: boolean }) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onPlay = () => setPaused(false);
    const onPause = () => setPaused(true);

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);

    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, []);

  return (
    <div className="relative h-[calc(100dvh-5rem)] w-full snap-start overflow-hidden rounded-3xl bg-black">
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        src={reel.videoUrl}
        poster={reel.posterUrl}
        muted={muted}
        loop
        playsInline
        autoPlay
        onClick={() => {
          const v = videoRef.current;
          if (!v) return;
          if (v.paused) v.play();
          else v.pause();
        }}
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/10" />

      <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">
            {reel.author} <span className="text-white/70">{reel.handle}</span>
          </div>
          <div className="mt-1 line-clamp-2 text-sm text-white/85">
            {reel.title}
          </div>
          {paused ? (
            <div className="mt-2 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs text-white/90 ring-1 ring-white/15">
              Pausado
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-11 w-11 rounded-full bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15"
          >
            <MessageCircle className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-11 w-11 rounded-full bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="absolute right-3 top-3 rounded-full bg-black/40 px-3 py-1 text-xs text-white/80 ring-1 ring-white/10">
        {muted ? "Sem som" : "Com som"}
      </div>
    </div>
  );
}

export default function Reels() {
  const [muted, setMuted] = React.useState(true);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-3 flex items-center justify-end">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-full"
          aria-label={muted ? "Ativar som" : "Desativar som"}
          onClick={() => setMuted((v) => !v)}
        >
          {muted ? (
            <VolumeX className="h-5 w-5" />
          ) : (
            <Volume2 className="h-5 w-5" />
          )}
        </Button>
      </div>

      <div
        className={cn(
          "h-[calc(100dvh-7rem)] snap-y snap-mandatory overflow-y-auto",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        <div className="grid gap-4 pb-6">
          {reels.map((r) => (
            <ReelItem key={r.id} reel={r} muted={muted} />
          ))}
        </div>
      </div>
    </div>
  );
}
