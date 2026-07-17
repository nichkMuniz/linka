import * as React from "react";
import { getChatMediaUrlDb, peekChatMediaUrl } from "@/lib/ritmofit-db";

/**
 * Mídia de mensagem direta.
 *
 * O texto da mensagem guarda `chat:<path>` (bucket privado `chat-media`) ou,
 * para mensagens antigas, a URL pública completa. Em ambos os casos quem
 * resolve para uma URL exibível é `getChatMediaUrlDb` — no caso do bucket
 * privado ela assina uma URL temporária, que só o remetente e o destinatário
 * conseguem gerar (RLS em storage.objects).
 *
 * Como assinar é assíncrono, a URL é resolvida em efeito e a bolha mostra um
 * placeholder até chegar. Quando a URL já está assinada em memória
 * (`peekChatMediaUrl`), ela entra direto no estado inicial: a bolha nasce com a
 * mídia, sem passar pelo placeholder — é o caso de toda reabertura da conversa.
 */
function useChatMediaUrl(ref: string): string | null {
  const [url, setUrl] = React.useState<string | null>(() => peekChatMediaUrl(ref));

  React.useEffect(() => {
    const cachedUrl = peekChatMediaUrl(ref);
    if (cachedUrl) {
      setUrl(cachedUrl);
      return;
    }

    let active = true;
    setUrl(null);
    getChatMediaUrlDb(ref)
      .then((resolved) => {
        if (active) setUrl(resolved);
      })
      .catch(() => {
        if (active) setUrl(null);
      });
    return () => {
      active = false;
    };
  }, [ref]);

  return url;
}

export function ChatImageMessage({
  mediaRef,
  onOpen,
}: {
  mediaRef: string;
  onOpen: (url: string) => void;
}) {
  const url = useChatMediaUrl(mediaRef);

  if (!url) {
    return (
      <div className="rounded-lg w-[220px] h-[160px] animate-pulse bg-white/10" />
    );
  }

  return (
    <img
      src={url}
      alt=""
      className="rounded-lg max-w-[220px] max-h-[280px] object-cover cursor-pointer"
      onClick={() => onOpen(url)}
    />
  );
}

export function ChatAudioMessage({
  mediaRef,
  isOwn,
}: {
  mediaRef: string;
  isOwn: boolean;
}) {
  const url = useChatMediaUrl(mediaRef);

  if (!url) {
    return <div className="max-w-[220px] w-[220px] h-10 rounded-lg animate-pulse bg-white/10" />;
  }

  return (
    <audio
      src={url}
      controls
      preload="auto"
      className="max-w-[220px] h-10 rounded-lg"
      style={{ colorScheme: isOwn ? "dark" : "light" }}
      onError={(e) => {
        const el = e.target as HTMLAudioElement;
        console.error("Audio playback error:", el.error);
      }}
    />
  );
}
