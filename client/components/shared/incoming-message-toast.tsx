import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { UserAvatar } from "@/components/shared/user-avatar";
import { conversationPreviewText } from "@/components/community/community-helpers";
import { useLanguage } from "@/lib/language-context";
import {
  subscribeIncomingMessageToast,
  type IncomingMessagePayload,
} from "@/lib/incoming-message-toast";
import { getUserProfileDb } from "@/lib/ritmofit-db";

/** Tempo em tela antes de sumir sozinho. */
const AUTO_DISMISS_MS = 5000;

type Banner = {
  senderId: string;
  name: string;
  photo: string | null;
  preview: string;
};

/**
 * Pop up "fulano te mandou uma mensagem", exibido em QUALQUER tela enquanto o
 * app está aberto (feed, metas, perfil…). Montado uma única vez no `AppLayout`
 * e alimentado pelo `incoming-message-toast` pub/sub.
 *
 * Regras de comportamento:
 * - some sozinho em 5s, ou ao arrastar para cima (gesto de banner do iOS);
 * - tocar abre a conversa com o remetente (`/comunidade?user=<id>`);
 * - a mensagem cuja conversa já está ABERTA nem chega aqui — o AppLayout filtra
 *   pelo `active-conversation` e naquele caso o celular só vibra.
 *
 * A vibração fica no AppLayout (junto do evento realtime) e não aqui: ela deve
 * acontecer inclusive quando o banner é suprimido.
 */
export function IncomingMessageToast() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [banner, setBanner] = React.useState<Banner | null>(null);
  // Reinicia a animação quando um banner substitui outro (mesma posição na tela).
  const [tick, setTick] = React.useState(0);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ignora a resposta de um perfil que chegou depois de uma mensagem mais nova.
  const latestRef = React.useRef<IncomingMessagePayload | null>(null);
  // Arrastar não pode contar como toque (senão o swipe para dispensar navega).
  const draggedRef = React.useRef(false);

  // O efeito de assinatura roda uma vez só — `t` numa ref é o que faz o preview
  // ("🎤 Áudio") acompanhar a troca de idioma em vez de congelar no da montagem.
  const tRef = React.useRef(t);
  React.useEffect(() => { tRef.current = t; }, [t]);

  React.useEffect(() => {
    return subscribeIncomingMessageToast((payload) => {
      latestRef.current = payload;
      const translate = tRef.current;
      // Busca apelido/foto antes de mostrar (getUserProfileDb é cacheado, então
      // no bate-papo em andamento é instantâneo). Mostrar primeiro e preencher
      // depois faria o nome piscar de "Alguém" para o real.
      getUserProfileDb(payload.senderId)
        .catch(() => null)
        .then((profile) => {
          if (latestRef.current !== payload) return;
          if (timerRef.current) clearTimeout(timerRef.current);
          setBanner({
            senderId: payload.senderId,
            name: profile?.nickname?.trim() || translate("notif_sender_fallback"),
            photo: profile?.photo ?? null,
            preview:
              conversationPreviewText(payload.text, translate) ??
              translate("community_message_label"),
          });
          setTick((n) => n + 1);
          timerRef.current = setTimeout(() => setBanner(null), AUTO_DISMISS_MS);
        });
    });
  }, []);

  React.useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const dismiss = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    latestRef.current = null;
    setBanner(null);
  }, []);

  const openConversation = React.useCallback((senderId: string) => {
    dismiss();
    navigate(`/comunidade?user=${senderId}`);
  }, [dismiss, navigate]);

  return (
    <div
      className="fixed inset-x-0 z-[9999] flex justify-center px-3 pointer-events-none"
      style={{ top: "max(12px, env(safe-area-inset-top))" }}
    >
      <AnimatePresence>
        {banner && (
          <motion.button
            key={`incoming-message-${tick}`}
            type="button"
            aria-label={t("community_msg_toast_open").replace("{name}", banner.name)}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.5, bottom: 0 }}
            onDragStart={() => { draggedRef.current = true; }}
            onDragEnd={(_, info) => {
              if (info.offset.y < -32) dismiss();
              // Solta o bloqueio só no próximo frame: o clique do fim do arrasto
              // ainda está a caminho quando este callback roda.
              requestAnimationFrame(() => { draggedRef.current = false; });
            }}
            onClick={() => {
              if (draggedRef.current) return;
              openConversation(banner.senderId);
            }}
            initial={{ opacity: 0, y: -28, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
            className="pointer-events-auto flex w-full max-w-[420px] items-center gap-3 rounded-[22px] px-3.5 py-3 text-left active:scale-[0.98] transition-transform"
            style={{
              background: "linear-gradient(rgba(255,255,255,.14),rgba(255,255,255,.06))",
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              border: "1px solid rgba(255,255,255,.16)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.28), 0 14px 34px -10px rgba(0,0,0,.65)",
            }}
          >
            <div className="relative flex-shrink-0">
              <UserAvatar photo={banner.photo} nickname={banner.name} size="md" className="border border-white/25" />
              <span
                className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full"
                style={{ background: "#5b8cff", border: "1.5px solid #0a0b12" }}
              >
                <MessageCircle className="h-[10px] w-[10px] text-white" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight text-white">{banner.name}</p>
              <p className="truncate text-xs leading-tight text-white/70">{banner.preview}</p>
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
