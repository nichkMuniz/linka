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
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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
import { LoadingSpinner } from "@/components/shared/animated-loading";
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
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { ImageCropperDrawer } from "@/components/shared/image-cropper-drawer";

// ─── Promotion Skeleton ──────────────────────────────────────────────────────

function PromotionSkeleton() {
  return (
    <Card className="border-border/60 overflow-hidden flex flex-col animate-pulse">
      <div className="w-full aspect-[4/3] bg-muted flex-shrink-0" />
      <CardContent className="p-3 flex flex-col gap-2">
        <div className="h-5 w-20 rounded-full bg-muted" />
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-2/3 rounded bg-muted" />
        <div className="flex items-center justify-between pt-2 border-t border-border/40 mt-1">
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-5 rounded-full bg-muted" />
            <div className="h-3 w-16 rounded bg-muted" />
          </div>
          <div className="h-4 w-8 rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
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

function categoryLabel(cat: string) {
  return PROMOTION_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
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
}: PromotionCardProps) {
  const isOwner = !viewerLoading && viewerUserId === promo.user_id;
  const isLoggedIn = !viewerLoading && !!viewerUserId;
  const [couponCopied, setCouponCopied] = React.useState(false);

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
    <Card className="border-border/60 overflow-hidden flex flex-col">
      {/* Image */}
      {promo.photo_url && (
        <div className="relative w-full aspect-[4/3] bg-muted overflow-hidden flex-shrink-0">
          <ImageWithFallback
            src={promo.photo_url}
            alt={promo.title}
            className={`w-full h-full object-contain transition-opacity ${majorityExpired ? "opacity-50" : ""}`}
            fallback="/placeholder.svg"
          />
          {discountDisplay && (
            <span className="absolute top-2 left-2 bg-brand text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              {discountDisplay}
            </span>
          )}
          {majorityExpired && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="bg-background/80 text-destructive text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border border-destructive/30">
                <AlertTriangle className="h-3 w-3" />
                Pode ter expirado
              </span>
            </div>
          )}
        </div>
      )}

      <CardContent className="p-3 flex flex-col flex-1 gap-2">
        {/* Header row: category badge + menu */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[promo.category] ?? CATEGORY_COLORS.outro}`}
          >
            {CATEGORY_ICONS[promo.category] ?? CATEGORY_ICONS.outro}
            {categoryLabel(promo.category)}
          </span>

          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 -mr-1">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(promo)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onInactivate(promo.id)}>
                  <Ban className="h-4 w-4 mr-2" />
                  Inativar
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDelete(promo.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remover
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Title */}
        <p className="font-semibold text-sm leading-tight">{promo.title}</p>

        {/* Description — grows to fill space, pushing footer down */}
        {promo.description && (
          <p className="text-xs text-muted-foreground line-clamp-3 flex-1">{promo.description}</p>
        )}

        {/* Spacer when no description */}
        {!promo.description && <div className="flex-1" />}

        {/* Expires */}
        {promo.expires_at && (
          <p className="text-xs text-muted-foreground">
            Válido até {new Date(promo.expires_at).toLocaleDateString("pt-BR")}
          </p>
        )}

        {/* Coupon */}
        {promo.coupon_code && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(promo.coupon_code!);
              toast({ title: "Cupom copiado!", description: promo.coupon_code });
              setCouponCopied(true);
              setTimeout(() => setCouponCopied(false), 2000);
            }}
            className="flex items-center gap-2 w-full rounded-lg border border-dashed border-brand/50 bg-brand/5 px-2.5 py-1.5 hover:bg-brand/10 transition-colors"
          >
            <Ticket className="h-3.5 w-3.5 text-brand flex-shrink-0" />
            <span className="font-mono text-xs font-bold text-brand tracking-wider flex-1 text-left">
              {promo.coupon_code}
            </span>
            {couponCopied ? (
              <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
            ) : (
              <Copy className="h-3 w-3 text-brand/60 flex-shrink-0" />
            )}
          </button>
        )}

        {/* Pricing */}
        {(promo.promo_price != null || promo.original_price != null) && (
          <div className="flex items-baseline gap-2">
            {promo.promo_price != null && (
              <span className="text-base font-bold text-brand">
                R$ {promo.promo_price.toFixed(2).replace(".", ",")}
              </span>
            )}
            {promo.original_price != null && promo.promo_price != null && (
              <span className="text-xs text-muted-foreground line-through">
                R$ {promo.original_price.toFixed(2).replace(".", ",")}
              </span>
            )}
            {promo.original_price != null && promo.promo_price == null && (
              <span className="text-base font-semibold">
                R$ {promo.original_price.toFixed(2).replace(".", ",")}
              </span>
            )}
          </div>
        )}


        {/* Status vote — only for non-owners when logged in */}
        {!isOwner && isLoggedIn && (
          <div className="flex items-center gap-1.5 pt-1.5 border-t border-border/40 mt-1">
            <span className="text-[10px] text-muted-foreground flex-shrink-0">Ainda ativo?</span>
            <button
              onClick={() => onStatusVote(promo.id, "active")}
              aria-label="Marcar como ativo"
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                promo.user_status_vote === "active"
                  ? "bg-green-500/20 text-green-500"
                  : "text-muted-foreground hover:text-green-500 hover:bg-green-500/10"
              }`}
            >
              <ThumbsUp className="h-3 w-3" />
              {(promo.active_reports ?? 0) > 0 && <span>{promo.active_reports}</span>}
            </button>
            <button
              onClick={() => onStatusVote(promo.id, "expired")}
              aria-label="Marcar como expirada"
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                promo.user_status_vote === "expired"
                  ? "bg-destructive/20 text-destructive"
                  : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              }`}
            >
              <ThumbsDown className="h-3 w-3" />
              {(promo.expired_reports ?? 0) > 0 && <span>{promo.expired_reports}</span>}
            </button>
          </div>
        )}

        {/* Footer — always at bottom */}
        <div className="flex items-center justify-between pt-2 border-t border-border/40 mt-1">
          <button
            onClick={() => onUserClick(promo.user_id)}
            className="flex items-center gap-1.5 min-w-0"
          >
            <UserAvatar
              photo={promo.user_photo}
              gender={promo.user_gender}
              nickname={promo.user_nickname}
              className="h-5 w-5 flex-shrink-0"
            />
            <span className="text-xs text-muted-foreground truncate max-w-[100px]">
              {promo.user_nickname}
            </span>
          </button>

          <div className="flex items-center gap-1 flex-shrink-0">
            {promo.external_link && (
              <a href={promo.external_link} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </a>
            )}
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
      </CardContent>
    </Card>
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
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Selecione uma imagem válida.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Imagem deve ter no máximo 10MB.", variant: "destructive" });
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
      if (!user) throw new Error("Não autenticado");
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
      toast({ title: "URL inválida. Inclua https://", variant: "destructive" });
      return;
    }

    setFetching(true);
    try {
      const data = await fetchLinkPreview(url);
      const anyFilled = data.title || data.description || data.image || data.price;

      if (data.title) setTitle(data.title.slice(0, 120));
      if (data.description) setDescription(data.description.slice(0, 500));
      if (data.image) setPhotoUrl(data.image);
      if (data.price) setPromoPrice(String(data.price));
      setExternalLink(url);
      setPrefilled(true);

      if (anyFilled) {
        toast({ title: "Informações importadas!", description: "Revise e ajuste antes de publicar." });
      } else {
        toast({
          title: "Link salvo, mas sem dados automáticos",
          description: "Este site não expõe meta tags. Preencha manualmente.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Não foi possível buscar o link",
        description: err?.message ?? "Preencha manualmente os campos abaixo.",
        variant: "destructive",
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
      toast({ title: "Preencha o título da promoção.", variant: "destructive" });
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
        original_price: originalPrice ? parseFloat(originalPrice) : undefined,
        promo_price: promoPrice ? parseFloat(promoPrice) : undefined,
        photo_url: finalPhotoUrl ?? undefined,
        external_link: externalLink || undefined,
        coupon_code: couponCode || undefined,
        expires_at: expiresAt || undefined,
      });
      toast({ title: "Promoção publicada!" });
      reset();
      onCreated();
      onClose();
    } catch (err: any) {
      toast({
        title: "Erro ao publicar",
        description: err?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <Drawer open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DrawerContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-brand" />
            Nova Promoção
          </DrawerTitle>
        </DrawerHeader>

        <div className="overflow-y-auto max-h-[65vh] px-4 space-y-4 pb-2">
          {/* ── Step 1: Link ── */}
          <div className={`space-y-3 rounded-xl p-3 border transition-colors ${prefilled ? "border-border/40 bg-muted/30" : "border-brand/40 bg-brand/5"}`}>
            <div className="flex items-center gap-2">
              <span className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${prefilled ? "bg-green-500 text-white" : "bg-brand text-white"}`}>
                {prefilled ? "✓" : "1"}
              </span>
              <span className="text-sm font-medium">Cole o link do produto</span>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="https://www.amazon.com.br/..."
                value={linkInput}
                onChange={(e) => { setLinkInput(e.target.value); if (prefilled) setPrefilled(false); }}
                onKeyDown={(e) => e.key === "Enter" && !fetching && handleFetchPreview()}
                className="flex-1"
              />
              <Button
                type="button"
                onClick={handleFetchPreview}
                disabled={fetching || !linkInput.trim()}
                className="flex-shrink-0 gap-1.5"
              >
                {fetching ? (
                  <LoadingSpinner className="h-4 w-4" />
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Buscar
                  </>
                )}
              </Button>
            </div>
            {!prefilled && (
              <p className="text-xs text-muted-foreground">
                Funciona com Amazon, Mercado Livre, iHerb e outros.
              </p>
            )}
            {prefilled && (
              <p className="text-xs text-green-500">
                Informações importadas — revise abaixo antes de publicar.
              </p>
            )}
          </div>

          {/* ── Step 2: Details (shown only after fetch) ── */}
          {prefilled && (
            <>
              <div className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-brand text-white">2</span>
                <span className="text-sm font-medium">Revise e complete</span>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Título *</label>
                <Input
                  placeholder="Ex: Whey Protein 25% OFF"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Descrição</label>
                <Textarea
                  placeholder="Descreva a promoção, condições, detalhes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Categoria *</label>
                <Select value={category} onValueChange={(v) => setCategory(v as PromotionCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    {PROMOTION_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Prices */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Preço original (R$)</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="99,90"
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Preço promo (R$)</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="74,90"
                    value={promoPrice}
                    onChange={(e) => setPromoPrice(e.target.value)}
                  />
                </div>
              </div>

              {/* Photo — URL or upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Imagem do produto</label>
                  <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                    <button
                      type="button"
                      onClick={() => setImageMode("url")}
                      className={`flex items-center gap-1 px-2.5 py-1 transition-colors ${imageMode === "url" ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <Link className="h-3 w-3" /> URL
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageMode("upload")}
                      className={`flex items-center gap-1 px-2.5 py-1 transition-colors ${imageMode === "upload" ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <ImageIcon className="h-3 w-3" /> Galeria
                    </button>
                  </div>
                </div>

                {imageMode === "url" ? (
                  <Input
                    placeholder="https://..."
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
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
                      className="w-full rounded-lg border-2 border-dashed border-border hover:border-brand/50 transition-colors p-4 flex flex-col items-center gap-2"
                    >
                      {uploadFile ? (
                        <span className="text-xs text-green-500 font-medium">{uploadFile.name}</span>
                      ) : (
                        <>
                          <Upload className="h-5 w-5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Toque para escolher da galeria</span>
                        </>
                      )}
                    </button>
                  </>
                )}

                {/* Preview */}
                {photoUrl && (
                  <div className="rounded-lg overflow-hidden aspect-video bg-muted">
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
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Ticket className="h-3.5 w-3.5 text-brand" />
                  Cupom de desconto
                  <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                </label>
                <Input
                  placeholder="Ex: PROMO10"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  maxLength={30}
                  className="font-mono tracking-wider"
                />
              </div>

              {/* Expires at */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Válido até</label>
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <DrawerFooter className="pt-2">
          {prefilled && (
            <Button onClick={handleSubmit} disabled={saving || uploading} className="w-full">
              {uploading ? (
                <><LoadingSpinner className="h-4 w-4" /><span className="ml-2">Enviando imagem...</span></>
              ) : saving ? (
                <><LoadingSpinner className="h-4 w-4" /><span className="ml-2">Publicando...</span></>
              ) : "Publicar Promoção"}
            </Button>
          )}
          <Button variant="ghost" onClick={() => { reset(); onClose(); }} disabled={saving}>
            Cancelar
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
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [couponCode, setCouponCode] = React.useState("");
  const [originalPrice, setOriginalPrice] = React.useState("");
  const [promoPrice, setPromoPrice] = React.useState("");
  const [expiresAt, setExpiresAt] = React.useState("");
  const [category, setCategory] = React.useState<PromotionCategory>("equipamento");
  const [photoUrl, setPhotoUrl] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (promo) {
      setTitle(promo.title || "");
      setDescription(promo.description || "");
      setCouponCode(promo.coupon_code || "");
      setOriginalPrice(promo.original_price != null ? String(promo.original_price) : "");
      setPromoPrice(promo.promo_price != null ? String(promo.promo_price) : "");
      setExpiresAt(promo.expires_at ? promo.expires_at.slice(0, 10) : "");
      setCategory((promo.category as PromotionCategory) || "equipamento");
      setPhotoUrl(promo.photo_url || "");
    }
  }, [promo, open]);

  async function handleSubmit() {
    if (!promo) return;
    if (!title.trim()) {
      toast({ title: "O título não pode estar vazio.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await updatePromotionDb(promo.id, {
        title: title.trim(),
        description: description || undefined,
        coupon_code: couponCode || undefined,
        original_price: originalPrice ? parseFloat(originalPrice) : null,
        promo_price: promoPrice ? parseFloat(promoPrice) : null,
        expires_at: expiresAt || null,
        category,
        photo_url: photoUrl || null,
      });
      toast({ title: "Promoção atualizada!" });
      onUpdated();
      onClose();
    } catch (err: any) {
      toast({
        title: "Erro ao atualizar",
        description: err?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DrawerContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-brand" />
            Editar Promoção
          </DrawerTitle>
        </DrawerHeader>

        <div className="overflow-y-auto max-h-[65vh] px-4 space-y-4 pb-6">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Título *</label>
            <Input
              placeholder="Ex: Whey Protein 25% OFF"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Descrição</label>
            <Textarea
              placeholder="Descreva a promoção..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Categoria *</label>
            <Select value={category} onValueChange={(v) => setCategory(v as PromotionCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[9999]">
                {PROMOTION_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Preço original (R$)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="99,90"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Preço promo (R$)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="74,90"
                value={promoPrice}
                onChange={(e) => setPromoPrice(e.target.value)}
              />
            </div>
          </div>

          {/* Photo URL */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">URL da imagem</label>
            <Input
              placeholder="https://..."
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
            />
            {photoUrl && (
              <div className="rounded-lg overflow-hidden aspect-video bg-muted">
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
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Ticket className="h-3.5 w-3.5 text-brand" />
              Cupom de desconto
              <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
            </label>
            <Input
              placeholder="Ex: NOVO10"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              maxLength={30}
              className="font-mono tracking-wider"
            />
          </div>

          {/* Expires at */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Válido até</label>
            <Input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
        </div>

        <DrawerFooter className="pt-2">
          <Button onClick={handleSubmit} disabled={saving} className="w-full">
            {saving ? (
              <><LoadingSpinner className="h-4 w-4" /><span className="ml-2">Salvando...</span></>
            ) : "Salvar Alterações"}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

// ─── Segment labels ──────────────────────────────────────────────────────────

const SEGMENT_LABELS: Record<string, string> = {
  personal_trainer: "Personal Trainer",
  nutricionista: "Nutricionista",
  fisioterapeuta: "Fisioterapeuta",
  coach: "Coach",
  medico: "Médico / Dr.",
  outro: "Outro",
};

const SEGMENT_COLORS: Record<string, string> = {
  personal_trainer: "bg-brand/15 text-brand",
  nutricionista: "bg-green-500/15 text-green-400",
  fisioterapeuta: "bg-blue-500/15 text-blue-400",
  coach: "bg-purple-500/15 text-purple-400",
  medico: "bg-red-500/15 text-red-400",
  outro: "bg-muted text-muted-foreground",
};

function segmentLabel(seg: string) {
  return SEGMENT_LABELS[seg] ?? seg;
}

// ─── Professional Card ───────────────────────────────────────────────────────

type ProfessionalCardProps = {
  professional: ProfessionalProfile;
  onViewProfile: (userId: string) => void;
  onMessage: (userId: string) => void;
  onViewPlans: (pro: ProfessionalProfile) => void;
};

function ProfessionalCard({ professional: pro, onViewProfile, onMessage, onViewPlans }: ProfessionalCardProps) {
  const logoSrc = pro.business_logo_url || pro.photo;
  const [planIndex, setPlanIndex] = React.useState(0);
  const plans = pro.service_plans ?? [];
  return (
    <Card className="border-border/60 overflow-hidden flex flex-col">
      {/* Banner / Logo area */}
      <div
        className="h-20 bg-gradient-to-br from-brand/20 to-brand/5 flex items-center justify-center relative cursor-pointer"
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
          gender={pro.gender}
          nickname={pro.nickname}
          className="relative z-10 h-14 w-14 border-2 border-border flex-shrink-0"
        />
      </div>

      <CardContent className="p-3 flex flex-col flex-1 gap-2">
        {/* Segment badge */}
        <span
          className={`self-start inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${SEGMENT_COLORS[pro.business_segment] ?? SEGMENT_COLORS.outro}`}
        >
          <Briefcase className="h-3 w-3" />
          {segmentLabel(pro.business_segment)}
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
                    aria-label="Planos anteriores"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                  </button>
                  <span className="text-[10px] text-muted-foreground">
                    {planIndex + 1} / {Math.ceil(plans.length / 3)}
                  </span>
                  <button
                    onClick={() => setPlanIndex((i) => (i + 1) % Math.ceil(plans.length / 3))}
                    className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Próximos planos"
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
            <a
              href={`https://wa.me/${pro.business_phone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-green-500 transition-colors"
            >
              <Phone className="h-3 w-3" />
              WhatsApp
            </a>
          )}
          {pro.business_email && (
            <a
              href={`mailto:${pro.business_email}`}
              className="flex items-center gap-1 hover:text-brand transition-colors"
            >
              <Mail className="h-3 w-3" />
              Email
            </a>
          )}
          {pro.business_website && (
            <a
              href={/^https?:\/\//.test(pro.business_website) ? pro.business_website : `https://${pro.business_website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-brand transition-colors"
            >
              <Globe className="h-3 w-3" />
              Site
            </a>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1 border-t border-border/40">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-7"
            onClick={() => onViewProfile(pro.user_id)}
          >
            Ver perfil
          </Button>
          <Button
            size="sm"
            className="flex-1 text-xs h-7 gap-1"
            onClick={() => onMessage(pro.user_id)}
          >
            <MessageCircle className="h-3 w-3" />
            Contatar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function Store() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Tab state
  const [activeTab, setActiveTab] = React.useState<"promocoes" | "profissionais">("promocoes");

  // Promotions state
  const [promotions, setPromotions] = React.useState<Promotion[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeCategory, setActiveCategory] = React.useState<PromotionCategory | "todos">("todos");
  const [search, setSearch] = React.useState("");
  const [newPromoOpen, setNewPromoOpen] = React.useState(false);
  const [editingPromo, setEditingPromo] = React.useState<Promotion | null>(null);
  const [inactivateTargetId, setInactivateTargetId] = React.useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const [viewerUserId, setViewerUserId] = React.useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = React.useState(true);
  const likingRef = React.useRef<Set<string>>(new Set());

  // Professionals state
  const [professionals, setProfessionals] = React.useState<ProfessionalProfile[]>([]);
  const [proLoading, setProLoading] = React.useState(false);
  const [proSearch, setProSearch] = React.useState("");
  const [proSegment, setProSegment] = React.useState<string>("todos");
  const [plansModalPro, setPlansModalPro] = React.useState<ProfessionalProfile | null>(null);

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
      toast({ title: "Erro ao carregar promoções.", variant: "destructive" });
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
      toast({ title: "Erro ao carregar profissionais.", variant: "destructive" });
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
      toast({ title: "Faça login para votar.", variant: "destructive" });
      return;
    }
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
      toast({ title: "Erro ao votar", description: err?.message, variant: "destructive" });
    }
  }

  async function handleLike(id: string) {
    if (!user) {
      toast({ title: "Faça login para curtir.", variant: "destructive" });
      return;
    }
    // Prevent race condition: ignore if already processing this promotion
    if (likingRef.current.has(id)) return;
    likingRef.current.add(id);
    try {
      const result = await togglePromotionLikeDb(id);
      setPromotions((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
              ...p,
              user_liked: result === "liked",
              likes_count: Math.max(0, (p.likes_count ?? 0) + (result === "liked" ? 1 : -1)),
            }
            : p,
        ),
      );
    } catch (err: any) {
      const msg = err?.message ?? err?.error_description ?? JSON.stringify(err);
      console.error("[handleLike]", err);
      toast({ title: "Erro ao curtir", description: msg, variant: "destructive" });
    } finally {
      likingRef.current.delete(id);
    }
  }

  async function handleInactivate(id: string) {
    try {
      await updatePromotionDb(id, { is_active: false });
      setPromotions((prev) => prev.filter((p) => p.id !== id));
      toast({ title: "Promoção inativada." });
    } catch (err: any) {
      const msg = err?.message ?? err?.error_description ?? JSON.stringify(err);
      console.error("[handleInactivate]", err);
      toast({ title: "Erro ao inativar", description: msg, variant: "destructive" });
    } finally {
      setInactivateTargetId(null);
    }
  }

  async function handleDelete(id: string) {
    try {
      // For now, deletePromotionDb also soft-deletes via is_active = false
      // If we want a hard delete, we could update the DB function,
      // but following user instruction, inactivate = soft-delete.
      await deletePromotionDb(id);
      setPromotions((prev) => prev.filter((p) => p.id !== id));
      toast({ title: "Promoção removida." });
    } catch (err: any) {
      const msg = err?.message ?? err?.error_description ?? JSON.stringify(err);
      console.error("[handleDelete]", err);
      toast({ title: "Erro ao remover", description: msg, variant: "destructive" });
    } finally {
      setDeleteTargetId(null);
    }
  }

  const filtered = React.useMemo(() => {
    if (!search.trim()) return promotions;
    const q = search.toLowerCase();
    return promotions.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q) ||
        (p.user_nickname ?? "").toLowerCase().includes(q),
    );
  }, [promotions, search]);

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
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/50">
        <div className="max-w-2xl mx-auto px-4 py-1 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-brand" />
            <h1 className="font-bold text-lg">Vitrine</h1>
          </div>
          {activeTab === "promocoes" && (
            <Button size="sm" onClick={() => setNewPromoOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Publicar</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs + filters — scroll with content */}
      <div className="max-w-2xl mx-auto px-4 pt-2 pb-3 space-y-2">
        {/* Tabs */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setActiveTab("promocoes")}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 transition-colors ${activeTab === "promocoes" ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Tag className="h-4 w-4" />
            Promoções
            {!loading && promotions.length > 0 && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full leading-none ${activeTab === "promocoes" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"}`}>
                {promotions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("profissionais")}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 transition-colors ${activeTab === "profissionais" ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Users className="h-4 w-4" />
            Profissionais
            {!proLoading && professionals.length > 0 && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full leading-none ${activeTab === "profissionais" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"}`}>
                {professionals.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === "promocoes" && (
          <>
            {/* Search + Category filter inline */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Buscar promoções..."
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
                        ? "Todos"
                        : PROMOTION_CATEGORIES.find((c) => c.value === activeCategory)?.label}
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
                    Todos
                  </DropdownMenuItem>
                  {PROMOTION_CATEGORIES.map((c) => (
                    <DropdownMenuItem
                      key={c.value}
                      onClick={() => setActiveCategory(c.value)}
                      className={`flex items-center gap-2 text-xs ${activeCategory === c.value ? "font-semibold text-brand" : ""}`}
                    >
                      {CATEGORY_ICONS[c.value]}
                      {c.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
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
                  placeholder="Buscar profissionais..."
                  value={proSearch}
                  onChange={(e) => setProSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 text-xs font-medium px-3 h-9 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap flex-shrink-0">
                    <Briefcase className="h-4 w-4" />
                    <span>{proSegment === "todos" ? "Todos os segmentos" : SEGMENT_LABELS[proSegment] ?? proSegment}</span>
                    <svg className="h-3.5 w-3.5 ml-0.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[180px]">
                  <DropdownMenuItem onClick={() => setProSegment("todos")} className={`flex items-center gap-2 text-xs ${proSegment === "todos" ? "font-semibold text-brand" : ""}`}>
                    <Users className="h-4 w-4" />
                    Todos os segmentos
                  </DropdownMenuItem>
                  {Object.entries(SEGMENT_LABELS).map(([value, label]) => (
                    <DropdownMenuItem
                      key={value}
                      onClick={() => setProSegment(value)}
                      className={`flex items-center gap-2 text-xs ${proSegment === value ? "font-semibold text-brand" : ""}`}
                    >
                      <Briefcase className="h-4 w-4" />
                      {label}
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
                <Tag className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="font-semibold text-muted-foreground">
                {search ? "Nenhuma promoção encontrada" : "Ainda não há promoções"}
              </p>
              <p className="text-sm text-muted-foreground max-w-xs">
                {search
                  ? "Tente buscar por outro termo."
                  : "Seja o primeiro a divulgar uma promoção de equipamento, suplemento ou produto fitness!"}
              </p>
              {!search && (
                <Button onClick={() => setNewPromoOpen(true)} className="mt-2 gap-2">
                  <Plus className="h-4 w-4" />
                  Publicar Promoção
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
                  onUserClick={(userId) => navigate(`/perfil/${userId}`)}
                />
              ))}
            </div>
          )
        )}

        {activeTab === "profissionais" && (
          proLoading ? (
            <div className="flex justify-center py-16">
              <LoadingSpinner />
            </div>
          ) : filteredProfessionals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <Users className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="font-semibold text-muted-foreground">
                {proSearch ? "Nenhum profissional encontrado" : "Ainda não há profissionais cadastrados"}
              </p>
              <p className="text-sm text-muted-foreground max-w-xs">
                {proSearch
                  ? "Tente buscar por outro termo."
                  : "Profissionais como personal trainers e nutricionistas aparecerão aqui quando ativarem o perfil comercial."}
              </p>
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
                />
              ))}
            </div>
          )
        )}
      </div>

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
            <AlertDialogTitle>Inativar promoção?</AlertDialogTitle>
            <AlertDialogDescription>
              Ela deixará de aparecer na vitrine para outros usuários.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não, voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => inactivateTargetId && handleInactivate(inactivateTargetId)}
            >
              Sim, inativar
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
              Planos e Preços
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            {plansModalPro && (
              <p className="text-sm text-muted-foreground">{plansModalPro.business_name || plansModalPro.nickname}</p>
            )}
            {(plansModalPro?.service_plans ?? []).map((plan, idx) => (
              <div key={idx} className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 space-y-1">
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
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum plano cadastrado.</p>
            )}
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
            <AlertDialogTitle>Remover promoção?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A promoção será removida do hub.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTargetId && handleDelete(deleteTargetId)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
