import * as React from "react";
import {
  getPromotionsDb,
  createPromotionDb,
  deletePromotionDb,
  updatePromotionDb,
  togglePromotionLikeDb,
  reportPromotionStatusDb,
  PROMOTION_CATEGORIES,
  type Promotion,
  type PromotionCategory,
  getViewer,
  getProfessionalsDb,
  type ProfessionalProfile,
} from "@/lib/ritmofit-db";
import { PromotionCommentsDrawer, PromotionCommentsSection } from "@/components/modals/promotion-comments-drawer";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/language-context";
import type { TranslationKey } from "@/lib/i18n";
import { useKeyboardInputScroll } from "@/hooks/use-keyboard-input-scroll";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import { UserAvatar } from "@/components/shared/user-avatar";
import { LoadingSpinner, StoreSkeleton } from "@/components/shared/animated-loading";
import {
  Tag,
  Plus,
  Heart,
  ExternalLink,
  MoreVertical,
  Trash2,
  ShoppingBag,
  Dumbbell,
  Apple,
  Shirt,
  Briefcase,
  PackageOpen,
  Search,
  Ticket,
  Copy,
  Check,
  Link,
  ImageIcon,
  Upload,
  Pencil,
  Ban,
  Users,
  Phone,
  Mail,
  Globe,
  MessageCircle,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  ListChecks,
  History,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { openExternalUrl, isSafeExternalUrl } from "@/lib/safe-url";
import { copyToClipboard } from "@/lib/clipboard";
import { ImageCropperDrawer } from "@/components/shared/image-cropper-drawer";
import { Browser } from "@capacitor/browser";
import {
  GLASS_SHEET_STYLE,
  GLASS_FIELD_STYLE,
  GLASS_PRIMARY_BTN_STYLE,
  GLASS_SHEET_PROPS,
  GLASS_LABEL_CLASS,
  GLASS_FIELD_CLASS,
} from "@/lib/glass-styles";

// ─── Promotion Skeleton ──────────────────────────────────────────────────────

const GLASS_CARD_STYLE = {
  background: "linear-gradient(rgba(255,255,255,.09),rgba(255,255,255,.03))",
  backdropFilter: "blur(20px) saturate(170%)",
  WebkitBackdropFilter: "blur(20px) saturate(170%)" as string,
  border: "1px solid rgba(255,255,255,.10)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.18)",
} as const;


function PromotionSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden flex flex-col animate-pulse" style={GLASS_CARD_STYLE}>
      <div className="w-full aspect-[4/3] flex-shrink-0" style={{ background: "rgba(255,255,255,.06)" }} />
      <div className="p-3 flex flex-col gap-2">
        <div className="h-5 w-20 rounded-full" style={{ background: "rgba(255,255,255,.08)" }} />
        <div className="h-4 w-3/4 rounded" style={{ background: "rgba(255,255,255,.06)" }} />
        <div className="h-3 w-full rounded" style={{ background: "rgba(255,255,255,.05)" }} />
        <div className="h-3 w-2/3 rounded" style={{ background: "rgba(255,255,255,.05)" }} />
        <div className="flex items-center justify-between pt-2 mt-1" style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-5 rounded-full" style={{ background: "rgba(255,255,255,.08)" }} />
            <div className="h-3 w-16 rounded" style={{ background: "rgba(255,255,255,.06)" }} />
          </div>
          <div className="h-4 w-8 rounded" style={{ background: "rgba(255,255,255,.06)" }} />
        </div>
      </div>
    </div>
  );
}

// ─── Category icon map ──────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  equipamento: <Dumbbell className="h-4 w-4" />,
  suplemento: <ShoppingBag className="h-4 w-4" />,
  alimento: <Apple className="h-4 w-4" />,
  vestuario: <Shirt className="h-4 w-4" />,
  servico: <Briefcase className="h-4 w-4" />,
  outro: <PackageOpen className="h-4 w-4" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  equipamento: "bg-blue-500/15 text-blue-400",
  suplemento: "bg-purple-500/15 text-purple-400",
  alimento: "bg-green-500/15 text-green-400",
  vestuario: "bg-pink-500/15 text-pink-400",
  servico: "bg-orange-500/15 text-orange-400",
  outro: "bg-muted text-muted-foreground",
};

/** Rótulo traduzido de cada categoria — os `label` de PROMOTION_CATEGORIES são
 * apenas PT, então a tela resolve o texto pela chave de i18n. */
const CATEGORY_LABEL_KEYS: Record<string, TranslationKey> = {
  equipamento: "store_cat_equipamento",
  suplemento: "store_cat_suplemento",
  alimento: "store_cat_alimento",
  vestuario: "store_cat_vestuario",
  servico: "store_cat_servico",
  outro: "store_cat_outro",
};

type Translate = (key: TranslationKey) => string;

function categoryLabel(cat: string, t: Translate) {
  const key = CATEGORY_LABEL_KEYS[cat];
  return key ? t(key) : cat;
}

/** Formata uma data no idioma ativo da interface. */
function formatDate(value: string, language: string) {
  return new Date(value).toLocaleDateString(language === "en" ? "en-US" : "pt-BR");
}

/** Mantém apenas dígitos e uma única vírgula (separador decimal PT-BR) num input de preço. */
function sanitizePriceInput(raw: string): string {
  let cleaned = raw.replace(/[^0-9,]/g, "");
  const firstComma = cleaned.indexOf(",");
  if (firstComma !== -1) {
    cleaned = cleaned.slice(0, firstComma + 1) + cleaned.slice(firstComma + 1).replace(/,/g, "");
  }
  return cleaned;
}

/** Converte "99,90" (string do input) para 99.9 (number), como parseFloat espera ponto. */
function parsePriceInput(value: string): number {
  return parseFloat(value.replace(",", "."));
}

/** Converte um preço numérico do banco (ponto) para o formato do input (vírgula). */
function formatPriceInput(n: number | null | undefined): string {
  if (n == null) return "";
  return String(n).replace(".", ",");
}

/** Expirada por data de validade OU por maioria de votos "expirou" da comunidade. */
function isPromoExpired(p: Promotion): boolean {
  if (p.expires_at) {
    const todayStr = new Date().toISOString().split("T")[0];
    if (p.expires_at.slice(0, 10) < todayStr) return true;
  }
  const expiredReports = p.expired_reports ?? 0;
  const activeReports = p.active_reports ?? 0;
  const totalVotes = expiredReports + activeReports;
  return totalVotes >= 3 && expiredReports / totalVotes > 0.5;
}

// ─── Promotion Detail Drawer ─────────────────────────────────────────────────

type PromotionDetailDrawerProps = {
  promo: Promotion | null;
  open: boolean;
  onClose: () => void;
  viewerUserId: string | null;
  viewerLoading: boolean;
  onLike: (id: string) => void;
  onStatusVote: (id: string, status: "active" | "expired") => void;
  onEdit: (promo: Promotion) => void;
  onInactivate: (id: string) => void;
  onDelete: (id: string) => void;
};

function PromotionDetailDrawer({
  promo,
  open,
  onClose,
  viewerUserId,
  viewerLoading,
  onLike,
  onStatusVote,
  onEdit,
  onInactivate,
  onDelete,
}: PromotionDetailDrawerProps) {
  const { t, language } = useLanguage();
  const [couponCopied, setCouponCopied] = React.useState(false);

  if (!promo) return null;

  const isOwner = !viewerLoading && viewerUserId === promo.user_id;
  const isLoggedIn = !viewerLoading && !!viewerUserId;

  const expiredReports = promo.expired_reports ?? 0;
  const activeReports = promo.active_reports ?? 0;
  const totalVotes = expiredReports + activeReports;
  const majorityExpired = totalVotes >= 3 && expiredReports / totalVotes > 0.5;

  const discountDisplay = (() => {
    if (promo.discount_percent) return `${promo.discount_percent}% OFF`;
    if (promo.original_price && promo.promo_price) {
      const pct = Math.round(
        ((promo.original_price - promo.promo_price) / promo.original_price) * 100,
      );
      if (pct > 0) return `${pct}% OFF`;
    }
    return null;
  })();

  return (
    <Drawer open={open} onOpenChange={(v) => { if (!v) onClose(); }} noBodyStyles shouldScaleBackground={false}>
      <DrawerContent
        {...GLASS_SHEET_PROPS}
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={GLASS_SHEET_STYLE}
      >
        <DrawerHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <DrawerTitle className="text-base font-semibold leading-snug text-white flex-1">
              {promo.title}
            </DrawerTitle>
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex-shrink-0 h-8 w-8 -mt-1 -mr-1 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label={t("store_more_options")}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[9999]">
                  <DropdownMenuItem onClick={() => { onClose(); onEdit(promo); }}>
                    <Pencil className="h-4 w-4 mr-2" />
                    {t("edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { onClose(); onInactivate(promo.id); }}>
                    <Ban className="h-4 w-4 mr-2" />
                    {t("store_deactivate")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => { onClose(); onDelete(promo.id); }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t("remove")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </DrawerHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-4">
          {/* Imagem ampliada */}
          {promo.photo_url && (
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,.04)" }}>
              <ImageWithFallback
                src={promo.photo_url}
                alt={promo.title}
                className={`w-full h-full object-contain ${majorityExpired ? "opacity-60" : ""}`}
                fallback="/placeholder.svg"
              />
              {discountDisplay && (
                <span className="absolute top-3 left-3 bg-brand text-white text-sm font-bold px-3 py-1 rounded-full">
                  {discountDisplay}
                </span>
              )}
              {majorityExpired && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-destructive text-sm font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-destructive/30" style={{ background: "rgba(14,13,20,.8)" }}>
                    <AlertTriangle className="h-4 w-4" />
                    {t("store_maybe_expired")}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Categoria */}
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${CATEGORY_COLORS[promo.category] ?? CATEGORY_COLORS.outro}`}
          >
            {CATEGORY_ICONS[promo.category] ?? CATEGORY_ICONS.outro}
            {categoryLabel(promo.category, t)}
          </span>

          {/* Preço */}
          {(promo.promo_price != null || promo.original_price != null) && (
            <div className="flex items-baseline gap-2">
              {promo.promo_price != null && (
                <span className="text-2xl font-bold text-brand">
                  R$ {promo.promo_price.toFixed(2).replace(".", ",")}
                </span>
              )}
              {promo.original_price != null && promo.promo_price != null && (
                <span className="text-sm line-through" style={{ color: "rgba(255,255,255,.4)" }}>
                  R$ {promo.original_price.toFixed(2).replace(".", ",")}
                </span>
              )}
              {promo.original_price != null && promo.promo_price == null && (
                <span className="text-2xl font-bold text-white">
                  R$ {promo.original_price.toFixed(2).replace(".", ",")}
                </span>
              )}
            </div>
          )}

          {/* Descrição completa */}
          {promo.description && (
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,.7)" }}>{promo.description}</p>
          )}

          {/* Validade */}
          {promo.expires_at && (
            <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
              {t("store_valid_until").replace("{date}", formatDate(promo.expires_at, language))}
            </p>
          )}

          {/* Cupom */}
          {promo.coupon_code && (
            <button
              onClick={() => {
                copyToClipboard(promo.coupon_code!);
                toast({ title: t("store_coupon_copied"), description: promo.coupon_code });
                setCouponCopied(true);
                setTimeout(() => setCouponCopied(false), 2000);
              }}
              className="flex items-center gap-2 w-full rounded-2xl border border-dashed border-brand/50 px-4 py-3 transition-colors"
              style={{ background: "rgba(91,140,255,.08)" }}
            >
              <Ticket className="h-4 w-4 text-brand flex-shrink-0" />
              <span className="font-mono text-sm font-bold text-brand tracking-wider flex-1 text-left">
                {promo.coupon_code}
              </span>
              {couponCopied ? (
                <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
              ) : (
                <Copy className="h-4 w-4 text-brand/60 flex-shrink-0" />
              )}
            </button>
          )}

          {/* Votos de status */}
          {!isOwner && isLoggedIn && (
            <div className="flex items-center gap-2 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,.1)" }}>
              <span className="text-xs flex-shrink-0" style={{ color: "rgba(255,255,255,.5)" }}>{t("store_still_active")}</span>
              <button
                onClick={() => onStatusVote(promo.id, "active")}
                aria-label={t("store_mark_active")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  promo.user_status_vote === "active"
                    ? "bg-green-500/20 text-green-500"
                    : "text-white/50 hover:text-green-500 hover:bg-green-500/10"
                }`}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
                {t("store_yes")} {(promo.active_reports ?? 0) > 0 && `(${promo.active_reports})`}
              </button>
              <button
                onClick={() => onStatusVote(promo.id, "expired")}
                aria-label={t("store_mark_expired")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  promo.user_status_vote === "expired"
                    ? "bg-destructive/20 text-destructive"
                    : "text-white/50 hover:text-destructive hover:bg-destructive/10"
                }`}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
                {t("store_expired_vote")} {(promo.expired_reports ?? 0) > 0 && `(${promo.expired_reports})`}
              </button>
            </div>
          )}

          {/* Botão principal */}
          {isSafeExternalUrl(promo.external_link) && (
            <Button
              className="w-full gap-2 h-12 text-base border-0"
              style={GLASS_PRIMARY_BTN_STYLE}
              onClick={() => openExternalUrl(promo.external_link, Browser.open)}
            >
              <ExternalLink className="h-5 w-5" />
              {t("store_go_to_promo")}
            </Button>
          )}

          {/* Like */}
          <button
            onClick={() => onLike(promo.id)}
            className={`flex items-center gap-2 w-full justify-center py-2 rounded-lg text-sm transition-colors ${
              promo.user_liked
                ? "text-red-500"
                : "text-white/50 hover:text-red-500"
            }`}
          >
            <Heart className={`h-4 w-4 ${promo.user_liked ? "fill-red-500" : ""}`} />
            {promo.user_liked ? t("store_liked") : t("store_like")}
            {(promo.likes_count ?? 0) > 0 && (
              <span className="text-xs">· {promo.likes_count}</span>
            )}
          </button>

          {/* Comentários — embutidos aqui para debater sem sair do drawer */}
          <div className="pt-3 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,.1)" }}>
            <div className="flex items-center gap-1.5 text-sm font-medium text-white/85">
              <MessageCircle className="h-4 w-4 text-brand" />
              {t("comments_title")}
              {(promo.comments_count ?? 0) > 0 && (
                <span className="text-xs font-normal text-white/40">({promo.comments_count})</span>
              )}
            </div>
            <PromotionCommentsSection promotionId={promo.id} />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// ─── Promotion Card ──────────────────────────────────────────────────────────

type PromotionCardProps = {
  promo: Promotion;
  viewerUserId: string | null;
  viewerLoading: boolean;
  onLike: (id: string) => void;
  onStatusVote: (id: string, status: "active" | "expired") => void;
  onEdit: (promo: Promotion) => void;
  onInactivate: (id: string) => void;
  onDelete: (id: string) => void;
  onUserClick: (userId: string) => void;
  onOpenDetail: (promo: Promotion) => void;
};

function PromotionCard({
  promo,
  viewerUserId,
  viewerLoading,
  onLike,
  onStatusVote,
  onEdit,
  onInactivate,
  onDelete,
  onUserClick,
  onOpenDetail,
}: PromotionCardProps) {
  const { t } = useLanguage();
  const isOwner = !viewerLoading && viewerUserId === promo.user_id;

  const expiredReports = promo.expired_reports ?? 0;
  const activeReports = promo.active_reports ?? 0;
  const totalVotes = expiredReports + activeReports;
  const majorityExpired = totalVotes >= 3 && expiredReports / totalVotes > 0.5;
  const dateExpired = promo.expires_at
    ? promo.expires_at.slice(0, 10) < new Date().toISOString().split("T")[0]
    : false;
  const isExpired = dateExpired || majorityExpired;

  const discountDisplay = (() => {
    if (promo.discount_percent) return `${promo.discount_percent}% OFF`;
    if (promo.original_price && promo.promo_price) {
      const pct = Math.round(
        ((promo.original_price - promo.promo_price) / promo.original_price) * 100,
      );
      if (pct > 0) return `${pct}% OFF`;
    }
    return null;
  })();

  return (
    <div className="rounded-xl overflow-hidden flex flex-col h-full" style={GLASS_CARD_STYLE}>
      {/* Área clicável: imagem + conteúdo principal */}
      <button
        className="flex flex-col flex-1 text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
        onClick={() => onOpenDetail(promo)}
        aria-label={t("store_view_details").replace("{title}", promo.title)}
      >
        {/* Image */}
        <div className="relative w-full aspect-[4/3] bg-muted overflow-hidden flex-shrink-0">
          {promo.photo_url ? (
            <ImageWithFallback
              src={promo.photo_url}
              alt={promo.title}
              className={`w-full h-full object-contain transition-opacity ${isExpired ? "opacity-50" : ""}`}
              fallback="/placeholder.svg"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {CATEGORY_ICONS[promo.category] ?? CATEGORY_ICONS.outro}
            </div>
          )}
          {discountDisplay && (
            <span className="absolute top-2 left-2 bg-brand text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {discountDisplay}
            </span>
          )}
          {isExpired && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="bg-background/80 text-destructive text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border border-destructive/30">
                <AlertTriangle className="h-3 w-3" />
                {dateExpired ? t("store_expired_badge") : t("store_expired_badge_maybe")}
              </span>
            </div>
          )}
        </div>

        <div className="p-3 flex flex-col flex-1 gap-1.5">
          {/* Categoria badge */}
          <span
            className={`self-start inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[promo.category] ?? CATEGORY_COLORS.outro}`}
          >
            {CATEGORY_ICONS[promo.category] ?? CATEGORY_ICONS.outro}
            {categoryLabel(promo.category, t)}
          </span>

          {/* Título */}
          <p className="font-semibold text-sm leading-tight line-clamp-2">{promo.title}</p>

          {/* Descrição — área de altura fixa, sempre ocupa o mesmo espaço */}
          <div className="flex-1 min-h-[2.5rem]">
            {promo.description ? (
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {promo.description}
              </p>
            ) : null}
          </div>

          {/* Preço */}
          {(promo.promo_price != null || promo.original_price != null) && (
            <div className="flex items-baseline gap-1.5 flex-wrap">
              {promo.promo_price != null && (
                <span className="text-sm font-bold text-brand">
                  R$ {promo.promo_price.toFixed(2).replace(".", ",")}
                </span>
              )}
              {promo.original_price != null && promo.promo_price != null && (
                <span className="text-[10px] text-muted-foreground line-through">
                  R$ {promo.original_price.toFixed(2).replace(".", ",")}
                </span>
              )}
              {promo.original_price != null && promo.promo_price == null && (
                <span className="text-sm font-semibold">
                  R$ {promo.original_price.toFixed(2).replace(".", ",")}
                </span>
              )}
            </div>
          )}
        </div>
      </button>

      {/* Footer — fora do botão, ações independentes */}
      <div className="px-3 pb-3 flex items-center justify-between pt-2" style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
        <div className="flex items-center gap-1 min-w-0">
          <button
            onClick={() => onUserClick(promo.user_id)}
            className="flex items-center gap-1.5 min-w-0"
          >
            <UserAvatar
              photo={promo.user_photo}
              nickname={promo.user_nickname}
              className="h-5 w-5 flex-shrink-0"
            />
            <span className="text-xs text-muted-foreground truncate max-w-[60px]">
              {promo.user_nickname}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(promo)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  {t("edit")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onInactivate(promo.id)}>
                  <Ban className="h-4 w-4 mr-2" />
                  {t("store_deactivate")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDelete(promo.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("remove")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <PromotionCommentsDrawer
            promotionId={promo.id}
            commentsCount={promo.comments_count ?? 0}
          />
          <button
            onClick={() => onLike(promo.id)}
            className="flex items-center gap-1 px-1.5 py-1 text-xs text-muted-foreground hover:text-red-500 transition-colors"
          >
            <Heart
              className={`h-3.5 w-3.5 transition-colors ${promo.user_liked ? "fill-red-500 text-red-500" : ""}`}
            />
            {(promo.likes_count ?? 0) > 0 && (
              <span>{promo.likes_count}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── New Promotion Drawer ────────────────────────────────────────────────────

type LinkPreviewResult = {
  title: string | null;
  description: string | null;
  image: string | null;
  price: number | null;
};

async function fetchLinkPreview(url: string): Promise<LinkPreviewResult> {
  const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `Erro ${res.status}`);
  }
  return res.json();
}

type NewPromoFormProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

function NewPromoDrawer({ open, onClose, onCreated }: NewPromoFormProps) {
  const { t } = useLanguage();
  const [linkInput, setLinkInput] = React.useState("");
  const [fetching, setFetching] = React.useState(false);
  const [prefilled, setPrefilled] = React.useState(false);

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState<PromotionCategory>("equipamento");
  const [originalPrice, setOriginalPrice] = React.useState("");
  const [promoPrice, setPromoPrice] = React.useState("");
  const [photoUrl, setPhotoUrl] = React.useState("");
  const [imageMode, setImageMode] = React.useState<"url" | "upload">("url");
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [externalLink, setExternalLink] = React.useState("");
  const [couponCode, setCouponCode] = React.useState("");
  const [expiresAt, setExpiresAt] = React.useState("");
  const [expiresAtKey, setExpiresAtKey] = React.useState(0);
  const [saving, setSaving] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [pendingStoreCropSrc, setPendingStoreCropSrc] = React.useState<string | null>(null);
  const pendingStoreFileRef = React.useRef<File | null>(null);

  function reset() {
    setLinkInput("");
    setFetching(false);
    setPrefilled(false);
    setTitle("");
    setDescription("");
    setCategory("equipamento");
    setOriginalPrice("");
    setPromoPrice("");
    setPhotoUrl("");
    setImageMode("url");
    setUploadFile(null);
    setUploading(false);
    setExternalLink("");
    setCouponCode("");
    setExpiresAt("");
    setExpiresAtKey((k) => k + 1);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: t("store_invalid_image"), variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: t("store_image_too_large"), variant: "destructive" });
      return;
    }
    pendingStoreFileRef.current = file;
    const reader = new FileReader();
    reader.onload = (ev) => setPendingStoreCropSrc(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function uploadImageToStorage(): Promise<string | null> {
    if (!uploadFile || !supabase) return photoUrl || null;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t("store_not_authenticated"));
      const ext = uploadFile.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("promotions")
        .upload(path, uploadFile, { contentType: uploadFile.type, upsert: false });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("promotions").getPublicUrl(path);
      return urlData.publicUrl;
    } finally {
      setUploading(false);
    }
  }

  async function handleFetchPreview() {
    const url = linkInput.trim();
    if (!url) return;

    // Basic URL validation
    try { new URL(url); } catch {
      toast({ title: t("store_invalid_url"), variant: "destructive" });
      return;
    }

    setFetching(true);
    try {
      const data = await fetchLinkPreview(url);
      const anyFilled = data.title || data.description || data.image || data.price;

      if (data.title) setTitle(data.title.slice(0, 120));
      if (data.description) setDescription(data.description.slice(0, 500));
      if (data.image) setPhotoUrl(data.image);
      if (data.price) setPromoPrice(formatPriceInput(data.price));
      setExternalLink(url);
      setPrefilled(true);

      if (anyFilled) {
        toast({ title: t("store_import_success"), description: t("store_import_success_desc") });
      } else {
        toast({
          title: t("store_import_partial"),
          description: t("store_import_partial_desc"),
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: t("store_import_unavailable"),
        description: t("store_import_unavailable_desc"),
      });
      setExternalLink(url);
      setTitle("");
      setDescription("");
      setPrefilled(true);
    } finally {
      setFetching(false);
    }
  }

  async function handleSubmit() {
    if (!title.trim()) {
      toast({ title: t("store_title_required"), variant: "destructive" });
      return;
    }
    if (originalPrice && parsePriceInput(originalPrice) < 0) {
      toast({ title: t("store_price_negative_original"), variant: "destructive" });
      return;
    }
    if (promoPrice && parsePriceInput(promoPrice) < 0) {
      toast({ title: t("store_price_negative_promo"), variant: "destructive" });
      return;
    }
    if (promoPrice && originalPrice && parsePriceInput(promoPrice) > parsePriceInput(originalPrice)) {
      toast({ title: t("store_price_promo_gt_original"), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const finalPhotoUrl = imageMode === "upload" && uploadFile
        ? await uploadImageToStorage()
        : (photoUrl || null);

      await createPromotionDb({
        title,
        description: description || undefined,
        category,
        original_price: originalPrice ? parsePriceInput(originalPrice) : undefined,
        promo_price: promoPrice ? parsePriceInput(promoPrice) : undefined,
        photo_url: finalPhotoUrl ?? undefined,
        external_link: externalLink || undefined,
        coupon_code: couponCode || undefined,
        expires_at: expiresAt || undefined,
      });
      toast({ title: t("store_published") });
      reset();
      onCreated();
      onClose();
    } catch (err: any) {
      toast({
        title: t("store_publish_error"),
        description: err?.message ?? t("retry"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <Drawer open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }} noBodyStyles shouldScaleBackground={false}>
      <DrawerContent
        {...GLASS_SHEET_PROPS}
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={GLASS_SHEET_STYLE}
      >
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2 text-white">
            <Tag className="h-5 w-5 text-brand" />
            {t("store_new_promo_title")}
          </DrawerTitle>
        </DrawerHeader>

        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 space-y-4"
          style={{ paddingBottom: "calc(0.5rem + var(--keyboard-height, 0px))" }}
        >
          {/* ── Step 1: Link ── */}
          <div
            className="space-y-3 rounded-2xl p-3 transition-colors"
            style={prefilled
              ? { background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)" }
              : { background: "rgba(91,140,255,.1)", border: "1px solid rgba(91,140,255,.4)" }}
          >
            <div className="flex items-center gap-2">
              <span className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white ${prefilled ? "bg-green-500" : "bg-brand"}`}>
                {prefilled ? "✓" : "1"}
              </span>
              <span className="text-sm font-medium text-white/90">{t("store_step1_title")}</span>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder={t("store_link_placeholder")}
                value={linkInput}
                onChange={(e) => { setLinkInput(e.target.value); if (prefilled) setPrefilled(false); }}
                onKeyDown={(e) => e.key === "Enter" && !fetching && handleFetchPreview()}
                className={`flex-1 ${GLASS_FIELD_CLASS}`}
                style={GLASS_FIELD_STYLE}
              />
              <Button
                type="button"
                onClick={handleFetchPreview}
                disabled={fetching || !linkInput.trim()}
                className="flex-shrink-0 gap-1.5 border-0"
                style={GLASS_PRIMARY_BTN_STYLE}
              >
                {fetching ? (
                  <LoadingSpinner className="h-4 w-4" />
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    {t("store_fetch")}
                  </>
                )}
              </Button>
            </div>
            {!prefilled && (
              <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                {t("store_link_hint")}
              </p>
            )}
            {prefilled && (
              <p className="text-xs text-green-400">
                {t("store_link_imported")}
              </p>
            )}
          </div>

          {/* ── Step 2: Details (shown only after fetch) ── */}
          {prefilled && (
            <>
              <div className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-brand text-white">2</span>
                <span className="text-sm font-medium text-white/90">{t("store_step2_title")}</span>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label className={GLASS_LABEL_CLASS}>{t("store_field_title")}</label>
                <Input
                  placeholder={t("store_title_placeholder")}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  className={GLASS_FIELD_CLASS}
                  style={GLASS_FIELD_STYLE}
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className={GLASS_LABEL_CLASS}>{t("store_field_description")}</label>
                <Textarea
                  placeholder={t("store_desc_placeholder")}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className={GLASS_FIELD_CLASS}
                  style={GLASS_FIELD_STYLE}
                />
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className={GLASS_LABEL_CLASS}>{t("store_field_category")}</label>
                <Select value={category} onValueChange={(v) => setCategory(v as PromotionCategory)}>
                  <SelectTrigger className={GLASS_FIELD_CLASS} style={GLASS_FIELD_STYLE}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    {PROMOTION_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {categoryLabel(c.value, t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Prices */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 min-w-0">
                  <label className={GLASS_LABEL_CLASS}>{t("store_field_original_price")}</label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="99,90"
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(sanitizePriceInput(e.target.value))}
                    className={`w-full min-w-0 ${GLASS_FIELD_CLASS}`}
                    style={GLASS_FIELD_STYLE}
                  />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <label className={GLASS_LABEL_CLASS}>{t("store_field_promo_price")}</label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="74,90"
                    value={promoPrice}
                    onChange={(e) => setPromoPrice(sanitizePriceInput(e.target.value))}
                    className={`w-full min-w-0 ${GLASS_FIELD_CLASS}`}
                    style={GLASS_FIELD_STYLE}
                  />
                </div>
              </div>

              {/* Photo — URL or upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={GLASS_LABEL_CLASS}>{t("store_field_image")}</label>
                  <div className="flex rounded-lg overflow-hidden text-xs" style={{ border: "1px solid rgba(255,255,255,.12)" }}>
                    <button
                      type="button"
                      onClick={() => setImageMode("url")}
                      className={`flex items-center gap-1 px-2.5 py-1 transition-colors ${imageMode === "url" ? "bg-brand text-white" : "text-white/50 hover:text-white"}`}
                    >
                      <Link className="h-3 w-3" /> URL
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageMode("upload")}
                      className={`flex items-center gap-1 px-2.5 py-1 transition-colors ${imageMode === "upload" ? "bg-brand text-white" : "text-white/50 hover:text-white"}`}
                    >
                      <ImageIcon className="h-3 w-3" /> {t("store_image_gallery")}
                    </button>
                  </div>
                </div>

                {imageMode === "url" ? (
                  <Input
                    placeholder="https://..."
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    className={GLASS_FIELD_CLASS}
                    style={GLASS_FIELD_STYLE}
                  />
                ) : (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full rounded-lg border-2 border-dashed transition-colors p-4 flex flex-col items-center gap-2"
                      style={{ borderColor: "rgba(255,255,255,.18)" }}
                    >
                      {uploadFile ? (
                        <span className="text-xs text-green-400 font-medium">{uploadFile.name}</span>
                      ) : (
                        <>
                          <Upload className="h-5 w-5 text-white/50" />
                          <span className="text-xs text-white/50">{t("store_pick_from_gallery")}</span>
                        </>
                      )}
                    </button>
                  </>
                )}

                {/* Preview */}
                {photoUrl && (
                  <div className="rounded-lg overflow-hidden aspect-video" style={{ background: "rgba(255,255,255,.04)" }}>
                    <ImageWithFallback
                      src={photoUrl}
                      alt="preview"
                      className="w-full h-full object-cover"
                      fallback="/placeholder.svg"
                    />
                  </div>
                )}
              </div>

              {/* Coupon code */}
              <div className="space-y-1.5">
                <label className={`${GLASS_LABEL_CLASS} flex items-center gap-1.5`}>
                  <Ticket className="h-3.5 w-3.5 text-brand" />
                  {t("store_field_coupon")}
                  <span className="text-xs font-normal" style={{ color: "rgba(255,255,255,.5)" }}>{t("store_optional")}</span>
                </label>
                <Input
                  placeholder={t("store_coupon_placeholder")}
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  maxLength={30}
                  className={`font-mono tracking-wider ${GLASS_FIELD_CLASS}`}
                  style={GLASS_FIELD_STYLE}
                />
              </div>

              {/* Expires at */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className={GLASS_LABEL_CLASS}>{t("store_field_expires")}</label>
                  {expiresAt && (
                    <button
                      type="button"
                      onClick={() => { setExpiresAt(""); setExpiresAtKey((k) => k + 1); }}
                      className="flex items-center gap-1 text-xs text-white/50 hover:text-white transition-colors"
                    >
                      <X className="h-3 w-3" />
                      {t("store_clear")}
                    </button>
                  )}
                </div>
                <Input
                  key={expiresAtKey}
                  type="date"
                  value={expiresAt}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => {
                    const v = e.target.value;
                    setExpiresAt(v);
                    // WebKit/iOS: o botão nativo de limpar do <input type="date">
                    // nem sempre dispara o evento de mudança — o "Limpar" acima
                    // é o caminho confiável. Mesmo assim, forçar remontagem
                    // (via key) contorna o bug de renderização do WKWebView
                    // nos casos em que o evento nativo dispara.
                    if (!v) setExpiresAtKey((k) => k + 1);
                  }}
                  className={`[&::-webkit-clear-button]:hidden ${GLASS_FIELD_CLASS}`}
                  style={GLASS_FIELD_STYLE}
                />
              </div>
            </>
          )}
        </div>

        <DrawerFooter className="pt-2">
          {prefilled && (
            <Button onClick={handleSubmit} disabled={saving || uploading} className="w-full border-0" style={GLASS_PRIMARY_BTN_STYLE}>
              {uploading ? (
                <><LoadingSpinner className="h-4 w-4" /><span className="ml-2">{t("store_uploading_image")}</span></>
              ) : saving ? (
                <><LoadingSpinner className="h-4 w-4" /><span className="ml-2">{t("store_publishing")}</span></>
              ) : t("store_publish_promo")}
            </Button>
          )}
          <Button variant="ghost" onClick={() => { reset(); onClose(); }} disabled={saving} className="text-white/70 hover:text-white hover:bg-white/10">
            {t("cancel")}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>

    <ImageCropperDrawer
      imageSrc={pendingStoreCropSrc}
      aspectRatio={1}
      onConfirm={(dataUrl, blob) => {
        const file = pendingStoreFileRef.current;
        if (!file) return;
        const croppedFile = new File([blob], file.name, { type: "image/jpeg" });
        setUploadFile(croppedFile);
        setPhotoUrl(dataUrl);
        setPendingStoreCropSrc(null);
      }}
      onCancel={() => setPendingStoreCropSrc(null)}
    />
    </>
  );
}

// ─── Edit Promotion Drawer ───────────────────────────────────────────────────

type EditPromoDrawerProps = {
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  promo: Promotion | null;
};

function EditPromoDrawer({ open, onClose, onUpdated, promo }: EditPromoDrawerProps) {
  const { t } = useLanguage();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [couponCode, setCouponCode] = React.useState("");
  const [originalPrice, setOriginalPrice] = React.useState("");
  const [promoPrice, setPromoPrice] = React.useState("");
  const [expiresAt, setExpiresAt] = React.useState("");
  const [expiresAtKey, setExpiresAtKey] = React.useState(0);
  const [category, setCategory] = React.useState<PromotionCategory>("equipamento");
  const [photoUrl, setPhotoUrl] = React.useState("");
  const [imageMode, setImageMode] = React.useState<"url" | "upload">("url");
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [pendingCropSrc, setPendingCropSrc] = React.useState<string | null>(null);
  const pendingFileRef = React.useRef<File | null>(null);
  const todayStr = new Date().toISOString().split("T")[0];

  React.useEffect(() => {
    if (promo) {
      setTitle(promo.title || "");
      setDescription(promo.description || "");
      setCouponCode(promo.coupon_code || "");
      setOriginalPrice(formatPriceInput(promo.original_price));
      setPromoPrice(formatPriceInput(promo.promo_price));
      setExpiresAt(promo.expires_at ? promo.expires_at.slice(0, 10) : "");
      setExpiresAtKey((k) => k + 1);
      setCategory((promo.category as PromotionCategory) || "equipamento");
      setPhotoUrl(promo.photo_url || "");
      setImageMode("url");
      setUploadFile(null);
    }
  }, [promo, open]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: t("store_invalid_image"), variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: t("store_image_too_large"), variant: "destructive" });
      return;
    }
    pendingFileRef.current = file;
    const reader = new FileReader();
    reader.onload = (ev) => setPendingCropSrc(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function uploadImageToStorage(): Promise<string | null> {
    if (!uploadFile || !supabase) return photoUrl || null;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t("store_not_authenticated"));
      const ext = uploadFile.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("promotions")
        .upload(path, uploadFile, { contentType: uploadFile.type, upsert: false });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("promotions").getPublicUrl(path);
      return urlData.publicUrl;
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!promo) return;
    if (!title.trim()) {
      toast({ title: t("store_title_empty"), variant: "destructive" });
      return;
    }
    if (originalPrice && parsePriceInput(originalPrice) < 0) {
      toast({ title: t("store_price_negative_original"), variant: "destructive" });
      return;
    }
    if (promoPrice && parsePriceInput(promoPrice) < 0) {
      toast({ title: t("store_price_negative_promo"), variant: "destructive" });
      return;
    }
    if (promoPrice && originalPrice && parsePriceInput(promoPrice) > parsePriceInput(originalPrice)) {
      toast({ title: t("store_price_promo_gt_original"), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const finalPhotoUrl = imageMode === "upload" && uploadFile
        ? await uploadImageToStorage()
        : (photoUrl || null);

      await updatePromotionDb(promo.id, {
        title: title.trim(),
        description: description || undefined,
        coupon_code: couponCode || undefined,
        original_price: originalPrice ? parsePriceInput(originalPrice) : null,
        promo_price: promoPrice ? parsePriceInput(promoPrice) : null,
        expires_at: expiresAt || null,
        category,
        photo_url: finalPhotoUrl,
      });
      toast({ title: t("store_updated") });
      onUpdated();
      onClose();
    } catch (err: any) {
      toast({
        title: t("store_update_error"),
        description: err?.message ?? t("retry"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <Drawer open={open} onOpenChange={(v) => { if (!v) onClose(); }} noBodyStyles shouldScaleBackground={false}>
      <DrawerContent
        {...GLASS_SHEET_PROPS}
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={GLASS_SHEET_STYLE}
      >
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2 text-white">
            <Pencil className="h-5 w-5 text-brand" />
            {t("store_edit_promo_title")}
          </DrawerTitle>
        </DrawerHeader>

        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 space-y-4"
          style={{ paddingBottom: "calc(1.5rem + var(--keyboard-height, 0px))" }}
        >
          {/* Title */}
          <div className="space-y-1.5">
            <label className={GLASS_LABEL_CLASS}>{t("store_field_title")}</label>
            <Input
              placeholder={t("store_title_placeholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              className={GLASS_FIELD_CLASS}
              style={GLASS_FIELD_STYLE}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className={GLASS_LABEL_CLASS}>{t("store_field_description")}</label>
            <Textarea
              placeholder={t("store_desc_placeholder_short")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              className={GLASS_FIELD_CLASS}
              style={GLASS_FIELD_STYLE}
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className={GLASS_LABEL_CLASS}>{t("store_field_category")}</label>
            <Select value={category} onValueChange={(v) => setCategory(v as PromotionCategory)}>
              <SelectTrigger className={GLASS_FIELD_CLASS} style={GLASS_FIELD_STYLE}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[9999]">
                {PROMOTION_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {categoryLabel(c.value, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 min-w-0">
              <label className={GLASS_LABEL_CLASS}>{t("store_field_original_price")}</label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="99,90"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(sanitizePriceInput(e.target.value))}
                className={`w-full min-w-0 ${GLASS_FIELD_CLASS}`}
                style={GLASS_FIELD_STYLE}
              />
            </div>
            <div className="space-y-1.5 min-w-0">
              <label className={GLASS_LABEL_CLASS}>{t("store_field_promo_price")}</label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="74,90"
                value={promoPrice}
                onChange={(e) => setPromoPrice(sanitizePriceInput(e.target.value))}
                className={`w-full min-w-0 ${GLASS_FIELD_CLASS}`}
                style={GLASS_FIELD_STYLE}
              />
            </div>
          </div>

          {/* Photo — URL or upload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className={GLASS_LABEL_CLASS}>{t("store_field_image")}</label>
              <div className="flex rounded-lg overflow-hidden text-xs" style={{ border: "1px solid rgba(255,255,255,.12)" }}>
                <button
                  type="button"
                  onClick={() => setImageMode("url")}
                  className={`flex items-center gap-1 px-2.5 py-1 transition-colors ${imageMode === "url" ? "bg-brand text-white" : "text-white/50 hover:text-white"}`}
                >
                  <Link className="h-3 w-3" /> URL
                </button>
                <button
                  type="button"
                  onClick={() => setImageMode("upload")}
                  className={`flex items-center gap-1 px-2.5 py-1 transition-colors ${imageMode === "upload" ? "bg-brand text-white" : "text-white/50 hover:text-white"}`}
                >
                  <ImageIcon className="h-3 w-3" /> {t("store_image_gallery")}
                </button>
              </div>
            </div>

            {imageMode === "url" ? (
              <Input
                placeholder="https://..."
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                className={GLASS_FIELD_CLASS}
                style={GLASS_FIELD_STYLE}
              />
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-lg border-2 border-dashed transition-colors p-4 flex flex-col items-center gap-2"
                  style={{ borderColor: "rgba(255,255,255,.18)" }}
                >
                  {uploadFile ? (
                    <span className="text-xs text-green-400 font-medium">{uploadFile.name}</span>
                  ) : (
                    <>
                      <Upload className="h-5 w-5 text-white/50" />
                      <span className="text-xs text-white/50">{t("store_pick_from_gallery")}</span>
                    </>
                  )}
                </button>
              </>
            )}

            {photoUrl && imageMode === "url" && (
              <div className="rounded-lg overflow-hidden aspect-video" style={{ background: "rgba(255,255,255,.04)" }}>
                <ImageWithFallback
                  src={photoUrl}
                  alt="preview"
                  className="w-full h-full object-cover"
                  fallback="/placeholder.svg"
                />
              </div>
            )}
          </div>

          {/* Coupon */}
          <div className="space-y-1.5">
            <label className={`${GLASS_LABEL_CLASS} flex items-center gap-1.5`}>
              <Ticket className="h-3.5 w-3.5 text-brand" />
              {t("store_field_coupon")}
              <span className="text-xs font-normal" style={{ color: "rgba(255,255,255,.5)" }}>{t("store_optional")}</span>
            </label>
            <Input
              placeholder={t("store_coupon_placeholder")}
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              maxLength={30}
              className={`font-mono tracking-wider ${GLASS_FIELD_CLASS}`}
              style={GLASS_FIELD_STYLE}
            />
          </div>

          {/* Expires at */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className={GLASS_LABEL_CLASS}>{t("store_field_expires")}</label>
              {expiresAt && (
                <button
                  type="button"
                  onClick={() => { setExpiresAt(""); setExpiresAtKey((k) => k + 1); }}
                  className="flex items-center gap-1 text-xs text-white/50 hover:text-white transition-colors"
                >
                  <X className="h-3 w-3" />
                  {t("store_clear")}
                </button>
              )}
            </div>
            <Input
              key={expiresAtKey}
              type="date"
              value={expiresAt}
              min={todayStr}
              onChange={(e) => {
                const v = e.target.value;
                setExpiresAt(v);
                // WebKit/iOS: o botão nativo de limpar do <input type="date">
                // nem sempre dispara o evento de mudança — o "Limpar" acima
                // é o caminho confiável. Mesmo assim, forçar remontagem
                // (via key) contorna o bug de renderização do WKWebView
                // nos casos em que o evento nativo dispara.
                if (!v) setExpiresAtKey((k) => k + 1);
              }}
              className={`[&::-webkit-clear-button]:hidden ${GLASS_FIELD_CLASS}`}
              style={GLASS_FIELD_STYLE}
            />
          </div>
        </div>

        <DrawerFooter className="pt-2">
          <Button onClick={handleSubmit} disabled={saving || uploading} className="w-full border-0" style={GLASS_PRIMARY_BTN_STYLE}>
            {uploading ? (
              <><LoadingSpinner className="h-4 w-4" /><span className="ml-2">{t("store_uploading_image")}</span></>
            ) : saving ? (
              <><LoadingSpinner className="h-4 w-4" /><span className="ml-2">{t("saving")}</span></>
            ) : t("store_save_changes")}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={saving || uploading} className="text-white/70 hover:text-white hover:bg-white/10">
            {t("cancel")}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>

    <ImageCropperDrawer
      imageSrc={pendingCropSrc}
      aspectRatio={1}
      onConfirm={(dataUrl, blob) => {
        const file = pendingFileRef.current;
        if (!file) return;
        const croppedFile = new File([blob], file.name, { type: "image/jpeg" });
        setUploadFile(croppedFile);
        setPhotoUrl(dataUrl);
        setPendingCropSrc(null);
      }}
      onCancel={() => setPendingCropSrc(null)}
    />
    </>
  );
}

// ─── Segment labels ──────────────────────────────────────────────────────────

/** Mesmos valores gravados em `commercial_profiles.business_segment` pelo
 * cadastro (Login) e pelo settings-drawer — reusa as chaves `seg_*` do i18n. */
const SEGMENT_LABEL_KEYS: Record<string, TranslationKey> = {
  academia: "seg_academia",
  personal_trainer: "seg_personal_trainer",
  nutricionista: "seg_nutricionista",
  psicologo: "seg_psicologo",
  fisioterapeuta: "seg_fisioterapeuta",
  coach: "seg_coach",
  outros: "seg_outros",
};

const SEGMENT_COLORS: Record<string, string> = {
  academia: "bg-orange-500/15 text-orange-400",
  personal_trainer: "bg-brand/15 text-brand",
  nutricionista: "bg-green-500/15 text-green-400",
  psicologo: "bg-red-500/15 text-red-400",
  fisioterapeuta: "bg-blue-500/15 text-blue-400",
  coach: "bg-purple-500/15 text-purple-400",
  outros: "bg-muted text-muted-foreground",
};

function segmentLabel(seg: string, t: Translate) {
  const key = SEGMENT_LABEL_KEYS[seg];
  return key ? t(key) : seg;
}

// ─── Professional Card ───────────────────────────────────────────────────────

type ProfessionalCardProps = {
  professional: ProfessionalProfile;
  onViewProfile: (userId: string) => void;
  onMessage: (userId: string) => void;
  onViewPlans: (pro: ProfessionalProfile) => void;
  onEmailClick: (email: string) => void;
};

function ProfessionalCard({ professional: pro, onViewProfile, onMessage, onViewPlans, onEmailClick }: ProfessionalCardProps) {
  const { t } = useLanguage();
  const logoSrc = pro.business_logo_url || pro.photo;
  const [planIndex, setPlanIndex] = React.useState(0);
  const plans = pro.service_plans ?? [];
  return (
    <div className="rounded-xl overflow-hidden flex flex-col" style={GLASS_CARD_STYLE}>
      {/* Banner / Logo area */}
      <div
        className="h-20 flex items-center justify-center relative cursor-pointer"
        style={{ background: "linear-gradient(135deg,rgba(91,140,255,.22),rgba(157,107,255,.12))" }}
        onClick={() => onViewProfile(pro.user_id)}
      >
        {logoSrc ? (
          <ImageWithFallback
            src={logoSrc}
            alt={pro.business_name}
            className="h-full w-full object-cover opacity-30 absolute inset-0"
            fallback="/placeholder.svg"
          />
        ) : null}
        <UserAvatar
          photo={pro.photo}
          nickname={pro.nickname}
          className="relative z-10 h-14 w-14 border-2 border-border flex-shrink-0"
        />
      </div>

      <div className="p-3 flex flex-col flex-1 gap-2">
        {/* Segment badge */}
        <span
          className={`self-start inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${SEGMENT_COLORS[pro.business_segment] ?? SEGMENT_COLORS.outros}`}
        >
          <Briefcase className="h-3 w-3" />
          {segmentLabel(pro.business_segment, t)}
        </span>

        {/* Name */}
        <button
          className="text-left"
          onClick={() => onViewProfile(pro.user_id)}
        >
          <p className="font-semibold text-sm leading-tight">{pro.business_name || pro.nickname}</p>
          {pro.handle && (
            <p className="text-xs text-muted-foreground">@{pro.handle.replace(/^@/, "")}</p>
          )}
        </button>

        {/* Description */}
        {pro.business_description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{pro.business_description}</p>
        )}

        {/* Service plans — até 3 em linha, carrossel quando há mais */}
        {plans.length > 0 ? (
          <div className="flex-1 flex flex-col gap-1">
            {plans.length <= 3 ? (
              <div className="flex gap-1">
                {plans.map((plan, idx) => (
                  <button
                    key={idx}
                    onClick={() => onViewPlans(pro)}
                    className="flex-1 flex flex-col rounded-md bg-muted/30 px-2 py-1.5 gap-0.5 min-w-0 text-left hover:bg-muted/60 active:bg-muted/80 transition-colors"
                  >
                    <span className="text-[10px] font-medium truncate leading-tight">{plan.name}</span>
                    {plan.price != null && (
                      <span className="text-[10px] font-bold text-brand whitespace-nowrap">
                        R$ {plan.price.toFixed(2).replace(".", ",")}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="flex gap-1">
                  {plans.slice(planIndex * 3, planIndex * 3 + 3).map((plan, idx) => (
                    <button
                      key={idx}
                      onClick={() => onViewPlans(pro)}
                      className="flex-1 flex flex-col rounded-md bg-muted/30 px-2 py-1.5 gap-0.5 min-w-0 text-left hover:bg-muted/60 active:bg-muted/80 transition-colors"
                    >
                      <span className="text-[10px] font-medium truncate leading-tight">{plan.name}</span>
                      {plan.price != null && (
                        <span className="text-[10px] font-bold text-brand whitespace-nowrap">
                          R$ {plan.price.toFixed(2).replace(".", ",")}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-1">
                  <button
                    onClick={() => setPlanIndex((i) => (i - 1 + Math.ceil(plans.length / 3)) % Math.ceil(plans.length / 3))}
                    className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={t("store_prev_plans")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                  </button>
                  <span className="text-[10px] text-muted-foreground">
                    {planIndex + 1} / {Math.ceil(plans.length / 3)}
                  </span>
                  <button
                    onClick={() => setPlanIndex((i) => (i + 1) % Math.ceil(plans.length / 3))}
                    className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={t("store_next_plans")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Contact links */}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {pro.business_phone && (
            <button
              type="button"
              onClick={() => Browser.open({ url: `https://wa.me/${pro.business_phone!.replace(/\D/g, "")}` })}
              className="flex items-center gap-1 hover:text-green-500 transition-colors"
            >
              <Phone className="h-3 w-3" />
              WhatsApp
            </button>
          )}
          {pro.business_email && (
            <button
              type="button"
              onClick={() => onEmailClick(pro.business_email!)}
              className="flex items-center gap-1 hover:text-brand transition-colors"
            >
              <Mail className="h-3 w-3" />
              Email
            </button>
          )}
          {isSafeExternalUrl(pro.business_website) && (
            <button
              type="button"
              onClick={() => openExternalUrl(pro.business_website, Browser.open)}
              className="flex items-center gap-1 hover:text-brand transition-colors"
            >
              <Globe className="h-3 w-3" />
              {t("store_website")}
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-7"
            onClick={() => onViewProfile(pro.user_id)}
          >
            {t("store_view_profile")}
          </Button>
          <Button
            size="sm"
            className="flex-1 text-xs h-7 gap-1"
            onClick={() => onMessage(pro.user_id)}
          >
            <MessageCircle className="h-3 w-3" />
            {t("store_contact")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function Store() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  // Drawers de criar/editar promoção têm formulários longos — mantém o campo em
  // foco acima do teclado iOS (ref-less: rola o container ativo detectado).
  useKeyboardInputScroll();

  // Tab state
  const [activeTab, setActiveTab] = React.useState<"promocoes" | "profissionais">("promocoes");

  // Promotions state
  const [promotions, setPromotions] = React.useState<Promotion[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeCategory, setActiveCategory] = React.useState<PromotionCategory | "todos">("todos");
  const [showExpired, setShowExpired] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [newPromoOpen, setNewPromoOpen] = React.useState(false);
  const [editingPromo, setEditingPromo] = React.useState<Promotion | null>(null);
  const [detailPromo, setDetailPromo] = React.useState<Promotion | null>(null);
  const [inactivateTargetId, setInactivateTargetId] = React.useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const [viewerUserId, setViewerUserId] = React.useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = React.useState(true);
  const likingRef = React.useRef<Set<string>>(new Set());
  const votingRef = React.useRef<Set<string>>(new Set());

  // Professionals state
  const [professionals, setProfessionals] = React.useState<ProfessionalProfile[]>([]);
  const [proLoading, setProLoading] = React.useState(false);
  const [proSearch, setProSearch] = React.useState("");
  const [proSegment, setProSegment] = React.useState<string>("todos");
  const [plansModalPro, setPlansModalPro] = React.useState<ProfessionalProfile | null>(null);
  const [emailModal, setEmailModal] = React.useState<string | null>(null);
  const [emailCopied, setEmailCopied] = React.useState(false);

  React.useEffect(() => {
    setViewerLoading(true);
    getViewer().then((v) => {
      setViewerUserId(v?.id ?? null);
      setViewerLoading(false);
    });
  }, [user]);

  async function load() {
    setLoading(true);
    try {
      const data = await getPromotionsDb(activeCategory);
      setPromotions(data);
    } catch {
      toast({ title: t("store_load_error"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function loadProfessionals() {
    setProLoading(true);
    try {
      const data = await getProfessionalsDb(proSegment === "todos" ? undefined : proSegment);
      setProfessionals(data);
    } catch {
      toast({ title: t("store_pro_load_error"), variant: "destructive" });
    } finally {
      setProLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  React.useEffect(() => {
    if (activeTab === "profissionais") loadProfessionals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, proSegment]);

  async function handleStatusVote(id: string, status: "active" | "expired") {
    if (!user) {
      toast({ title: t("store_login_to_vote"), variant: "destructive" });
      return;
    }
    const voteKey = `${id}-${status}`;
    if (votingRef.current.has(voteKey)) return;
    votingRef.current.add(voteKey);
    try {
      const result = await reportPromotionStatusDb(id, status);
      setPromotions((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          const prevVote = p.user_status_vote;
          const wasActive = prevVote === "active";
          const wasExpired = prevVote === "expired";
          if (result === "removed") {
            return {
              ...p,
              user_status_vote: null,
              active_reports: Math.max(0, (p.active_reports ?? 0) - (wasActive ? 1 : 0)),
              expired_reports: Math.max(0, (p.expired_reports ?? 0) - (wasExpired ? 1 : 0)),
            };
          }
          // voted (new or changed)
          return {
            ...p,
            user_status_vote: status,
            active_reports: (p.active_reports ?? 0) + (status === "active" ? 1 : 0) - (wasActive ? 1 : 0),
            expired_reports: (p.expired_reports ?? 0) + (status === "expired" ? 1 : 0) - (wasExpired ? 1 : 0),
          };
        }),
      );
    } catch (err: any) {
      toast({ title: t("store_vote_error"), description: err?.message, variant: "destructive" });
    } finally {
      votingRef.current.delete(voteKey);
    }
  }

  async function handleLike(id: string) {
    if (!user) {
      toast({ title: t("store_login_to_like"), variant: "destructive" });
      return;
    }
    if (likingRef.current.has(id)) return;
    likingRef.current.add(id);

    let previousPromotions: Promotion[] = [];
    setPromotions((prev) => {
      previousPromotions = prev;
      return prev.map((p) =>
        p.id === id
          ? {
              ...p,
              user_liked: !p.user_liked,
              likes_count: Math.max(0, (p.likes_count ?? 0) + (p.user_liked ? -1 : 1)),
            }
          : p,
      );
    });

    try {
      const result = await togglePromotionLikeDb(id);
      // Reconcile with server response in case of divergence
      const baseLikes = previousPromotions.find((p) => p.id === id)?.likes_count ?? 0;
      setPromotions((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                user_liked: result === "liked",
                likes_count: Math.max(0, baseLikes + (result === "liked" ? 1 : -1)),
              }
            : p,
        ),
      );
    } catch (err: any) {
      setPromotions(previousPromotions);
      const msg = err?.message ?? err?.error_description ?? JSON.stringify(err);
      console.error("[handleLike]", err);
      toast({ title: t("store_like_error"), description: msg, variant: "destructive" });
    } finally {
      likingRef.current.delete(id);
    }
  }

  async function handleInactivate(id: string) {
    try {
      await updatePromotionDb(id, { is_active: false });
      setPromotions((prev) => prev.filter((p) => p.id !== id));
      setInactivateTargetId(null);
      toast({ title: t("store_deactivated") });
    } catch (err: any) {
      const msg = err?.message ?? err?.error_description ?? JSON.stringify(err);
      console.error("[handleInactivate]", err);
      toast({ title: t("store_deactivate_error"), description: msg, variant: "destructive" });
    }
  }

  async function handleDelete(id: string) {
    try {
      await deletePromotionDb(id);
      setPromotions((prev) => prev.filter((p) => p.id !== id));
      setDeleteTargetId(null);
      toast({ title: t("store_removed") });
    } catch (err: any) {
      const msg = err?.message ?? err?.error_description ?? JSON.stringify(err);
      console.error("[handleDelete]", err);
      toast({ title: t("store_remove_error"), description: msg, variant: "destructive" });
    }
  }

  const filtered = React.useMemo(() => {
    const byStatus = promotions.filter((p) => isPromoExpired(p) === showExpired);
    if (!search.trim()) return byStatus;
    const q = search.toLowerCase();
    return byStatus.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q) ||
        (p.user_nickname ?? "").toLowerCase().includes(q),
    );
  }, [promotions, search, showExpired]);

  const filteredProfessionals = React.useMemo(() => {
    if (!proSearch.trim()) return professionals;
    const q = proSearch.toLowerCase();
    return professionals.filter(
      (p) =>
        p.business_name.toLowerCase().includes(q) ||
        p.nickname.toLowerCase().includes(q) ||
        (p.business_description ?? "").toLowerCase().includes(q) ||
        (p.business_segment ?? "").toLowerCase().includes(q),
    );
  }, [professionals, proSearch]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header — only title + action button stays sticky */}
      <div
        className="sticky top-0 z-20"
        style={{
          background: "linear-gradient(rgba(6,7,12,.88),rgba(6,7,12,.72))",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          borderBottom: "1px solid rgba(255,255,255,.08)",
        }}
      >
        <div className="max-w-2xl mx-auto px-4 py-1 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-brand" />
            <h1 className="font-bold text-lg">{t("store_title")}</h1>
          </div>
          {activeTab === "promocoes" && user && (
            <Button size="sm" onClick={() => setNewPromoOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{t("store_publish")}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs + filters — scroll with content */}
      <div className="max-w-2xl mx-auto px-4 pt-2 pb-3 space-y-2">
        {/* Tabs */}
        <div
          className="flex rounded-xl overflow-hidden"
          style={{
            background: "linear-gradient(rgba(255,255,255,.08),rgba(255,255,255,.03))",
            backdropFilter: "blur(16px) saturate(160%)",
            WebkitBackdropFilter: "blur(16px) saturate(160%)",
            border: "1px solid rgba(255,255,255,.10)",
          }}
        >
          <button
            onClick={() => setActiveTab("promocoes")}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2.5 transition-colors ${activeTab === "promocoes" ? "bg-brand text-white" : "text-white/50 hover:text-white/80"}`}
          >
            <Tag className="h-4 w-4" />
            {t("store_tab_promotions")}
          </button>
          <button
            onClick={() => setActiveTab("profissionais")}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2.5 transition-colors ${activeTab === "profissionais" ? "bg-brand text-white" : "text-white/50 hover:text-white/80"}`}
          >
            <Users className="h-4 w-4" />
            {t("store_tab_professionals")}
          </button>
        </div>

        {activeTab === "promocoes" && (
          <>
            {/* Search + Category filter inline */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder={t("store_search_promos_placeholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 text-xs font-medium px-3 h-9 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap flex-shrink-0">
                    {activeCategory === "todos" ? (
                      <PackageOpen className="h-4 w-4" />
                    ) : (
                      CATEGORY_ICONS[activeCategory]
                    )}
                    <span>
                      {activeCategory === "todos"
                        ? t("store_category_all")
                        : categoryLabel(activeCategory, t)}
                    </span>
                    <svg className="h-3.5 w-3.5 ml-0.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[160px]">
                  <DropdownMenuItem
                    onClick={() => setActiveCategory("todos")}
                    className={`flex items-center gap-2 text-xs ${activeCategory === "todos" ? "font-semibold text-brand" : ""}`}
                  >
                    <PackageOpen className="h-4 w-4" />
                    {t("store_category_all")}
                  </DropdownMenuItem>
                  {PROMOTION_CATEGORIES.map((c) => (
                    <DropdownMenuItem
                      key={c.value}
                      onClick={() => setActiveCategory(c.value)}
                      className={`flex items-center gap-2 text-xs ${activeCategory === c.value ? "font-semibold text-brand" : ""}`}
                    >
                      {CATEGORY_ICONS[c.value]}
                      {categoryLabel(c.value, t)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                type="button"
                onClick={() => setShowExpired((v) => !v)}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 h-9 rounded-lg border transition-colors whitespace-nowrap flex-shrink-0 ${
                  showExpired
                    ? "bg-brand text-white border-brand"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">{t("store_filter_expired")}</span>
              </button>
            </div>
          </>
        )}

        {activeTab === "profissionais" && (
          <>
            {/* Professionals search + Segment filter inline */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder={t("store_search_pros_placeholder")}
                  value={proSearch}
                  onChange={(e) => setProSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 text-xs font-medium px-3 h-9 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap flex-shrink-0">
                    <Briefcase className="h-4 w-4" />
                    <span>{proSegment === "todos" ? t("store_segment_all") : segmentLabel(proSegment, t)}</span>
                    <svg className="h-3.5 w-3.5 ml-0.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[180px]">
                  <DropdownMenuItem onClick={() => setProSegment("todos")} className={`flex items-center gap-2 text-xs ${proSegment === "todos" ? "font-semibold text-brand" : ""}`}>
                    <Users className="h-4 w-4" />
                    {t("store_segment_all")}
                  </DropdownMenuItem>
                  {Object.keys(SEGMENT_LABEL_KEYS).map((value) => (
                    <DropdownMenuItem
                      key={value}
                      onClick={() => setProSegment(value)}
                      className={`flex items-center gap-2 text-xs ${proSegment === value ? "font-semibold text-brand" : ""}`}
                    >
                      <Briefcase className="h-4 w-4" />
                      {segmentLabel(value, t)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        {activeTab === "promocoes" && (
          loading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <PromotionSkeleton key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                {showExpired ? (
                  <History className="h-7 w-7 text-muted-foreground" />
                ) : (
                  <Tag className="h-7 w-7 text-muted-foreground" />
                )}
              </div>
              <p className="font-semibold text-muted-foreground">
                {showExpired
                  ? t("store_empty_expired_title")
                  : search || activeCategory !== "todos"
                  ? t("store_empty_search_title")
                  : t("store_empty_title")}
              </p>
              <p className="text-sm text-muted-foreground max-w-xs">
                {showExpired
                  ? t("store_empty_expired_desc")
                  : search
                  ? t(activeCategory !== "todos" ? "store_empty_search_desc_cat" : "store_empty_search_desc").replace("{q}", search)
                  : activeCategory !== "todos"
                  ? t("store_empty_category_desc").replace("{cat}", categoryLabel(activeCategory, t))
                  : t("store_empty_cta_desc")}
              </p>
              {activeCategory !== "todos" && (
                <Button variant="outline" onClick={() => setActiveCategory("todos")} className="mt-1 gap-2">
                  <PackageOpen className="h-4 w-4" />
                  {t("store_see_all_categories")}
                </Button>
              )}
              {!search && !showExpired && activeCategory === "todos" && user && (
                <Button onClick={() => setNewPromoOpen(true)} className="mt-2 gap-2">
                  <Plus className="h-4 w-4" />
                  {t("store_publish_promo")}
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 auto-rows-fr">
              {filtered.map((p) => (
                <PromotionCard
                  key={p.id}
                  promo={p}
                  viewerUserId={viewerUserId}
                  viewerLoading={viewerLoading}
                  onLike={handleLike}
                  onStatusVote={handleStatusVote}
                  onEdit={(promo) => setEditingPromo(promo)}
                  onInactivate={(id) => setInactivateTargetId(id)}
                  onDelete={(id) => setDeleteTargetId(id)}
                  onUserClick={(userId) => navigate(`/usuario/${userId}`)}
                  onOpenDetail={(promo) => setDetailPromo(promo)}
                />
              ))}
            </div>
          )
        )}

        {activeTab === "profissionais" && (
          proLoading ? (
            <StoreSkeleton />
          ) : filteredProfessionals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <Users className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="font-semibold text-muted-foreground">
                {proSearch || proSegment !== "todos" ? t("store_pro_empty_search_title") : t("store_pro_empty_title")}
              </p>
              <p className="text-sm text-muted-foreground max-w-xs">
                {proSearch
                  ? t("store_pro_empty_search_desc")
                  : proSegment !== "todos"
                  ? t("store_pro_empty_segment_desc").replace("{seg}", segmentLabel(proSegment, t))
                  : t("store_pro_empty_desc")}
              </p>
              {proSegment !== "todos" && (
                <Button variant="outline" onClick={() => setProSegment("todos")} className="mt-1 gap-2">
                  <Users className="h-4 w-4" />
                  {t("store_see_all_segments")}
                </Button>
              )}
              {!proSearch && proSegment === "todos" && user && (
                <Button variant="outline" onClick={() => navigate("/perfil")} className="mt-1 gap-2">
                  <Briefcase className="h-4 w-4" />
                  {t("store_activate_commercial")}
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 auto-rows-fr">
              {filteredProfessionals.map((pro) => (
                <ProfessionalCard
                  key={pro.user_id}
                  professional={pro}
                  onViewProfile={(userId) => navigate(`/usuario/${userId}`)}
                  onMessage={(userId) => navigate(`/comunidade?user=${userId}`)}
                  onViewPlans={(p) => setPlansModalPro(p)}
                  onEmailClick={(email) => { setEmailModal(email); setEmailCopied(false); }}
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* Promotion Detail Drawer */}
      <PromotionDetailDrawer
        promo={detailPromo ? (filtered.find((p) => p.id === detailPromo.id) ?? detailPromo) : null}
        open={!!detailPromo}
        onClose={() => setDetailPromo(null)}
        viewerUserId={viewerUserId}
        viewerLoading={viewerLoading}
        onLike={handleLike}
        onStatusVote={handleStatusVote}
        onEdit={(promo) => setEditingPromo(promo)}
        onInactivate={(id) => setInactivateTargetId(id)}
        onDelete={(id) => setDeleteTargetId(id)}
      />

      {/* New Promo Drawer */}
      <NewPromoDrawer
        open={newPromoOpen}
        onCreated={load}
        onClose={() => setNewPromoOpen(false)}
      />

      <EditPromoDrawer
        open={!!editingPromo}
        promo={editingPromo}
        onUpdated={load}
        onClose={() => setEditingPromo(null)}
      />

      <AlertDialog
        open={!!inactivateTargetId}
        onOpenChange={(v) => !v && setInactivateTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("store_deactivate_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("store_deactivate_confirm_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("store_no_back")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => inactivateTargetId && handleInactivate(inactivateTargetId)}
            >
              {t("store_yes_deactivate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Plans Modal */}
      <Dialog open={!!plansModalPro} onOpenChange={(v) => !v && setPlansModalPro(null)}>
        <DialogContent className="max-w-sm rounded-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-brand" />
              {t("store_plans_title")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            {plansModalPro && (
              <p className="text-sm text-muted-foreground">{plansModalPro.business_name || plansModalPro.nickname}</p>
            )}
            {(plansModalPro?.service_plans ?? []).map((plan, idx) => (
              <div key={idx} className="rounded-xl px-4 py-3 space-y-1" style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)" }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{plan.name}</span>
                  {plan.price != null && (
                    <span className="text-sm font-bold text-brand">
                      R$ {typeof plan.price === "number" ? plan.price.toFixed(2).replace(".", ",") : plan.price}
                    </span>
                  )}
                </div>
                {plan.description && (
                  <p className="text-xs text-muted-foreground leading-snug">{plan.description}</p>
                )}
              </div>
            ))}
            {(plansModalPro?.service_plans ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">{t("store_plans_empty")}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Modal */}
      <Dialog open={!!emailModal} onOpenChange={(v) => !v && setEmailModal(null)}>
        <DialogContent className="max-w-sm rounded-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-brand" />
              {t("store_email_title")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)" }}
            >
              <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-medium flex-1 break-all">{emailModal}</span>
            </div>
            <Button
              className="w-full gap-2"
              onClick={() => {
                if (!emailModal) return;
                copyToClipboard(emailModal);
                setEmailCopied(true);
                toast({ title: t("store_email_copied"), description: emailModal });
                setTimeout(() => setEmailCopied(false), 2000);
              }}
            >
              {emailCopied ? (
                <>
                  <Check className="h-4 w-4" />
                  {t("store_copied")}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  {t("store_copy_email")}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("store_remove_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("store_remove_confirm_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTargetId && handleDelete(deleteTargetId)}
            >
              {t("remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
