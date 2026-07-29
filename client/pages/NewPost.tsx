import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useKeyboardInputScroll } from "@/hooks/use-keyboard-input-scroll";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { withNetworkRetry } from "@/lib/network-status";
import {
  getUserGoalsDb,
  getUserProfileDb,
  createPostDb,
  createShotDb,
  type UserGoal,
  type UserProfile,
  type SearchUser,
  incrementGoalProgressDb,
} from "@/lib/ritmofit-db";
import {
  ImagePlus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  Video,
  Sparkles,
  Target,
  Clapperboard,
  Camera,
  ArrowLeft,
  Send,
  Smile,
  MapPin,
  Hash,
  Check,
  Dumbbell,
  Heart,
  Trophy,
  Plus,
  ChevronDown,
  Images,
  FolderOpen,
  UserRoundPlus,
} from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { PhotoLibrary, type PhotoLibraryAsset, type PhotoLibraryAlbum } from "@capgo/capacitor-photo-library";
import { getNativeMediaUrl, purgeStaleMediaCache } from "@/lib/native-media";
import { Geolocation } from "@capacitor/geolocation";
import { UserAvatar } from "@/components/shared/user-avatar";
import { EmojiPickerDrawer } from "@/components/shared/emoji-picker-drawer";
import { TagPeopleDrawer } from "@/components/shared/tag-people-drawer";
import {
  InlineCropPreview,
  CroppedThumb,
  type CropTransform,
  DEFAULT_TRANSFORM,
  applyTransformToBlob,
  getCachedImage,
} from "@/components/shared/inline-crop-preview";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";

// ─── Module-level draft ─────────────────────────────────────────────────────

const imageDraft: {
  files: File[];
  previews: string[];
  transforms: Record<number, CropTransform>;
} = { files: [], previews: [], transforms: {} };

const videoDraft: { file: File | null; preview: string | null } = { file: null, preview: null };

// ─── Page component ─────────────────────────────────────────────────────────

type Step = "select" | "caption";
type MediaType = "post" | "shot";

const MAX_POST_PHOTOS = 5;

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const copy = arr.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

// Ícone da pasta no menu de álbuns — heurística pelo título (localizado pelo próprio iOS)
function albumMenuIcon(title: string) {
  const s = title.toLowerCase();
  if (s.includes("favorit")) return Heart;
  if (s.includes("vídeo") || s.includes("video")) return Video;
  return FolderOpen;
}

const ALBUM_SCAN_BATCH = 150;
const ALBUM_SCAN_MAX_PER_CALL = 1500;

export default function NewPost() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { t, language } = useLanguage();

  const [step, setStep] = React.useState<Step>(() => {
    const hasDraftContent = imageDraft.previews.length > 0 || !!videoDraft.preview;
    return hasDraftContent && sessionStorage.getItem("newpost_step") === "caption"
      ? "caption"
      : "select";
  });
  const [mediaType, setMediaType] = React.useState<MediaType>(
    () => (sessionStorage.getItem("newpost_tab") === "video" ? "shot" : "post"),
  );

  const [selectedFiles, setSelectedFiles] = React.useState<File[]>(() => imageDraft.files);
  const [previewUrls, setPreviewUrls] = React.useState<string[]>(() => imageDraft.previews);
  const [cropTransforms, setCropTransforms] = React.useState<Record<number, CropTransform>>(
    () => imageDraft.transforms
  );
  const [currentPreviewIndex, setCurrentPreviewIndex] = React.useState(0);
  // ── Reordenar fotos por arrastar (strip da Etapa 2) ──
  const [draggingPhotoIndex, setDraggingPhotoIndex] = React.useState<number | null>(null);
  const [photoDragOffsetX, setPhotoDragOffsetX] = React.useState(0);
  const photoDragStartXRef = React.useRef(0);
  const photoDragStartIndexRef = React.useRef<number | null>(null);
  const [description, setDescription] = React.useState(
    () => sessionStorage.getItem("newpost_description") || "",
  );
  const [selectedGoalId, setSelectedGoalId] = React.useState<string>(
    () => sessionStorage.getItem("newpost_goal_id") || "",
  );
  // ── Marcação de pessoas (estilo Instagram) ──
  const [taggedUsers, setTaggedUsers] = React.useState<SearchUser[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem("newpost_tagged_users") || "[]");
    } catch {
      return [];
    }
  });
  const [tagPeopleOpen, setTagPeopleOpen] = React.useState(false);

  const [selectedVideoFile, setSelectedVideoFile] = React.useState<File | null>(
    () => videoDraft.file,
  );
  const [videoPreview, setVideoPreview] = React.useState<string | null>(() => videoDraft.preview);
  const [videoDescription, setVideoDescription] = React.useState(
    () => sessionStorage.getItem("newpost_video_description") || "",
  );
  const captionTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  // A legenda fica abaixo das fotos, dentro do corpo rolável — o teclado iOS a
  // cobria (window.scrollBy não rola esse container interno). Ver hook.
  useKeyboardInputScroll();
  const [emojiPickerOpen, setEmojiPickerOpen] = React.useState(false);
  const [isLocating, setIsLocating] = React.useState(false);

  const [userGoals, setUserGoals] = React.useState<UserGoal[]>([]);
  const [isLoadingGoals, setIsLoadingGoals] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [imagePreviewOpen, setImagePreviewOpen] = React.useState(false);

  const [galleryAssets, setGalleryAssets] = React.useState<PhotoLibraryAsset[]>([]);
  const [galleryLoading, setGalleryLoading] = React.useState(false);
  const [galleryPermission, setGalleryPermission] = React.useState<"unknown" | "granted" | "limited" | "denied">("unknown");
  const [galleryPage, setGalleryPage] = React.useState(0);
  const [galleryHasMore, setGalleryHasMore] = React.useState(false);
  const GALLERY_PAGE_SIZE = 40;

  const [multiSelectMode, setMultiSelectMode] = React.useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = React.useState<string[]>([]);

  // ── Álbuns da galeria (pastas) ──
  const [albums, setAlbums] = React.useState<PhotoLibraryAlbum[]>([]);
  const [albumsLoading, setAlbumsLoading] = React.useState(false);
  const [selectedAlbumId, setSelectedAlbumId] = React.useState<string | null>(null);
  const albumScanOffsetRef = React.useRef(0);

  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const videoInputRef = React.useRef<HTMLInputElement>(null);
  const imageCameraRef = React.useRef<HTMLInputElement>(null);
  const videoCameraRef = React.useRef<HTMLInputElement>(null);
  const hasAutoSelectedRef = React.useRef(false);
  // True enquanto a única foto presente é a pré-seleção automática (nunca tocada
  // pelo usuário) — usado para não contar essa foto ao entrar no modo "selecionar vários"
  const autoSelectedActiveRef = React.useRef(false);
  // Monotonic token to ignore stale full-res loads when the user taps fast
  const tapRequestRef = React.useRef(0);
  // Tracks the actual pixel width of the preview frame for accurate crop export
  const cropContainerWidthRef = React.useRef<number>(
    typeof window !== "undefined" ? window.innerWidth : 375
  );

  // ── Cleanup video blob URL ──
  React.useEffect(() => {
    return () => {
      if (videoPreview && videoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(videoPreview);
      }
    };
  }, []);

  // ── Persist session ──
  React.useEffect(() => { sessionStorage.setItem("newpost_step", step); }, [step]);
  React.useEffect(() => { sessionStorage.setItem("newpost_description", description); }, [description]);
  React.useEffect(() => { sessionStorage.setItem("newpost_goal_id", selectedGoalId); }, [selectedGoalId]);
  React.useEffect(() => { sessionStorage.setItem("newpost_tagged_users", JSON.stringify(taggedUsers)); }, [taggedUsers]);
  React.useEffect(() => { sessionStorage.setItem("newpost_video_description", videoDescription); }, [videoDescription]);
  React.useEffect(() => { sessionStorage.setItem("newpost_tab", mediaType === "shot" ? "video" : "images"); }, [mediaType]);

  // ── Sync module-level draft ──
  React.useEffect(() => {
    imageDraft.files = selectedFiles;
    imageDraft.previews = previewUrls;
    imageDraft.transforms = cropTransforms;
  }, [selectedFiles, previewUrls, cropTransforms]);

  // ── Preload all preview images into the decode cache eagerly ──
  React.useEffect(() => {
    previewUrls.forEach(getCachedImage);
  }, [previewUrls]);
  React.useEffect(() => {
    videoDraft.file = selectedVideoFile;
    videoDraft.preview = videoPreview;
  }, [selectedVideoFile, videoPreview]);

  // ── Load profile ──
  React.useEffect(() => {
    if (!user || authLoading) return;
    getUserProfileDb(user.id).then(setProfile).catch(() => {});
  }, [user, authLoading]);

  // ── Load goals ──
  React.useEffect(() => {
    if (!user || authLoading) return;
    setIsLoadingGoals(true);
    getUserGoalsDb()
      .then(setUserGoals)
      .catch(() => {
        toast({
          title: t("newpost_goals_load_error"),
          description: t("newpost_goals_load_error_desc"),
          variant: "destructive",
        });
      })
      .finally(() => setIsLoadingGoals(false));
  }, [user, authLoading]);

  // ── Load gallery ──
  const loadGalleryPage = React.useCallback(async (page: number, reset = false) => {
    setGalleryLoading(true);
    try {
      // Antes de qualquer getLibrary: joga fora miniaturas em cache de fotos
      // que foram editadas depois de terem sido cacheadas (o cache do plugin é
      // indexado só pelo id do asset, que não muda ao editar).
      await purgeStaleMediaCache();

      if (!selectedAlbumId) {
        const result = await PhotoLibrary.getLibrary({
          offset: page * GALLERY_PAGE_SIZE,
          limit: GALLERY_PAGE_SIZE,
          includeImages: mediaType === "post",
          includeVideos: mediaType === "shot",
          thumbnailWidth: 300,
          thumbnailHeight: 300,
          thumbnailQuality: 0.7,
        });
        setGalleryAssets((prev) => reset ? result.assets : [...prev, ...result.assets]);
        setGalleryHasMore(result.hasMore);
        setGalleryPage(page);
        return;
      }

      // O plugin não filtra por álbum na consulta — varremos a biblioteca em
      // lotes (`includeAlbumData`) coletando os assets que pertencem a ele.
      if (reset) albumScanOffsetRef.current = 0;
      const matches: PhotoLibraryAsset[] = [];
      let scanned = 0;
      let underlyingHasMore = true;
      while (matches.length < GALLERY_PAGE_SIZE && scanned < ALBUM_SCAN_MAX_PER_CALL && underlyingHasMore) {
        const result = await PhotoLibrary.getLibrary({
          offset: albumScanOffsetRef.current,
          limit: ALBUM_SCAN_BATCH,
          includeImages: mediaType === "post",
          includeVideos: mediaType === "shot",
          includeAlbumData: true,
          thumbnailWidth: 300,
          thumbnailHeight: 300,
          thumbnailQuality: 0.7,
        });
        underlyingHasMore = result.hasMore;
        if (result.assets.length === 0) break;
        albumScanOffsetRef.current += result.assets.length;
        scanned += result.assets.length;
        matches.push(...result.assets.filter((a) => a.albumIds?.includes(selectedAlbumId)));
      }
      setGalleryAssets((prev) => (reset ? matches : [...prev, ...matches]));
      setGalleryHasMore(underlyingHasMore);
      setGalleryPage(page);
    } catch {
      // silently fail — user may have denied or be on web
    } finally {
      setGalleryLoading(false);
    }
  }, [mediaType, selectedAlbumId]);

  // ── Álbuns da galeria (carregados sob demanda ao abrir o menu) ──
  const loadAlbumsIfNeeded = React.useCallback(async () => {
    if (albums.length > 0 || albumsLoading) return;
    setAlbumsLoading(true);
    try {
      const { albums: fetched } = await PhotoLibrary.getAlbums();
      setAlbums(
        fetched
          .filter((a) => a.assetCount > 0 && !/meta/i.test(a.title))
          .sort((a, b) => b.assetCount - a.assetCount),
      );
    } catch {
      // web/permissão negada — o menu segue só com "Recentes"
    } finally {
      setAlbumsLoading(false);
    }
  }, [albums.length, albumsLoading]);

  // ── Selecionar um álbum (pasta) no menu ──
  const handleSelectAlbum = (albumId: string | null) => {
    if (albumId === selectedAlbumId) return;
    setSelectedAlbumId(albumId);
    hasAutoSelectedRef.current = false;
    setGalleryAssets([]);
  };

  React.useEffect(() => {
    if (galleryPermission === "granted" || galleryPermission === "limited") {
      loadGalleryPage(0, true);
    }
  }, [selectedAlbumId]);

  React.useEffect(() => {
    const initGallery = async () => {
      try {
        const { state } = await PhotoLibrary.checkAuthorization();
        if (state === "authorized" || state === "limited") {
          setGalleryPermission(state === "limited" ? "limited" : "granted");
          loadGalleryPage(0, true);
        } else if (state === "notDetermined") {
          const { state: newState } = await PhotoLibrary.requestAuthorization();
          if (newState === "authorized" || newState === "limited") {
            setGalleryPermission(newState === "limited" ? "limited" : "granted");
            loadGalleryPage(0, true);
          } else {
            setGalleryPermission("denied");
          }
        } else {
          setGalleryPermission("denied");
        }
      } catch {
        // running in browser/web — gallery not available
      }
    };
    initGallery();
  }, []);

  React.useEffect(() => {
    hasAutoSelectedRef.current = false;
    setMultiSelectMode(false);
    setSelectedAssetIds([]);
    setSelectedAlbumId(null);
    if (galleryPermission === "granted" || galleryPermission === "limited") {
      setGalleryAssets([]);
      loadGalleryPage(0, true);
    }
  }, [mediaType]);

  // ── Auto-select first gallery photo when gallery loads and no image is selected ──
  React.useEffect(() => {
    if (hasAutoSelectedRef.current) return;
    if (mediaType !== "post") return;
    if (galleryAssets.length === 0) return;
    if (previewUrls.length > 0) return;

    hasAutoSelectedRef.current = true;
    const firstAsset = galleryAssets.find((a) => a.type === "image");
    if (!firstAsset) return;
    autoSelectedActiveRef.current = true;

    const reqId = ++tapRequestRef.current;

    // Instant preview from the already-loaded thumbnail; full-res swaps in later.
    const hadThumb = !!firstAsset.thumbnail?.webPath;
    if (hadThumb) {
      setSelectedFiles([]);
      setPreviewUrls([firstAsset.thumbnail!.webPath]);
      setCropTransforms({});
      setCurrentPreviewIndex(0);
      setSelectedAssetIds([firstAsset.id]);
    }

    (async () => {
      try {
        const { webPath, mimeType } = await getNativeMediaUrl(firstAsset.id);
        const response = await fetch(webPath);
        const blob = await response.blob();
        const file = new File([blob], firstAsset.fileName, { type: mimeType || blob.type || "image/jpeg" });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (tapRequestRef.current !== reqId) return; // superseded by a later tap
          const dataUrl = reader.result as string;
          setSelectedFiles([file]);
          setPreviewUrls([dataUrl]);
          if (!hadThumb) { setCropTransforms({}); setCurrentPreviewIndex(0); }
          setSelectedAssetIds([firstAsset.id]);
        };
        reader.readAsDataURL(file);
      } catch {
        // silently fail — browser/web or permission issue
      }
    })();
  }, [galleryAssets, mediaType]);

  // ── Add image directly (no crop modal) ──
  const addImageFile = React.useCallback((file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setSelectedFiles((prev) => [...prev, file]);
      setPreviewUrls((prev) => {
        const next = [...prev, dataUrl];
        setCurrentPreviewIndex(next.length - 1);
        return next;
      });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleGalleryAssetTap = async (asset: PhotoLibraryAsset) => {
    // Qualquer toque do usuário na galeria torna a seleção intencional —
    // deixa de valer a pré-seleção automática do primeiro item.
    autoSelectedActiveRef.current = false;
    if (mediaType === "shot" && asset.type === "video") {
      try {
        const { webPath, mimeType } = await getNativeMediaUrl(asset.id);
        const response = await fetch(webPath);
        const blob = await response.blob();
        const file = new File([blob], asset.fileName, { type: mimeType || blob.type || "video/mp4" });
        setSelectedVideoFile(file);
        setVideoPreview(URL.createObjectURL(file));
      } catch {
        videoInputRef.current?.click();
      }
      return;
    }
    if (mediaType === "post" && asset.type === "image") {
      const isSelected = selectedAssetIds.includes(asset.id);

      if (!multiSelectMode) {
        if (isSelected) {
          // Deselect — clear everything
          setSelectedFiles([]);
          setPreviewUrls([]);
          setCropTransforms({});
          setCurrentPreviewIndex(0);
          setSelectedAssetIds([]);
        } else {
          // Replace preview with this single photo
          const reqId = ++tapRequestRef.current;

          // Instant preview from the already-loaded thumbnail — the full-res
          // data URL (needed for crop export + draft persistence) swaps in below.
          const hadThumb = !!asset.thumbnail?.webPath;
          if (hadThumb) {
            setSelectedFiles([]);
            setPreviewUrls([asset.thumbnail!.webPath]);
            setCropTransforms({});
            setCurrentPreviewIndex(0);
            setSelectedAssetIds([asset.id]);
          }

          try {
            const { webPath, mimeType } = await getNativeMediaUrl(asset.id);
            const response = await fetch(webPath);
            const blob = await response.blob();
            const file = new File([blob], asset.fileName, { type: mimeType || blob.type || "image/jpeg" });
            const reader = new FileReader();
            reader.onloadend = () => {
              if (tapRequestRef.current !== reqId) return; // superseded by a later tap
              const dataUrl = reader.result as string;
              setSelectedFiles([file]);
              setPreviewUrls([dataUrl]);
              if (!hadThumb) { setCropTransforms({}); setCurrentPreviewIndex(0); }
              setSelectedAssetIds([asset.id]);
            };
            reader.readAsDataURL(file);
          } catch {
            if (tapRequestRef.current === reqId) imageInputRef.current?.click();
          }
        }
      } else {
        if (isSelected) {
          // Toggle off — remove from carousel
          const idx = selectedAssetIds.indexOf(asset.id);
          setSelectedAssetIds((prev) => prev.filter((id) => id !== asset.id));
          setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
          setPreviewUrls((prev) => prev.filter((_, i) => i !== idx));
          setCropTransforms((prev) => {
            const next: Record<number, CropTransform> = {};
            for (const [k, v] of Object.entries(prev)) {
              const ki = Number(k);
              if (ki < idx) next[ki] = v;
              else if (ki > idx) next[ki - 1] = v;
            }
            return next;
          });
          setCurrentPreviewIndex((prev) => {
            const newLen = selectedAssetIds.length - 1;
            if (newLen <= 0) return 0;
            if (prev > idx) return prev - 1;
            if (prev >= newLen) return newLen - 1;
            return prev;
          });
        } else {
          if (selectedAssetIds.length >= MAX_POST_PHOTOS) {
            toast({
              title: t("newpost_max_photos_title"),
              description: t("newpost_max_photos_desc").replace("{n}", String(MAX_POST_PHOTOS)),
              variant: "destructive",
            });
            return;
          }
          // Toggle on — add to carousel. Show the selection badge instantly,
          // then append the full-res image once it finishes loading.
          setSelectedAssetIds((prev) => [...prev, asset.id]);
          try {
            const { webPath, mimeType } = await getNativeMediaUrl(asset.id);
            const response = await fetch(webPath);
            const blob = await response.blob();
            const file = new File([blob], asset.fileName, { type: mimeType || blob.type || "image/jpeg" });
            addImageFile(file);
          } catch {
            setSelectedAssetIds((prev) => prev.filter((id) => id !== asset.id));
            imageInputRef.current?.click();
          }
        }
      }
    }
  };

  // ── File handlers ──
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    let remainingSlots = MAX_POST_PHOTOS - previewUrls.length;
    let skippedForLimit = 0;

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        toast({
          title: t("newpost_invalid_type"),
          description: `${file.name} ${t("newpost_invalid_image")}`,
          variant: "destructive",
        });
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: t("newpost_file_too_large"),
          description: `${file.name} ${t("newpost_image_max_size")}`,
          variant: "destructive",
        });
        continue;
      }
      if (remainingSlots <= 0) {
        skippedForLimit++;
        continue;
      }
      addImageFile(file);
      remainingSlots--;
    }

    if (skippedForLimit > 0) {
      toast({
        title: t("newpost_max_photos_title"),
        description: t("newpost_max_photos_desc").replace("{n}", String(MAX_POST_PHOTOS)),
        variant: "destructive",
      });
    }
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const isVideoMime = file.type.startsWith("video/");
    const videoExtensions = /\.(mp4|mov|m4v|webm|avi|mkv|3gp|hevc)$/i;
    if (!isVideoMime && !videoExtensions.test(file.name)) {
      toast({
        title: t("newpost_invalid_type"),
        description: t("newpost_invalid_video"),
        variant: "destructive",
      });
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      toast({
        title: t("newpost_file_too_large"),
        description: t("newpost_video_max_size"),
        variant: "destructive",
      });
      return;
    }
    setSelectedVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const removePhoto = (index: number) => {
    imageDraft.files = imageDraft.files.filter((_, i) => i !== index);
    imageDraft.previews = imageDraft.previews.filter((_, i) => i !== index);
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
    setSelectedAssetIds((prev) => prev.filter((_, i) => i !== index));
    setCropTransforms((prev) => {
      const next: Record<number, CropTransform> = {};
      for (const [k, v] of Object.entries(prev)) {
        const ki = Number(k);
        if (ki < index) next[ki] = v;
        else if (ki > index) next[ki - 1] = v;
      }
      return next;
    });
    setCurrentPreviewIndex((prev) => {
      const newLen = previewUrls.length - 1;
      if (newLen === 0) return 0;
      if (prev > index) return prev - 1;
      if (prev >= newLen) return newLen - 1;
      return prev;
    });
  };

  // Move a foto de `from` para `to`, mantendo files/previews/assetIds/crops/seleção sincronizados
  const reorderPhotos = (from: number, to: number) => {
    if (from === to) return;
    setSelectedFiles((prev) => (prev.length === previewUrls.length ? arrayMove(prev, from, to) : prev));
    setPreviewUrls((prev) => arrayMove(prev, from, to));
    setSelectedAssetIds((prev) => (prev.length === previewUrls.length ? arrayMove(prev, from, to) : prev));
    setCropTransforms((prev) => {
      const arr = previewUrls.map((_, i) => prev[i]);
      const moved = arrayMove(arr, from, to);
      const next: Record<number, CropTransform> = {};
      moved.forEach((v, i) => { if (v) next[i] = v; });
      return next;
    });
    setCurrentPreviewIndex((prev) => {
      if (prev === from) return to;
      if (from < to) return prev > from && prev <= to ? prev - 1 : prev;
      return prev >= to && prev < from ? prev + 1 : prev;
    });
  };

  const PHOTO_DRAG_PITCH = 64; // largura da miniatura (56px) + gap (8px)
  const PHOTO_TAP_THRESHOLD = 6; // px — abaixo disso, pointerup vira "selecionar como principal"

  const handlePhotoDragStart = (index: number, e: React.PointerEvent<HTMLDivElement>) => {
    if (previewUrls.length < 2) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    photoDragStartXRef.current = e.clientX;
    photoDragStartIndexRef.current = index;
    setDraggingPhotoIndex(index);
    setPhotoDragOffsetX(0);
  };

  const handlePhotoDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingPhotoIndex === null) return;
    let delta = e.clientX - photoDragStartXRef.current;
    const slots = Math.round(delta / PHOTO_DRAG_PITCH);
    if (slots !== 0) {
      const newIndex = Math.min(Math.max(draggingPhotoIndex + slots, 0), previewUrls.length - 1);
      if (newIndex !== draggingPhotoIndex) {
        reorderPhotos(draggingPhotoIndex, newIndex);
        photoDragStartXRef.current += (newIndex - draggingPhotoIndex) * PHOTO_DRAG_PITCH;
        delta = e.clientX - photoDragStartXRef.current;
        setDraggingPhotoIndex(newIndex);
      }
    }
    setPhotoDragOffsetX(delta);
  };

  const handlePhotoDragEnd = () => {
    if (
      draggingPhotoIndex !== null &&
      Math.abs(photoDragOffsetX) < PHOTO_TAP_THRESHOLD &&
      draggingPhotoIndex === photoDragStartIndexRef.current
    ) {
      setCurrentPreviewIndex(draggingPhotoIndex);
    }
    setDraggingPhotoIndex(null);
    setPhotoDragOffsetX(0);
    photoDragStartIndexRef.current = null;
  };

  // ── Caption composer: emoji / hashtag / localização ──
  // Insere texto na posição do cursor da legenda ativa (post ou shot), sem
  // perder a seleção — igual ao comportamento de um teclado de emoji nativo.
  const insertIntoCaption = React.useCallback((text: string) => {
    const setValue = mediaType === "post" ? setDescription : setVideoDescription;
    const currentValue = mediaType === "post" ? description : videoDescription;
    const el = captionTextareaRef.current;
    const start = el?.selectionStart ?? currentValue.length;
    const end = el?.selectionEnd ?? currentValue.length;
    let next = currentValue.slice(0, start) + text + currentValue.slice(end);
    let cursor = start + text.length;
    if (next.length > 500) {
      next = next.slice(0, 500);
      cursor = Math.min(cursor, 500);
    }
    setValue(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(cursor, cursor);
    });
  }, [mediaType, description, videoDescription]);

  const handleSelectEmoji = (emoji: string) => insertIntoCaption(emoji);

  const handleAddHashtag = () => insertIntoCaption("#");

  const handleAddLocation = async () => {
    if (isLocating) return;
    setIsLocating(true);
    try {
      const permStatus = await Geolocation.checkPermissions();
      let granted = permStatus.location === "granted";
      if (!granted) {
        const requested = await Geolocation.requestPermissions();
        granted = requested.location === "granted";
      }
      if (!granted) {
        toast({
          title: t("newpost_location_error_title"),
          description: t("newpost_location_permission_desc"),
          variant: "destructive",
        });
        return;
      }

      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000 });
      const { latitude, longitude } = position.coords;
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=${language === "en" ? "en" : "pt"}`,
      );
      const data = await response.json();
      const city: string | undefined = data.city || data.locality || data.principalSubdivision;
      const country: string | undefined = data.countryName;
      const label = [city, country].filter(Boolean).join(", ");
      if (!label) throw new Error("empty location");

      insertIntoCaption(`📍 ${label} `);
      toast({ title: t("newpost_location_added_title"), description: label });
    } catch {
      toast({
        title: t("newpost_location_error_title"),
        description: t("newpost_location_error_desc"),
        variant: "destructive",
      });
    } finally {
      setIsLocating(false);
    }
  };

  // ── Submit handlers ──
  const handleImageSubmit = React.useCallback(async () => {
    if (!user || selectedFiles.length === 0) {
      toast({
        title: t("error"),
        description: t("newpost_no_image_selected"),
        variant: "destructive",
      });
      return;
    }
    if (!hasSupabaseConfig || !supabase) {
      toast({ title: t("error"), description: t("newpost_supabase_error"), variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const uploadedPaths: string[] = [];
    const containerWidth = cropContainerWidthRef.current;
    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const transform = cropTransforms[i] || DEFAULT_TRANSFORM;
        const croppedBlob = await applyTransformToBlob(previewUrls[i], transform, containerWidth);
        const croppedFile = new File([croppedBlob], file.name, { type: "image/jpeg" });

        const timestamp = Date.now();
        const filePath = `${user.id}/${timestamp}-${i}.jpg`;
        const { error: uploadError } = await withNetworkRetry(() =>
          supabase!.storage
            .from("posts")
            .upload(filePath, croppedFile, { contentType: "image/jpeg", upsert: false }),
        );
        if (uploadError) throw new Error(`${t("newpost_upload_error_file").replace("{name}", file.name)}: ${uploadError.message}`);
        uploadedPaths.push(filePath);
        const { data: urlData } = supabase.storage.from("posts").getPublicUrl(filePath);
        uploadedUrls.push(urlData.publicUrl);
      }
      await withNetworkRetry(() =>
        createPostDb(uploadedUrls, description, selectedGoalId || null, null, taggedUsers.map((u) => u.id)),
      );
      if (selectedGoalId) {
        try { await incrementGoalProgressDb(selectedGoalId); } catch {}
      }
      toast({ title: t("newpost_success"), description: t("newpost_post_published") });
      imageDraft.files = [];
      imageDraft.previews = [];
      imageDraft.transforms = {};
      setSelectedFiles([]);
      setPreviewUrls([]);
      setCropTransforms({});
      setCurrentPreviewIndex(0);
      setDescription("");
      setSelectedGoalId("");
      setTaggedUsers([]);
      setStep("select");
      sessionStorage.removeItem("newpost_description");
      sessionStorage.removeItem("newpost_goal_id");
      sessionStorage.removeItem("newpost_tagged_users");
      sessionStorage.removeItem("newpost_step");
      navigate("/", { state: { refreshFeed: true } });
    } catch (err: any) {
      if (uploadedPaths.length > 0) supabase!.storage.from("posts").remove(uploadedPaths).catch(() => {});
      toast({ title: t("newpost_post_error"), description: err?.message || t("newpost_try_later"), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }, [user, selectedFiles, previewUrls, cropTransforms, description, selectedGoalId, taggedUsers, navigate, t]);

  const handleVideoSubmit = React.useCallback(async () => {
    if (!user || !selectedVideoFile) {
      toast({ title: t("error"), description: t("newpost_no_video"), variant: "destructive" });
      return;
    }
    if (!hasSupabaseConfig || !supabase) {
      toast({ title: t("error"), description: t("newpost_supabase_error"), variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const timestamp = Date.now();
      const nameExtension = (selectedVideoFile.name.split(".").pop() || "mp4").toLowerCase();
      const contentTypeMap: Record<string, string> = {
        mov: "video/quicktime", mp4: "video/mp4", m4v: "video/x-m4v",
        webm: "video/webm", avi: "video/x-msvideo", mkv: "video/x-matroska", "3gp": "video/3gpp",
      };
      const contentType = selectedVideoFile.type || contentTypeMap[nameExtension] || "video/mp4";
      // Vídeo aparado no app Fotos é reexportado (pode virar mp4 mesmo vindo de
      // um .MOV) — a extensão salva segue o tipo real, não o nome do original.
      const extensionByType: Record<string, string> = {
        "video/quicktime": "mov", "video/mp4": "mp4", "video/x-m4v": "m4v",
      };
      const extension = extensionByType[contentType] || nameExtension;
      const filePath = `${user.id}/shots/${timestamp}.${extension}`;
      const { error: uploadError } = await withNetworkRetry(() =>
        supabase!.storage
          .from("posts")
          .upload(filePath, selectedVideoFile, { contentType, upsert: false }),
      );
      if (uploadError) throw new Error(`${t("newpost_upload_error_video")}: ${uploadError.message}`);
      const { data: urlData } = supabase.storage.from("posts").getPublicUrl(filePath);
      await withNetworkRetry(() => createShotDb(urlData.publicUrl, videoDescription, null));
      toast({ title: t("newpost_success"), description: t("newpost_shot_published") });
      videoDraft.file = null;
      if (videoDraft.preview?.startsWith("blob:")) URL.revokeObjectURL(videoDraft.preview);
      videoDraft.preview = null;
      setSelectedVideoFile(null);
      setVideoPreview(null);
      setVideoDescription("");
      setStep("select");
      sessionStorage.removeItem("newpost_video_description");
      sessionStorage.removeItem("newpost_step");
      navigate("/shots");
    } catch (err: any) {
      toast({ title: t("newpost_shot_error"), description: err?.message || t("newpost_try_later"), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }, [user, selectedVideoFile, videoDescription, navigate, t]);

  const canAdvance = mediaType === "post" ? previewUrls.length > 0 : !!videoPreview;

  // Always fullscreen on /postar — both steps hide the AppLayout header+nav.
  React.useLayoutEffect(() => {
    document.body.dataset.fullscreenStep = "true";
    return () => { delete document.body.dataset.fullscreenStep; };
  }, []);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">{t("newpost_loading")}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-full max-w-md space-y-4">
          <p className="text-sm text-muted-foreground">{t("newpost_login_required")}</p>
          <Button onClick={() => navigate("/login")} className="w-full">
            {t("newpost_go_login")}
          </Button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────
  //  STEP 1 — Gallery picker (glass design)
  // ─────────────────────────────────────────
  if (step === "select") {
    // Atalhos rápidos do menu de álbuns (padrão Instagram) — o resto entra em "Todos os álbuns"
    const favoritesAlbum = albums.find((a) => /favorit/i.test(a.title));
    const otherAlbums = albums.filter((a) => a.id !== favoritesAlbum?.id);
    const currentAlbumTitle = !selectedAlbumId
      ? t("newpost_recents")
      : albums.find((a) => a.id === selectedAlbumId)?.title ?? t("newpost_recents");

    const renderGrid = () => (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 2 }}>
        {/* Camera cell */}
        <button
          onClick={() => (mediaType === "post" ? imageCameraRef : videoCameraRef).current?.click()}
          style={{ aspectRatio: "1/1", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,.06)", color: "#fff" }}
        >
          {mediaType === "post"
            ? <Camera className="h-6 w-6" style={{ opacity: 0.7 }} />
            : <Video className="h-6 w-6" style={{ opacity: 0.7 }} />}
        </button>

        {galleryPermission === "denied" && galleryAssets.length === 0 && (
          <div style={{ gridColumn: "span 3", aspectRatio: "1/1", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 12px" }}>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,.4)", textAlign: "center" }}>{t("newpost_gallery_permission_denied")}</p>
          </div>
        )}

        {galleryAssets.map((asset) => {
          const selectedIdx = selectedAssetIds.indexOf(asset.id);
          const isSelected = mediaType === "post" ? selectedIdx !== -1 : selectedVideoFile?.name === asset.fileName;
          const atPhotoLimit =
            mediaType === "post" && multiSelectMode && !isSelected && selectedAssetIds.length >= MAX_POST_PHOTOS;
          const thumbSrc = asset.thumbnail?.webPath;
          return (
            <button
              key={asset.id}
              onClick={() => handleGalleryAssetTap(asset)}
              style={{
                position: "relative", aspectRatio: "1/1", overflow: "hidden",
                outline: isSelected ? "2.5px solid #9d6bff" : "none",
                outlineOffset: -2.5,
                opacity: atPhotoLimit ? 0.35 : 1,
              }}
            >
              {thumbSrc ? (
                <img src={thumbSrc} alt={asset.fileName} className="w-full h-full object-cover" />
              ) : (
                <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {mediaType === "post"
                    ? <Camera className="h-4 w-4" style={{ color: "rgba(255,255,255,.3)" }} />
                    : <Video className="h-4 w-4" style={{ color: "rgba(255,255,255,.3)" }} />}
                </div>
              )}
              {isSelected && mediaType === "post" && (
                <div style={{ position: "absolute", bottom: 4, left: 4, background: "#9d6bff", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 700 }}>
                  {selectedIdx + 1}
                </div>
              )}
              {asset.type === "video" && asset.duration && (
                <div style={{ position: "absolute", bottom: 4, right: 4, background: "rgba(0,0,0,.6)", color: "#fff", fontSize: 9, padding: "1px 4px", borderRadius: 4 }}>
                  {Math.floor(asset.duration / 60)}:{String(Math.round(asset.duration % 60)).padStart(2, "0")}
                </div>
              )}
            </button>
          );
        })}

        {galleryLoading && galleryAssets.length === 0 &&
          Array.from({ length: 11 }).map((_, i) => (
            <div key={`ph-${i}`} style={{ aspectRatio: "1/1", background: "rgba(255,255,255,.05)", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))
        }
      </div>
    );

    return (
      <div
        className="relative flex flex-col overflow-hidden"
        style={{ height: "100dvh", background: "#06070c" }}
      >
        {/* Aura blob */}
        <div className="absolute rounded-full pointer-events-none" style={{
          width: 300, height: 300, right: -60, top: 120,
          background: "radial-gradient(circle,#7b3ff2,transparent 70%)",
          filter: "blur(70px)", opacity: 0.4,
        }} />

        {/* ── Header ── */}
        <div
          className="relative z-10 flex items-center justify-between px-[18px] flex-shrink-0"
          style={{ paddingTop: "max(54px, env(safe-area-inset-top))", paddingBottom: 14 }}
        >
          <button
            onClick={() => navigate(-1)}
            style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}
          >
            <X className="h-6 w-6" />
          </button>
          <span style={{ fontSize: 16, fontWeight: 680, color: "#fff" }}>{t("newpost_title_simple")}</span>
          <button
            onClick={() => setStep("caption")}
            disabled={!canAdvance}
            style={{ fontSize: 15, fontWeight: 640, color: canAdvance ? "#6ea8ff" : "rgba(255,255,255,.3)", cursor: canAdvance ? "pointer" : "default", minHeight: 44, display: "flex", alignItems: "center" }}
          >
            {t("newpost_advance")}
          </button>
        </div>

        {/* ── Content area (preview + gallery) ── */}
        <div className="relative flex flex-col flex-1 overflow-hidden">

          {/* Preview area */}
          <div
            className="flex-shrink-0"
            style={{ margin: "0 14px", aspectRatio: "1/1", borderRadius: 28, overflow: "hidden", position: "relative", boxShadow: "0 22px 50px -20px rgba(0,0,0,.6)", background: "#0a0b10" }}
          >
            {mediaType === "post" ? (
              previewUrls.length > 0 ? (
                <>
                  <InlineCropPreview
                    imageSrc={previewUrls[currentPreviewIndex]}
                    transform={cropTransforms[currentPreviewIndex] || DEFAULT_TRANSFORM}
                    onTransformChange={(t) =>
                      setCropTransforms((prev) => ({ ...prev, [currentPreviewIndex]: t }))
                    }
                    containerWidthRef={cropContainerWidthRef}
                  />
                  {/* Carousel nav */}
                  {previewUrls.length > 1 && (
                    <>
                      <button
                        onClick={() => setCurrentPreviewIndex((i) => (i - 1 + previewUrls.length) % previewUrls.length)}
                        style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,.5)", borderRadius: "50%", padding: 8 }}
                      >
                        <ChevronLeft className="h-5 w-5 text-white" />
                      </button>
                      <button
                        onClick={() => setCurrentPreviewIndex((i) => (i + 1) % previewUrls.length)}
                        style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,.5)", borderRadius: "50%", padding: 8 }}
                      >
                        <ChevronRight className="h-5 w-5 text-white" />
                      </button>
                      <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 4, pointerEvents: "none" }}>
                        {previewUrls.map((_, i) => (
                          <div key={i} style={{ borderRadius: 99, background: "#fff", width: i === currentPreviewIndex ? 16 : 6, height: 6, opacity: i === currentPreviewIndex ? 1 : 0.5, transition: "width .2s" }} />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <button
                  onClick={() => imageInputRef.current?.click()}
                  style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "rgba(255,255,255,.5)" }}
                >
                  <Camera className="h-12 w-12" />
                  <span style={{ fontSize: 14 }}>{t("newpost_tap_to_select")}</span>
                </button>
              )
            ) : (
              videoPreview ? (
                <video src={videoPreview} controls playsInline className="w-full h-full object-contain" />
              ) : (
                <button
                  onClick={() => videoInputRef.current?.click()}
                  style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "rgba(255,255,255,.5)" }}
                >
                  <Video className="h-12 w-12" />
                  <span style={{ fontSize: 14 }}>{t("newpost_tap_to_select_video")}</span>
                </button>
              )
            )}
          </div>

          {/* Gallery toolbar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 10px", flexShrink: 0 }}>
            <DropdownMenu onOpenChange={(open) => open && loadAlbumsIfNeeded()}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  style={{ fontSize: 14, fontWeight: 600, color: "#fff", display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, maxWidth: 180 }}
                >
                  <span className="truncate">{currentAlbumTitle}</span>
                  <ChevronDown className="h-4 w-4 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-64 border-white/10 p-1.5"
                style={{ background: "rgba(24,22,32,.94)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderRadius: 20 }}
              >
                <DropdownMenuItem
                  onClick={() => handleSelectAlbum(null)}
                  className="text-white focus:bg-white/10 focus:text-white rounded-xl"
                  style={{ minHeight: 44, gap: 10, fontSize: 14, fontWeight: 600 }}
                >
                  <Images className="h-4 w-4 opacity-70 shrink-0" />
                  {t("newpost_recents")}
                  {!selectedAlbumId && <Check className="h-4 w-4 ml-auto shrink-0" style={{ color: "#6ea8ff" }} />}
                </DropdownMenuItem>

                {favoritesAlbum && (
                  <DropdownMenuItem
                    onClick={() => handleSelectAlbum(favoritesAlbum.id)}
                    className="text-white focus:bg-white/10 focus:text-white rounded-xl"
                    style={{ minHeight: 44, gap: 10, fontSize: 14, fontWeight: 600 }}
                  >
                    <Heart className="h-4 w-4 opacity-70 shrink-0" />
                    {t("newpost_favorites_album")}
                    {selectedAlbumId === favoritesAlbum.id && <Check className="h-4 w-4 ml-auto shrink-0" style={{ color: "#6ea8ff" }} />}
                  </DropdownMenuItem>
                )}

                {albumsLoading && (
                  <div style={{ padding: "10px 12px", fontSize: 12, color: "rgba(255,255,255,.4)" }}>
                    {t("newpost_loading_albums")}
                  </div>
                )}

                {otherAlbums.length > 0 && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger
                      className="text-white focus:bg-white/10 focus:text-white data-[state=open]:bg-white/10 rounded-xl"
                      style={{ minHeight: 44, gap: 10, fontSize: 14, fontWeight: 600 }}
                    >
                      <FolderOpen className="h-4 w-4 opacity-70 mr-2 shrink-0" />
                      {t("newpost_all_albums")}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent
                        className="w-64 border-white/10 p-1.5 max-h-[50vh] overflow-y-auto"
                        style={{ background: "rgba(24,22,32,.96)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderRadius: 20 }}
                      >
                        {otherAlbums.map((album) => {
                          const AlbumIcon = albumMenuIcon(album.title);
                          return (
                            <DropdownMenuItem
                              key={album.id}
                              onClick={() => handleSelectAlbum(album.id)}
                              className="text-white focus:bg-white/10 focus:text-white rounded-xl"
                              style={{ minHeight: 44, gap: 10, fontSize: 14, fontWeight: 600 }}
                            >
                              <AlbumIcon className="h-4 w-4 opacity-70 shrink-0" />
                              <span className="truncate">{album.title}</span>
                              {selectedAlbumId === album.id && <Check className="h-4 w-4 ml-auto shrink-0" style={{ color: "#6ea8ff" }} />}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {mediaType === "post" && (
              <button
                onClick={() => {
                  const next = !multiSelectMode;
                  setMultiSelectMode(next);
                  if (next && autoSelectedActiveRef.current) {
                    // A única foto presente é a pré-seleção automática (o usuário
                    // nunca tocou nela) — não deve contar para o modo múltiplo.
                    autoSelectedActiveRef.current = false;
                    setSelectedFiles([]);
                    setPreviewUrls([]);
                    setCropTransforms({});
                    setSelectedAssetIds([]);
                    setCurrentPreviewIndex(0);
                  } else if (!next && selectedFiles.length > 1) {
                    const keepIdx = currentPreviewIndex;
                    setSelectedFiles([selectedFiles[keepIdx]]);
                    setPreviewUrls([previewUrls[keepIdx]]);
                    setCropTransforms({ 0: cropTransforms[keepIdx] || DEFAULT_TRANSFORM });
                    setSelectedAssetIds([selectedAssetIds[keepIdx]].filter(Boolean));
                    setCurrentPreviewIndex(0);
                  }
                }}
                aria-pressed={multiSelectMode}
                aria-label={t("newpost_select_btn")}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 999, minHeight: 36,
                  fontSize: 13, fontWeight: 650,
                  color: multiSelectMode ? "#fff" : "rgba(255,255,255,.7)",
                  background: multiSelectMode
                    ? "linear-gradient(135deg,#5b8cff,#9d6bff)"
                    : "rgba(255,255,255,.06)",
                  border: multiSelectMode ? "1px solid rgba(157,107,255,.5)" : "1px solid rgba(255,255,255,.14)",
                  boxShadow: multiSelectMode
                    ? "inset 0 1px 0 rgba(255,255,255,.3), 0 6px 16px -6px rgba(123,99,242,.55)"
                    : "none",
                  transition: "background .18s ease, box-shadow .18s ease, color .18s ease",
                }}
              >
                <span style={{
                  width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: multiSelectMode ? "#fff" : "transparent",
                  border: multiSelectMode ? "none" : "1.5px solid rgba(255,255,255,.45)",
                  transition: "background .18s ease, border-color .18s ease",
                }}>
                  {multiSelectMode && <Check width={10} height={10} strokeWidth={3.5} style={{ color: "#7b3ff2" }} />}
                </span>
                {multiSelectMode
                  ? `${t("newpost_select_btn")} · ${previewUrls.length}/${MAX_POST_PHOTOS}`
                  : t("newpost_select_btn")}
              </button>
            )}
          </div>

          {/* Gallery grid — scrollable */}
          <div className="flex-1 overflow-y-auto" style={{ padding: "0 2px 160px", scrollbarWidth: "none" }}>
            {renderGrid()}
            {galleryHasMore && !galleryLoading && (
              <button
                onClick={() => loadGalleryPage(galleryPage + 1)}
                style={{ width: "100%", padding: "12px 0", fontSize: 12, color: "rgba(255,255,255,.4)", textAlign: "center" }}
              >
                {t("newpost_load_more_photos")}
              </button>
            )}
            {galleryLoading && galleryAssets.length > 0 && (
              <div style={{ display: "flex", justifyContent: "center", padding: 12 }}>
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: "rgba(255,255,255,.4)" }} />
              </div>
            )}
          </div>

          {/* ── Floating media type selector ── */}
          <div style={{
            position: "absolute",
            bottom: `max(36px, calc(env(safe-area-inset-bottom) + 16px))`,
            left: "50%", transform: "translateX(-50%)",
            display: "flex", gap: 6, padding: 5, borderRadius: 24,
            background: "linear-gradient(rgba(255,255,255,.12),rgba(255,255,255,.05))",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            border: "1px solid rgba(255,255,255,.16)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.28), 0 16px 36px -12px rgba(0,0,0,.6)",
            zIndex: 20, whiteSpace: "nowrap",
          }}>
            <button
              onClick={() => setMediaType("post")}
              style={{
                padding: "10px 26px", borderRadius: 19, fontSize: 14, fontWeight: 680,
                color: mediaType === "post" ? "#0a0b12" : "#fff",
                background: mediaType === "post" ? "#fff" : "transparent",
                transition: "all .2s",
              }}
            >
              POST
            </button>
            <button
              onClick={() => setMediaType("shot")}
              style={{
                padding: "10px 26px", borderRadius: 19, fontSize: 14, fontWeight: 680,
                color: mediaType === "shot" ? "#0a0b12" : "#fff",
                background: mediaType === "shot" ? "#fff" : "transparent",
                transition: "all .2s",
              }}
            >
              SHOT
            </button>
          </div>
        </div>

        {/* Hidden file inputs */}
        <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
        <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoFileChange} className="hidden" />
        <input ref={imageCameraRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
        <input ref={videoCameraRef} type="file" accept="video/*" capture="environment" onChange={handleVideoFileChange} className="hidden" />
      </div>
    );
  }

  // ─────────────────────────────────────────
  //  STEP 2 — Caption & publish (glass design)
  // ─────────────────────────────────────────

  const activeText = mediaType === "post" ? description : videoDescription;
  const isDisabled = isSubmitting || (mediaType === "post" ? selectedFiles.length === 0 : !selectedVideoFile);

  const goalEmoji = (typeGoal: number) => {
    if (typeGoal === 2) return "❤️";
    if (typeGoal === 3) return "🏆";
    return "🎯";
  };

  return (
    <div
      className="flex flex-col relative overflow-hidden"
      style={{ minHeight: "100dvh", background: "#06070c" }}
    >
      {/* ── Aura blobs ── */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 300, height: 300, right: -70, top: 90,
          background: "radial-gradient(circle,#7b3ff2,transparent 70%)",
          filter: "blur(70px)", opacity: 0.36,
        }}
      />
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 260, height: 260, left: -60, top: 420,
          background: "radial-gradient(circle,#3f7fe6,transparent 70%)",
          filter: "blur(70px)", opacity: 0.32,
        }}
      />

      {/* ── Header ── */}
      <div
        className="relative z-10 flex items-center justify-between px-[18px]"
        style={{ paddingTop: "max(54px, env(safe-area-inset-top))", paddingBottom: 14 }}
      >
        <button
          onClick={() => setStep("select")}
          style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <span style={{ fontSize: 16, fontWeight: 680, color: "#fff" }}>{t("newpost_new_post_header")}</span>
        <span style={{ width: 36, flexShrink: 0 }} />
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto relative z-10 px-4" style={{ paddingBottom: "calc(110px + var(--keyboard-height, 0px))" }}>

        {/* Author row */}
        <div style={{ display: "flex", gap: 13, marginBottom: 16, alignItems: "center" }}>
          <UserAvatar photo={profile?.photo} nickname={profile?.nickname} size="md" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 660, color: "#fff", lineHeight: 1.2 }}>
              {profile?.nickname || user.email?.split("@")[0]}
            </div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.5)", marginTop: 1 }}>
              {t("newpost_visibility_label")}
            </div>
          </div>
          {mediaType === "post" && previewUrls.length > 0 && (
            <button
              onClick={() => setImagePreviewOpen(true)}
              aria-label={t("newpost_view_image")}
              style={{ width: 64, height: 64, borderRadius: 16, overflow: "hidden", flexShrink: 0, boxShadow: "0 8px 20px -8px rgba(0,0,0,.6)", padding: 0, border: "none", cursor: "pointer" }}
            >
              <CroppedThumb
                imageSrc={previewUrls[currentPreviewIndex]}
                transform={cropTransforms[currentPreviewIndex] || DEFAULT_TRANSFORM}
                referenceWidth={cropContainerWidthRef.current}
                style={{ width: "100%", height: "100%" }}
              />
            </button>
          )}
          {mediaType === "shot" && videoPreview && (
            <div style={{ width: 64, height: 64, borderRadius: 16, overflow: "hidden", flexShrink: 0, boxShadow: "0 8px 20px -8px rgba(0,0,0,.6)" }}>
              <video src={videoPreview} playsInline muted className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        {/* Caption glass card */}
        <div style={{
          borderRadius: 24, padding: 16, minHeight: 150,
          background: "linear-gradient(rgba(255,255,255,.06),rgba(255,255,255,.025))",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,.1)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.14)",
        }}>
          <Textarea
            ref={captionTextareaRef}
            placeholder={mediaType === "post" ? t("newpost_caption_placeholder") : t("newpost_caption_video_placeholder")}
            value={activeText}
            onChange={(e) =>
              mediaType === "post" ? setDescription(e.target.value) : setVideoDescription(e.target.value)
            }
            maxLength={500}
            className="resize-none border-0 shadow-none focus-visible:ring-0 p-0 bg-transparent w-full text-white placeholder:text-white/40"
            style={{ fontSize: 15, lineHeight: 1.5, minHeight: 118 }}
            rows={5}
          />
        </div>

        {/* Icon bar + char counter */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 6px 0" }}>
          <div style={{ display: "flex", gap: 14, color: "rgba(255,255,255,.55)" }}>
            <button
              onClick={() => setEmojiPickerOpen(true)}
              aria-label={t("newpost_add_emoji")}
              style={{ display: "flex", alignItems: "center", minHeight: 32 }}
            >
              <Smile width={17} height={17} />
            </button>
            <button
              onClick={handleAddLocation}
              disabled={isLocating}
              aria-label={t("newpost_add_location")}
              style={{ display: "flex", alignItems: "center", minHeight: 32, opacity: isLocating ? 0.6 : 1 }}
            >
              {isLocating ? (
                <Loader2 width={17} height={17} className="animate-spin" />
              ) : (
                <MapPin width={17} height={17} />
              )}
            </button>
            <button
              onClick={handleAddHashtag}
              aria-label={t("newpost_add_hashtag")}
              style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1, minHeight: 32, display: "flex", alignItems: "center" }}
            >
              #
            </button>
          </div>
          <span style={{ fontSize: 12, color: activeText.length > 450 ? "#fb923c" : "rgba(255,255,255,.4)" }}>
            {activeText.length}/500
          </span>
        </div>

        {/* Multiple photos strip — arraste para reordenar */}
        {mediaType === "post" && previewUrls.length > 1 && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginTop: 14, scrollbarWidth: "none" }}>
            {previewUrls.map((url, i) => (
              <div
                key={url}
                onPointerDown={(e) => handlePhotoDragStart(i, e)}
                onPointerMove={handlePhotoDragMove}
                onPointerUp={handlePhotoDragEnd}
                onPointerCancel={handlePhotoDragEnd}
                style={{
                  position: "relative", flexShrink: 0, touchAction: "none", cursor: "grab",
                  transform: draggingPhotoIndex === i ? `translateX(${photoDragOffsetX}px) scale(1.06)` : "none",
                  zIndex: draggingPhotoIndex === i ? 2 : 1,
                  transition: draggingPhotoIndex === i ? "none" : "transform .18s ease",
                }}
              >
                <CroppedThumb
                  imageSrc={url}
                  transform={cropTransforms[i] || DEFAULT_TRANSFORM}
                  referenceWidth={cropContainerWidthRef.current}
                  alt={t("newpost_photo_alt").replace("{n}", String(i + 1))}
                  style={{
                    width: 56, height: 56, borderRadius: 12, pointerEvents: "none",
                    outline: i === currentPreviewIndex ? "2px solid #6ea8ff" : "none",
                    outlineOffset: 1,
                    boxShadow: draggingPhotoIndex === i ? "0 10px 24px -8px rgba(0,0,0,.7)" : "none",
                  }}
                />
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => removePhoto(i)}
                  style={{ position: "absolute", top: -4, right: -4, background: "rgba(0,0,0,.7)", borderRadius: "50%", padding: 2 }}
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Goals section (post only) */}
        {mediaType === "post" && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", color: "rgba(255,255,255,.45)", margin: "22px 4px 10px" }}>
              {t("newpost_goal_link_section")}
            </div>
            {isLoadingGoals ? (
              <p style={{ fontSize: 14, color: "rgba(255,255,255,.5)" }}>{t("newpost_goals_loading")}</p>
            ) : userGoals.filter((g) => g.perc < 100).length > 0 ? (
              <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, margin: "0 -2px", scrollbarWidth: "none" }}>
                {userGoals.filter((g) => g.perc < 100).map((goal) => {
                  const isSelected = selectedGoalId === goal.id;
                  return (
                    <button
                      key={goal.id}
                      onClick={() => setSelectedGoalId(isSelected ? "" : goal.id)}
                      style={{
                        flexShrink: 0, display: "flex", alignItems: "center", gap: 10,
                        padding: "12px 16px 12px 12px", borderRadius: 18,
                        background: isSelected
                          ? "linear-gradient(rgba(91,140,255,.16),rgba(157,107,255,.08))"
                          : "rgba(255,255,255,.05)",
                        border: isSelected
                          ? "1px solid rgba(123,99,242,.4)"
                          : "1px solid rgba(255,255,255,.1)",
                        boxShadow: isSelected ? "inset 0 1px 0 rgba(255,255,255,.14)" : "none",
                      }}
                    >
                      <span style={{
                        width: 36, height: 36, borderRadius: 11, fontSize: 17,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: isSelected
                          ? "linear-gradient(135deg,#5b8cff,#9d6bff)"
                          : "rgba(255,255,255,.08)",
                        flexShrink: 0,
                      }}>
                        {goalEmoji(goal.type_goal)}
                      </span>
                      <div style={{ lineHeight: 1.2, textAlign: "left" }}>
                        <div style={{ fontSize: 13, fontWeight: 660, color: "#fff", whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {goal.description}
                        </div>
                        <div style={{ fontSize: 10.5, color: isSelected ? "rgba(255,255,255,.6)" : "rgba(255,255,255,.5)", marginTop: 2 }}>
                          {goal.perc}%{isSelected ? ` · ${t("newpost_goal_link_action")}` : ""}
                        </div>
                      </div>
                      {isSelected && (
                        <span style={{
                          width: 20, height: 20, borderRadius: "50%", background: "#6ea8ff",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#fff", marginLeft: 4, flexShrink: 0,
                        }}>
                          <Check width={12} height={12} strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  );
                })}
                {/* Nova meta shortcut */}
                <button
                  onClick={() => navigate("/metas?tab=metas&action=create-goal")}
                  style={{
                    flexShrink: 0, display: "flex", alignItems: "center", gap: 8,
                    padding: "12px 18px", borderRadius: 18,
                    border: "1px dashed rgba(255,255,255,.2)",
                    color: "rgba(255,255,255,.6)", fontSize: 13, fontWeight: 600,
                  }}
                >
                  <Plus width={15} height={15} strokeWidth={2.2} />
                  {t("newpost_new_goal_shortcut")}
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate("/metas?tab=metas&action=create-goal")}
                style={{ fontSize: 14, color: "rgba(255,255,255,.5)" }}
              >
                {t("newpost_no_goals")}{" "}
                <span style={{ color: "#6ea8ff", fontWeight: 600 }}>{t("newpost_create_goal")}</span>
              </button>
            )}
            {selectedGoalId && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#6ee7b7", marginTop: 10 }}>
                <Sparkles className="h-3 w-3" />
                {t("newpost_goal_progress_hint")}
              </div>
            )}

            {/* Marcar pessoas (estilo Instagram) */}
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", color: "rgba(255,255,255,.45)", margin: "22px 4px 10px" }}>
              {t("newpost_tag_people_section")}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              {taggedUsers.map((u) => (
                <span
                  key={u.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 10px 6px 6px", borderRadius: 18,
                    background: "linear-gradient(rgba(91,140,255,.16),rgba(157,107,255,.08))",
                    border: "1px solid rgba(123,99,242,.4)",
                  }}
                >
                  <UserAvatar photo={u.photo} nickname={u.nickname} size="sm" />
                  <span style={{ fontSize: 13, fontWeight: 620, color: "#fff", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.nickname}
                  </span>
                  <button
                    onClick={() => setTaggedUsers((prev) => prev.filter((s) => s.id !== u.id))}
                    aria-label={t("tag_people_remove").replace("{name}", u.nickname)}
                    style={{ display: "flex", alignItems: "center", color: "rgba(255,255,255,.6)" }}
                  >
                    <X width={14} height={14} />
                  </button>
                </span>
              ))}
              <button
                onClick={() => setTagPeopleOpen(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "12px 18px", borderRadius: 18,
                  border: "1px dashed rgba(255,255,255,.2)",
                  color: "rgba(255,255,255,.6)", fontSize: 13, fontWeight: 600,
                }}
              >
                <UserRoundPlus width={15} height={15} strokeWidth={2.2} />
                {t("newpost_tag_people_add")}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Image preview modal ── */}
      {imagePreviewOpen && previewUrls.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          style={{
            paddingTop: "max(1rem, env(safe-area-inset-top))",
            paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
            paddingLeft: "max(1rem, env(safe-area-inset-left))",
            paddingRight: "max(1rem, env(safe-area-inset-right))",
          }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 pointer-events-auto"
            style={{ background: "rgba(0,0,0,.88)" }}
            onClick={() => setImagePreviewOpen(false)}
          />
          {/* Image */}
          <div className="relative pointer-events-auto w-full max-w-full" style={{ maxHeight: "calc(100dvh - 4rem)" }}>
            <img
              src={previewUrls[currentPreviewIndex]}
              alt={t("newpost_photo_alt").replace("{n}", String(currentPreviewIndex + 1))}
              style={{ width: "100%", maxHeight: "calc(100dvh - 4rem)", objectFit: "contain", borderRadius: 16 }}
            />
            {/* Carousel nav (só quando há mais de uma foto) */}
            {previewUrls.length > 1 && (
              <>
                <button
                  onClick={() => setCurrentPreviewIndex((i) => (i - 1 + previewUrls.length) % previewUrls.length)}
                  aria-label={t("newpost_prev_photo")}
                  style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,.5)", borderRadius: "50%", padding: 8 }}
                >
                  <ChevronLeft className="h-5 w-5 text-white" />
                </button>
                <button
                  onClick={() => setCurrentPreviewIndex((i) => (i + 1) % previewUrls.length)}
                  aria-label={t("newpost_next_photo")}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,.5)", borderRadius: "50%", padding: 8 }}
                >
                  <ChevronRight className="h-5 w-5 text-white" />
                </button>
                <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 4, pointerEvents: "none" }}>
                  {previewUrls.map((_, i) => (
                    <div key={i} style={{ borderRadius: 99, background: "#fff", width: i === currentPreviewIndex ? 16 : 6, height: 6, opacity: i === currentPreviewIndex ? 1 : 0.5, transition: "width .2s" }} />
                  ))}
                </div>
              </>
            )}
            {/* Close button */}
            <button
              onClick={() => setImagePreviewOpen(false)}
              aria-label={t("newpost_close_image_preview")}
              style={{
                position: "absolute", top: -12, right: -12,
                width: 36, height: 36, borderRadius: "50%",
                background: "rgba(0,0,0,.7)", border: "1px solid rgba(255,255,255,.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", cursor: "pointer",
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Publish bar ── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-10"
        style={{
          padding: `14px 16px max(30px, env(safe-area-inset-bottom))`,
          background: "linear-gradient(transparent,rgba(6,7,12,.92) 30%)",
        }}
      >
        <button
          onClick={mediaType === "post" ? handleImageSubmit : handleVideoSubmit}
          disabled={isDisabled}
          style={{
            width: "100%", height: 54, borderRadius: 27,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
            fontSize: 16, fontWeight: 700, color: "#fff",
            background: "linear-gradient(135deg,#5b8cff,#9d6bff)",
            boxShadow: "0 12px 30px -8px rgba(123,63,242,.6),inset 0 1px 0 rgba(255,255,255,.35)",
            opacity: isDisabled ? 0.45 : 1,
            cursor: isDisabled ? "not-allowed" : "pointer",
            transition: "opacity .2s",
            border: "none",
          }}
        >
          {isSubmitting ? (
            <><Loader2 className="h-5 w-5 animate-spin" />{t("newpost_publishing")}</>
          ) : mediaType === "post" ? (
            <><Send className="h-5 w-5" />{t("newpost_publish")}</>
          ) : (
            <><Clapperboard className="h-5 w-5" />{t("newpost_publish_shot")}</>
          )}
        </button>
      </div>

      <EmojiPickerDrawer
        open={emojiPickerOpen}
        onOpenChange={setEmojiPickerOpen}
        onSelect={handleSelectEmoji}
      />

      <TagPeopleDrawer
        open={tagPeopleOpen}
        onOpenChange={setTagPeopleOpen}
        selected={taggedUsers}
        onChange={setTaggedUsers}
      />
    </div>
  );
}
