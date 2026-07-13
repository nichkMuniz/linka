import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { toast } from "@/components/ui/use-toast";
import { Copy, Link, ExternalLink, SendHorizontal } from "lucide-react";
import { Share } from "@capacitor/share";
import { useLanguage } from "@/lib/language-context";
import { SHARE_BASE_URL } from "@/lib/share-url";

interface ShareDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  text: string;
  /** URL a ser compartilhada. Se não fornecida, usa SHARE_BASE_URL (linka.app). */
  url?: string;
  /** Título do drawer */
  title?: string;
  /**
   * Envio interno via mensagem privada (estilo Instagram). Quando fornecido,
   * exibe o botão "Amigos" como primeira opção — o pai abre o SendToFriendDrawer.
   */
  onSendToFriend?: () => void;
}

export function ShareDrawer({
  open,
  onOpenChange,
  text,
  url,
  title,
  onSendToFriend,
}: ShareDrawerProps) {
  const { t } = useLanguage();
  // Dentro do WebView do Capacitor, window.location.href é "capacitor://localhost",
  // que não pode ser compartilhado. Usar sempre o domínio público como fallback.
  const shareUrl = url || SHARE_BASE_URL;

  /** Compartilhamento nativo — envia apenas o link */
  const handleNativeShare = async () => {
    try {
      await Share.share({
        title: text,
        url: shareUrl,
        dialogTitle: t("share_dialog_via"),
      });
      return true;
    } catch {
      return false;
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast({ title: t("share_copied_title"), description: t("share_copied_desc") });
      onOpenChange(false);
    }).catch(() => {
      toast({ title: t("share_copy_error_title"), description: t("share_copy_error_desc"), variant: "destructive" });
    });
  };

  const shareWhatsApp = async () => {
    const shared = await handleNativeShare();
    if (!shared) {
      const encoded = encodeURIComponent(shareUrl);
      window.open(`https://wa.me/?text=${encoded}`, "_blank", "noopener,noreferrer");
    }
    onOpenChange(false);
  };

  const shareFacebook = () => {
    const encoded = encodeURIComponent(shareUrl);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encoded}`, "_blank", "noopener,noreferrer");
    onOpenChange(false);
  };

  const shareInstagram = async () => {
    const shared = await handleNativeShare();
    if (!shared) {
      navigator.clipboard.writeText(shareUrl).catch(() => { });
      toast({
        title: t("share_instagram_fallback_title"),
        description: t("share_instagram_fallback_desc"),
      });
    }
    onOpenChange(false);
  };

  const shareTelegram = async () => {
    const shared = await handleNativeShare();
    if (!shared) {
      window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}`, "_blank", "noopener,noreferrer");
    }
    onOpenChange(false);
  };

  const shareTwitterX = () => {
    window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}`, "_blank", "noopener,noreferrer");
    onOpenChange(false);
  };

  const handleMoreOptions = async () => {
    const shared = await handleNativeShare();
    if (!shared) {
      copyToClipboard();
    } else {
      onOpenChange(false);
    }
  };

  const displayUrl = shareUrl.replace(/^https?:\/\//, "");

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
        className="max-h-[90vh] !rounded-t-[32px] !border-0"
        style={{
          background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderTop: "1px solid rgba(255,255,255,.14)",
        }}
      >
        <DrawerHeader className="pb-2">
          <DrawerTitle style={{ color: "#fff" }}>{title ?? t("share_title")}</DrawerTitle>
        </DrawerHeader>

        {/* Preview card */}
        <div className="px-4 pb-3">
          <div className="rounded-2xl overflow-hidden shadow-sm p-3 space-y-1" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
            <p className="text-sm line-clamp-2 leading-snug" style={{ color: "#fff" }}>{text}</p>
            <div className="flex items-center gap-1.5 text-xs text-primary">
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate font-medium">{displayUrl}</span>
            </div>
          </div>
        </div>

        {/* App share buttons */}
        <div className="flex gap-4 px-4 py-3 overflow-x-auto">
          {/* Enviar para amigos no LinKa (mensagem privada) */}
          {onSendToFriend && (
            <button
              onClick={() => {
                onOpenChange(false);
                onSendToFriend();
              }}
              className="flex flex-col items-center gap-1.5 min-w-[60px]"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-md"
                style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)" }}
              >
                <SendHorizontal className="w-7 h-7 text-white" />
              </div>
              <span className="text-xs text-center" style={{ color: "rgba(255,255,255,.7)" }}>{t("share_btn_send_friend")}</span>
            </button>
          )}

          {/* WhatsApp */}
          <button onClick={shareWhatsApp} className="flex flex-col items-center gap-1.5 min-w-[60px]">
            <div className="w-14 h-14 rounded-2xl bg-[#25D366] flex items-center justify-center shadow-md">
              <svg viewBox="0 0 24 24" className="w-8 h-8 fill-white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </div>
            <span className="text-xs text-center" style={{ color: "rgba(255,255,255,.7)" }}>{t("share_btn_whatsapp")}</span>
          </button>

          {/* Instagram */}
          <button onClick={shareInstagram} className="flex flex-col items-center gap-1.5 min-w-[60px]">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-md"
              style={{ background: "linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)" }}>
              <svg viewBox="0 0 24 24" className="w-8 h-8 fill-white">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </div>
            <span className="text-xs text-center" style={{ color: "rgba(255,255,255,.7)" }}>{t("share_btn_instagram")}</span>
          </button>

          {/* Facebook */}
          <button onClick={shareFacebook} className="flex flex-col items-center gap-1.5 min-w-[60px]">
            <div className="w-14 h-14 rounded-2xl bg-[#1877F2] flex items-center justify-center shadow-md">
              <svg viewBox="0 0 24 24" className="w-8 h-8 fill-white">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </div>
            <span className="text-xs text-center" style={{ color: "rgba(255,255,255,.7)" }}>{t("share_btn_facebook")}</span>
          </button>

          {/* Telegram */}
          <button onClick={shareTelegram} className="flex flex-col items-center gap-1.5 min-w-[60px]">
            <div className="w-14 h-14 rounded-2xl bg-[#2CA5E0] flex items-center justify-center shadow-md">
              <svg viewBox="0 0 24 24" className="w-8 h-8 fill-white">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
            </div>
            <span className="text-xs text-center" style={{ color: "rgba(255,255,255,.7)" }}>{t("share_btn_telegram")}</span>
          </button>

          {/* X / Twitter */}
          <button onClick={shareTwitterX} className="flex flex-col items-center gap-1.5 min-w-[60px]">
            <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center shadow-md">
              <svg viewBox="0 0 24 24" className="w-8 h-8 fill-white">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </div>
            <span className="text-xs text-center" style={{ color: "rgba(255,255,255,.7)" }}>{t("share_btn_x")}</span>
          </button>

          {/* Mais opções */}
          <button onClick={handleMoreOptions} className="flex flex-col items-center gap-1.5 min-w-[60px]">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm" style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.15)" }}>
              <Link className="w-7 h-7" style={{ color: "rgba(255,255,255,.8)" }} />
            </div>
            <span className="text-xs text-center" style={{ color: "rgba(255,255,255,.7)" }}>{t("share_btn_more")}</span>
          </button>

          {/* Copiar */}
          <button onClick={copyToClipboard} className="flex flex-col items-center gap-1.5 min-w-[60px]">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm" style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.15)" }}>
              <Copy className="w-7 h-7" style={{ color: "rgba(255,255,255,.8)" }} />
            </div>
            <span className="text-xs text-center" style={{ color: "rgba(255,255,255,.7)" }}>{t("share_btn_copy")}</span>
          </button>
        </div>

        <div className="h-6" />
      </DrawerContent>
    </Drawer>
  );
}
