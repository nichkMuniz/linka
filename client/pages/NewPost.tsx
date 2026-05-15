import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { withNetworkRetry } from "@/lib/network-status";
import {
  getUserGoalsDb,
  createPostDb,
  createShotDb,
  type UserGoal,
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
} from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { PhotoLibrary, type PhotoLibraryAsset } from "@capgo/capacitor-photo-library";

// ─── Crop types & helpers ───────────────────────────────────────────────────

interface CropTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;

function clampVal(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi);
}

function clampedOffset(
  imgEl: HTMLImageElement,
  containerW: number,
  scale: number,
  ox: number,
  oy: number
): { offsetX: number; offsetY: number } {
  const imgAspect = imgEl.naturalWidth / imgEl.naturalHeight;
  let baseW: number, baseH: number;
  if (imgAspect > 1) { baseH = containerW; baseW = containerW * imgAspect; }
  else { baseW = containerW; baseH = containerW / imgAspect; }
  const dW = baseW * scale;
  const dH = baseH * scale;
  const maxX = Math.max(0, (dW - containerW) / 2);
  const maxY = Math.max(0, (dH - containerW) / 2);
  return { offsetX: clampVal(ox, -maxX, maxX), offsetY: clampVal(oy, -maxY, maxY) };
}

function applyTransformToBlob(
  dataUrl: string,
  transform: CropTransform,
  containerWidth: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const frameW = containerWidth;
      const frameH = containerWidth;
      const imgAspect = img.naturalWidth / img.naturalHeight;
      let baseW: number, baseH: number;
      if (imgAspect > 1) { baseH = frameH; baseW = frameH * imgAspect; }
      else { baseW = frameW; baseH = frameW / imgAspect; }
      const { scale, offsetX, offsetY } = transform;
      const cssPerNatX = (baseW * scale) / img.naturalWidth;
      const cssPerNatY = (baseH * scale) / img.naturalHeight;
      const cropOriginX = ((baseW * scale - frameW) / 2 - offsetX) / cssPerNatX;
      const cropOriginY = ((baseH * scale - frameH) / 2 - offsetY) / cssPerNatY;
      const cropNatW = frameW / cssPerNatX;
      const cropNatH = frameH / cssPerNatY;
      const MAX_EXPORT = 2160;
      const exportW = Math.round(Math.min(cropNatW, MAX_EXPORT));
      const exportH = Math.round(Math.min(cropNatH, MAX_EXPORT));
      const canvas = document.createElement("canvas");
      canvas.width = exportW;
      canvas.height = exportH;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("no ctx")); return; }
      ctx.drawImage(img, cropOriginX, cropOriginY, cropNatW, cropNatH, 0, 0, exportW, exportH);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        0.92
      );
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// ─── Module-level image decode cache ────────────────────────────────────────

const decodedImageCache: Record<string, HTMLImageElement> = {};

function getCachedImage(src: string): HTMLImageElement {
  if (!decodedImageCache[src]) {
    const img = new Image();
    img.src = src;
    decodedImageCache[src] = img;
  }
  return decodedImageCache[src];
}

// ─── Inline crop preview ────────────────────────────────────────────────────

function InlineCropPreview({
  imageSrc,
  transform,
  onTransformChange,
  containerWidthRef,
}: {
  imageSrc: string;
  transform: CropTransform;
  onTransformChange: (t: CropTransform) => void;
  containerWidthRef: React.MutableRefObject<number>;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [containerW, setContainerW] = React.useState(0);
  const gestureRef = React.useRef<{
    type: "none" | "drag" | "pinch";
    lastX: number; lastY: number; lastDist: number; lastScale: number;
  }>({ type: "none", lastX: 0, lastY: 0, lastDist: 0, lastScale: 1 });

  // Store latest transform in a ref so gesture handlers don't go stale
  const transformRef = React.useRef(transform);
  React.useEffect(() => { transformRef.current = transform; }, [transform]);

  React.useEffect(() => {
    const cached = getCachedImage(imageSrc);
    if (cached.complete && cached.naturalWidth > 0) {
      // Already decoded — draw immediately, no flash
      imgRef.current = cached;
      setImageLoaded(true);
      return;
    }
    setImageLoaded(false);
    const onLoad = () => { imgRef.current = cached; setImageLoaded(true); };
    cached.addEventListener("load", onLoad, { once: true });
    return () => cached.removeEventListener("load", onLoad);
  }, [imageSrc]);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      setContainerW(w);
      containerWidthRef.current = w;
    });
    ro.observe(el);
    const w = el.clientWidth;
    setContainerW(w);
    containerWidthRef.current = w;
    return () => ro.disconnect();
  }, []);

  // Draw canvas — useLayoutEffect to run synchronously after DOM update, avoiding flicker
  React.useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || containerW === 0) return;
    // Always look up the image directly from cache so we get the correct image
    // even when imageSrc changes but imageLoaded stays true (avoiding stale imgRef).
    const img = getCachedImage(imageSrc);
    if (!img.complete || img.naturalWidth === 0) return;
    imgRef.current = img;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(containerW * dpr);
    canvas.height = Math.round(containerW * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, containerW, containerW);
    const { scale, offsetX, offsetY } = transform;
    const imgAspect = img.naturalWidth / img.naturalHeight;
    let baseW: number, baseH: number;
    if (imgAspect > 1) { baseH = containerW; baseW = containerW * imgAspect; }
    else { baseW = containerW; baseH = containerW / imgAspect; }
    const drawW = baseW * scale;
    const drawH = baseH * scale;
    ctx.drawImage(img, (containerW - drawW) / 2 + offsetX, (containerW - drawH) / 2 + offsetY, drawW, drawH);
  }, [transform, imageLoaded, containerW, imageSrc]);

  const getClampedOffset = (scale: number, ox: number, oy: number) => {
    if (!imgRef.current || containerW === 0) return { offsetX: ox, offsetY: oy };
    return clampedOffset(imgRef.current, containerW, scale, ox, oy);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") return;
    gestureRef.current = { type: "drag", lastX: e.clientX, lastY: e.clientY, lastDist: 0, lastScale: transformRef.current.scale };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (gestureRef.current.type !== "drag") return;
    const dx = e.clientX - gestureRef.current.lastX;
    const dy = e.clientY - gestureRef.current.lastY;
    gestureRef.current.lastX = e.clientX;
    gestureRef.current.lastY = e.clientY;
    const t = transformRef.current;
    onTransformChange({ ...t, ...getClampedOffset(t.scale, t.offsetX + dx, t.offsetY + dy) });
  };
  const onPointerUp = () => { gestureRef.current.type = "none"; };

  const onTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches.length === 1) {
      gestureRef.current = { type: "drag", lastX: e.touches[0].clientX, lastY: e.touches[0].clientY, lastDist: 0, lastScale: transformRef.current.scale };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      gestureRef.current = {
        type: "pinch",
        lastX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        lastY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        lastDist: Math.sqrt(dx * dx + dy * dy),
        lastScale: transformRef.current.scale,
      };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const t = transformRef.current;
    if (e.touches.length === 1 && gestureRef.current.type === "drag") {
      const dx = e.touches[0].clientX - gestureRef.current.lastX;
      const dy = e.touches[0].clientY - gestureRef.current.lastY;
      gestureRef.current.lastX = e.touches[0].clientX;
      gestureRef.current.lastY = e.touches[0].clientY;
      onTransformChange({ ...t, ...getClampedOffset(t.scale, t.offsetX + dx, t.offsetY + dy) });
    } else if (e.touches.length === 2 && gestureRef.current.type === "pinch") {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const scaleDelta = dist / gestureRef.current.lastDist;
      const panDx = midX - gestureRef.current.lastX;
      const panDy = midY - gestureRef.current.lastY;
      gestureRef.current.lastDist = dist;
      gestureRef.current.lastX = midX;
      gestureRef.current.lastY = midY;
      const newScale = clampVal(t.scale * scaleDelta, MIN_SCALE, MAX_SCALE);
      onTransformChange({ scale: newScale, ...getClampedOffset(newScale, t.offsetX + panDx, t.offsetY + panDy) });
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches.length === 0) gestureRef.current.type = "none";
    else if (e.touches.length === 1) {
      gestureRef.current = { type: "drag", lastX: e.touches[0].clientX, lastY: e.touches[0].clientY, lastDist: 0, lastScale: transformRef.current.scale };
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative select-none overflow-hidden cursor-grab active:cursor-grabbing"
      style={{ touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <canvas ref={canvasRef} className="w-full h-full" style={{ display: "block" }} />
    </div>
  );
}

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

const DEFAULT_TRANSFORM: CropTransform = { scale: 1, offsetX: 0, offsetY: 0 };

export default function NewPost() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();

  const [step, setStep] = React.useState<Step>("select");
  const [mediaType, setMediaType] = React.useState<MediaType>(
    () => (sessionStorage.getItem("newpost_tab") === "video" ? "shot" : "post"),
  );

  const [selectedFiles, setSelectedFiles] = React.useState<File[]>(() => imageDraft.files);
  const [previewUrls, setPreviewUrls] = React.useState<string[]>(() => imageDraft.previews);
  const [cropTransforms, setCropTransforms] = React.useState<Record<number, CropTransform>>(
    () => imageDraft.transforms
  );
  const [currentPreviewIndex, setCurrentPreviewIndex] = React.useState(0);
  const [description, setDescription] = React.useState(
    () => sessionStorage.getItem("newpost_description") || "",
  );
  const [selectedGoalId, setSelectedGoalId] = React.useState<string>(
    () => sessionStorage.getItem("newpost_goal_id") || "",
  );

  const [selectedVideoFile, setSelectedVideoFile] = React.useState<File | null>(
    () => videoDraft.file,
  );
  const [videoPreview, setVideoPreview] = React.useState<string | null>(() => videoDraft.preview);
  const [videoDescription, setVideoDescription] = React.useState(
    () => sessionStorage.getItem("newpost_video_description") || "",
  );

  const [userGoals, setUserGoals] = React.useState<UserGoal[]>([]);
  const [isLoadingGoals, setIsLoadingGoals] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [galleryAssets, setGalleryAssets] = React.useState<PhotoLibraryAsset[]>([]);
  const [galleryLoading, setGalleryLoading] = React.useState(false);
  const [galleryPermission, setGalleryPermission] = React.useState<"unknown" | "granted" | "limited" | "denied">("unknown");
  const [galleryPage, setGalleryPage] = React.useState(0);
  const [galleryHasMore, setGalleryHasMore] = React.useState(false);
  const GALLERY_PAGE_SIZE = 40;

  const [multiSelectMode, setMultiSelectMode] = React.useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = React.useState<string[]>([]);

  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const videoInputRef = React.useRef<HTMLInputElement>(null);
  const imageCameraRef = React.useRef<HTMLInputElement>(null);
  const videoCameraRef = React.useRef<HTMLInputElement>(null);
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
  React.useEffect(() => { sessionStorage.setItem("newpost_description", description); }, [description]);
  React.useEffect(() => { sessionStorage.setItem("newpost_goal_id", selectedGoalId); }, [selectedGoalId]);
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
    } catch {
      // silently fail — user may have denied or be on web
    } finally {
      setGalleryLoading(false);
    }
  }, [mediaType]);

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
    setMultiSelectMode(false);
    setSelectedAssetIds([]);
    if (galleryPermission === "granted" || galleryPermission === "limited") {
      setGalleryAssets([]);
      loadGalleryPage(0, true);
    }
  }, [mediaType]);

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
    if (mediaType === "shot" && asset.type === "video") {
      try {
        const { webPath } = await PhotoLibrary.getPhotoUrl({ id: asset.id });
        const response = await fetch(webPath);
        const blob = await response.blob();
        const file = new File([blob], asset.fileName, { type: asset.mimeType || "video/mp4" });
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
          try {
            const { webPath } = await PhotoLibrary.getPhotoUrl({ id: asset.id });
            const response = await fetch(webPath);
            const blob = await response.blob();
            const file = new File([blob], asset.fileName, { type: asset.mimeType || "image/jpeg" });
            const reader = new FileReader();
            reader.onloadend = () => {
              const dataUrl = reader.result as string;
              setSelectedFiles([file]);
              setPreviewUrls([dataUrl]);
              setCropTransforms({});
              setCurrentPreviewIndex(0);
              setSelectedAssetIds([asset.id]);
            };
            reader.readAsDataURL(file);
          } catch {
            imageInputRef.current?.click();
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
          // Toggle on — add to carousel
          try {
            const { webPath } = await PhotoLibrary.getPhotoUrl({ id: asset.id });
            const response = await fetch(webPath);
            const blob = await response.blob();
            const file = new File([blob], asset.fileName, { type: asset.mimeType || "image/jpeg" });
            setSelectedAssetIds((prev) => [...prev, asset.id]);
            addImageFile(file);
          } catch {
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
      addImageFile(file);
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
      await withNetworkRetry(() => createPostDb(uploadedUrls, description, selectedGoalId || null));
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
      sessionStorage.removeItem("newpost_description");
      sessionStorage.removeItem("newpost_goal_id");
      navigate("/");
    } catch (err: any) {
      if (uploadedPaths.length > 0) supabase!.storage.from("posts").remove(uploadedPaths).catch(() => {});
      toast({ title: t("newpost_post_error"), description: err?.message || t("newpost_try_later"), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }, [user, selectedFiles, previewUrls, cropTransforms, description, selectedGoalId, navigate, t]);

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
      const extension = (selectedVideoFile.name.split(".").pop() || "mp4").toLowerCase();
      const filePath = `${user.id}/shots/${timestamp}.${extension}`;
      const contentTypeMap: Record<string, string> = {
        mov: "video/quicktime", mp4: "video/mp4", m4v: "video/x-m4v",
        webm: "video/webm", avi: "video/x-msvideo", mkv: "video/x-matroska", "3gp": "video/3gpp",
      };
      const contentType = selectedVideoFile.type || contentTypeMap[extension] || "video/mp4";
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
      sessionStorage.removeItem("newpost_video_description");
      navigate("/shots");
    } catch (err: any) {
      toast({ title: t("newpost_shot_error"), description: err?.message || t("newpost_try_later"), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }, [user, selectedVideoFile, videoDescription, navigate, t]);

  const canAdvance = mediaType === "post" ? previewUrls.length > 0 : !!videoPreview;

  // Signal AppLayout to hide/show header+nav based on current step.
  // Use useLayoutEffect so the body dataset is set synchronously before paint,
  // preventing a flash of the header/footer when navigating from /shots → /postar.
  React.useLayoutEffect(() => {
    document.body.dataset.fullscreenStep = step === "select" ? "true" : "false";
    return () => { delete document.body.dataset.fullscreenStep; };
  }, [step]);

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
  //  STEP 1 — Gallery picker
  // ─────────────────────────────────────────
  if (step === "select") {
    return (
      <div className="flex flex-col" style={{ minHeight: "100dvh" }}>

        {/* ── Custom header ── */}
        <div
          className="flex items-center justify-between px-4 py-3 bg-background border-b border-border/40"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <span className="text-base font-semibold">{t("newpost_title_simple")}</span>
          <button
            onClick={() => setStep("caption")}
            disabled={!canAdvance}
            className={`min-h-[44px] px-2 flex items-center text-sm font-semibold transition-colors ${canAdvance ? "text-primary" : "text-muted-foreground"}`}
          >
            {t("newpost_advance")}
          </button>
        </div>

        {/* ── Media type — segmented control ── */}
        <div className="px-4 py-3 bg-background border-b border-border/40">
          <div className="flex items-center bg-muted rounded-xl p-1 gap-1">
            <button
              onClick={() => setMediaType("post")}
              className={`flex flex-1 items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                mediaType === "post"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              <ImagePlus className="h-4 w-4 shrink-0" />
              {t("newpost_tab_post")}
            </button>
            <button
              onClick={() => setMediaType("shot")}
              className={`flex flex-1 items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                mediaType === "shot"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              <Clapperboard className="h-4 w-4 shrink-0" />
              {t("newpost_tab_shots")}
            </button>
          </div>
        </div>

        {/* ── Preview area ── */}
        <div className="relative w-full bg-black" style={{ aspectRatio: "1/1" }}>
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
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 p-2 rounded-full pointer-events-auto"
                    >
                      <ChevronLeft className="h-5 w-5 text-white" />
                    </button>
                    <button
                      onClick={() => setCurrentPreviewIndex((i) => (i + 1) % previewUrls.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 p-2 rounded-full pointer-events-auto"
                    >
                      <ChevronRight className="h-5 w-5 text-white" />
                    </button>
                    {/* Dots */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-none">
                      {previewUrls.map((_, i) => (
                        <div
                          key={i}
                          className={`rounded-full transition-all ${i === currentPreviewIndex ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50"}`}
                        />
                      ))}
                    </div>
                  </>
                )}
                {/* Multi-select badge */}
                <div className="absolute top-3 right-3 bg-black/60 rounded-full px-2.5 py-1 text-white text-xs font-semibold flex items-center gap-1 pointer-events-none">
                  <ImagePlus className="h-3.5 w-3.5" />
                  {previewUrls.length}
                </div>
              </>
            ) : (
              <button
                onClick={() => imageInputRef.current?.click()}
                className="w-full h-full flex flex-col items-center justify-center gap-3 text-white/60"
              >
                <Camera className="h-12 w-12" />
                <span className="text-sm">{t("newpost_tap_to_select")}</span>
              </button>
            )
          ) : (
            videoPreview ? (
              <video src={videoPreview} controls playsInline className="w-full h-full object-contain" />
            ) : (
              <button
                onClick={() => videoInputRef.current?.click()}
                className="w-full h-full flex flex-col items-center justify-center gap-3 text-white/60"
              >
                <Video className="h-12 w-12" />
                <span className="text-sm">{t("newpost_tap_to_select_video")}</span>
              </button>
            )
          )}
        </div>

        {/* ── Crop hint ── */}
        {mediaType === "post" && previewUrls.length > 0 && (
          <div className="px-4 py-1.5 bg-background border-b border-border/10 text-center">
            <span className="text-[10px] text-muted-foreground">{t("newpost_crop_hint")}</span>
          </div>
        )}

        {/* ── Gallery toolbar ── */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/20 bg-background">
          <span className="text-sm font-semibold">{t("newpost_recents")}</span>
          {mediaType === "post" && (
            <button
              onClick={() => {
                const next = !multiSelectMode;
                setMultiSelectMode(next);
                // Turning off multi-select: keep only the currently visible photo
                if (!next && selectedFiles.length > 1) {
                  const keepIdx = currentPreviewIndex;
                  setSelectedFiles([selectedFiles[keepIdx]]);
                  setPreviewUrls([previewUrls[keepIdx]]);
                  setCropTransforms({ 0: cropTransforms[keepIdx] || DEFAULT_TRANSFORM });
                  setSelectedAssetIds([selectedAssetIds[keepIdx]].filter(Boolean));
                  setCurrentPreviewIndex(0);
                }
              }}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full transition-colors ${
                multiSelectMode
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-foreground"
              }`}
            >
              <ImagePlus className="h-4 w-4" />
              {t("newpost_select_btn")}
            </button>
          )}
        </div>

        {/* ── Gallery grid ── */}
        {mediaType === "post" && (
          <div className="flex-1 overflow-y-auto bg-background">
            <div className="grid grid-cols-4 gap-px bg-border/20">
              <button
                onClick={() => imageCameraRef.current?.click()}
                className="aspect-square bg-muted/60 flex items-center justify-center"
              >
                <Camera className="h-6 w-6 text-muted-foreground" />
              </button>

              {galleryPermission === "denied" && galleryAssets.length === 0 && (
                <div className="col-span-3 aspect-square flex items-center justify-center px-3">
                  <p className="text-xs text-muted-foreground text-center">{t("newpost_gallery_permission_denied")}</p>
                </div>
              )}

              {galleryAssets.map((asset) => {
                const selectedIdx = selectedAssetIds.indexOf(asset.id);
                const isSelected = selectedIdx !== -1;
                const thumbSrc = asset.thumbnail?.webPath;
                return (
                  <button
                    key={asset.id}
                    onClick={() => handleGalleryAssetTap(asset)}
                    className="relative aspect-square overflow-hidden"
                  >
                    {thumbSrc ? (
                      <img src={thumbSrc} alt={asset.fileName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-muted/40 flex items-center justify-center">
                        <Camera className="h-4 w-4 text-muted-foreground/40" />
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute inset-0 bg-primary/25 ring-2 ring-inset ring-primary" />
                    )}
                    {isSelected && (
                      <div className="absolute bottom-1 left-1 bg-primary rounded-full w-5 h-5 flex items-center justify-center text-white text-[10px] font-bold">
                        {selectedIdx + 1}
                      </div>
                    )}
                  </button>
                );
              })}

              {galleryLoading && galleryAssets.length === 0 &&
                Array.from({ length: 11 }).map((_, i) => (
                  <div key={`ph-${i}`} className="aspect-square bg-muted/30 animate-pulse" />
                ))
              }
            </div>

            {galleryHasMore && !galleryLoading && (
              <button
                onClick={() => loadGalleryPage(galleryPage + 1)}
                className="w-full py-3 text-xs text-muted-foreground"
              >
                {t("newpost_load_more_photos")}
              </button>
            )}
            {galleryLoading && galleryAssets.length > 0 && (
              <div className="flex justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        )}

        {mediaType === "shot" && (
          <div className="flex-1 overflow-y-auto bg-background">
            {videoPreview && (
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
                <div className="flex items-center gap-3">
                  <Clapperboard className="h-5 w-5 text-muted-foreground" />
                  {selectedVideoFile && (
                    <div>
                      <p className="text-sm font-medium truncate max-w-[200px]">{selectedVideoFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedVideoFile.size < 1024 * 1024
                          ? `${Math.round(selectedVideoFile.size / 1024)} KB`
                          : `${(selectedVideoFile.size / (1024 * 1024)).toFixed(1)} MB`}
                      </p>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (videoPreview?.startsWith("blob:")) URL.revokeObjectURL(videoPreview);
                    setVideoPreview(null);
                    setSelectedVideoFile(null);
                  }}
                  className="flex items-center gap-1 text-destructive text-sm"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-4 gap-px bg-border/20">
              <button
                onClick={() => videoCameraRef.current?.click()}
                className="aspect-square bg-muted/60 flex items-center justify-center"
              >
                <Video className="h-6 w-6 text-muted-foreground" />
              </button>

              {galleryPermission === "denied" && galleryAssets.length === 0 && (
                <div className="col-span-3 aspect-square flex items-center justify-center px-3">
                  <p className="text-xs text-muted-foreground text-center">{t("newpost_gallery_permission_denied")}</p>
                </div>
              )}

              {galleryAssets.map((asset) => {
                const isSelected = selectedVideoFile?.name === asset.fileName;
                const thumbSrc = asset.thumbnail?.webPath;
                return (
                  <button
                    key={asset.id}
                    onClick={() => handleGalleryAssetTap(asset)}
                    className="relative aspect-square overflow-hidden"
                  >
                    {thumbSrc ? (
                      <img src={thumbSrc} alt={asset.fileName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-muted/40 flex items-center justify-center">
                        <Video className="h-4 w-4 text-muted-foreground/40" />
                      </div>
                    )}
                    {asset.duration && (
                      <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1 rounded">
                        {Math.floor(asset.duration / 60)}:{String(Math.round(asset.duration % 60)).padStart(2, "0")}
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute inset-0 bg-primary/25 ring-2 ring-inset ring-primary" />
                    )}
                  </button>
                );
              })}

              {galleryLoading && galleryAssets.length === 0 &&
                Array.from({ length: 11 }).map((_, i) => (
                  <div key={`ph-${i}`} className="aspect-square bg-muted/30 animate-pulse" />
                ))
              }
            </div>

            {galleryHasMore && !galleryLoading && (
              <button
                onClick={() => loadGalleryPage(galleryPage + 1)}
                className="w-full py-3 text-xs text-muted-foreground"
              >
                {t("newpost_load_more_photos")}
              </button>
            )}
            {galleryLoading && galleryAssets.length > 0 && (
              <div className="flex justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        )}

        {/* Hidden file inputs */}
        <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
        <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoFileChange} className="hidden" />
        <input ref={imageCameraRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
        <input ref={videoCameraRef} type="file" accept="video/*" capture="environment" onChange={handleVideoFileChange} className="hidden" />
      </div>
    );
  }

  // ─────────────────────────────────────────
  //  STEP 2 — Caption & publish
  // ─────────────────────────────────────────
  return (
    <div className="flex flex-col">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-background border-b border-border/40">
        <button
          onClick={() => setStep("select")}
          className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-semibold">{t("newpost_new_post_header")}</span>
        <div className="w-9" />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Preview strip ── */}
        <div className="flex items-start gap-3 px-4 py-4 border-b border-border/20">
          {mediaType === "post" && previewUrls.length > 0 && (
            <img
              src={previewUrls[currentPreviewIndex]}
              alt="Preview"
              className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
            />
          )}
          {mediaType === "shot" && videoPreview && (
            <video src={videoPreview} playsInline muted className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
          )}
          <Textarea
            placeholder={mediaType === "post" ? t("newpost_caption_placeholder") : t("newpost_caption_video_placeholder")}
            value={mediaType === "post" ? description : videoDescription}
            onChange={(e) =>
              mediaType === "post" ? setDescription(e.target.value) : setVideoDescription(e.target.value)
            }
            maxLength={500}
            className="flex-1 resize-none border-0 shadow-none focus-visible:ring-0 p-0 text-base leading-relaxed bg-transparent min-h-[80px]"
            rows={4}
          />
        </div>

        {/* ── Selected photos strip (if multiple) ── */}
        {mediaType === "post" && previewUrls.length > 1 && (
          <div className="px-4 py-3 border-b border-border/20">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {previewUrls.map((url, i) => (
                <div key={i} className="relative flex-shrink-0">
                  <img
                    src={url}
                    alt={t("newpost_photo_alt").replace("{n}", String(i + 1))}
                    className={`h-14 w-14 rounded-lg object-cover ${i === currentPreviewIndex ? "ring-2 ring-primary" : ""}`}
                    onClick={() => setCurrentPreviewIndex(i)}
                  />
                  {previewUrls.length > 1 && (
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute -top-1 -right-1 bg-black/70 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Char count ── */}
        <div className="px-4 py-2 border-b border-border/20">
          <span className={`text-xs ${(mediaType === "post" ? description : videoDescription).length > 450 ? "text-orange-400" : "text-muted-foreground"}`}>
            {(mediaType === "post" ? description : videoDescription).length}/500
          </span>
        </div>

        {/* ── Goal (post only) ── */}
        {mediaType === "post" && (
          <div className="px-4 py-4 border-b border-border/20 space-y-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">{t("newpost_link_goal")}</span>
              <span className="text-xs text-muted-foreground">{t("newpost_optional")}</span>
            </div>
            {isLoadingGoals ? (
              <p className="text-sm text-muted-foreground">{t("newpost_goals_loading")}</p>
            ) : userGoals.filter((g) => g.perc < 100).length > 0 ? (
              <Select value={selectedGoalId} onValueChange={setSelectedGoalId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={t("newpost_select_goal")} />
                </SelectTrigger>
                <SelectContent>
                  {userGoals
                    .filter((g) => g.perc < 100)
                    .map((goal) => (
                      <SelectItem key={goal.id} value={goal.id}>
                        {goal.description}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              <button
                onClick={() => navigate("/metas?tab=metas")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("newpost_no_goals")}{" "}
                <span className="text-primary font-medium">{t("newpost_create_goal")}</span>
              </button>
            )}
            {selectedGoalId && (
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                {t("newpost_goal_progress_hint")}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Publish button ── */}
      <div
        className="px-4 py-4 border-t border-border/40 bg-background"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <Button
          className="w-full rounded-full font-semibold"
          onClick={mediaType === "post" ? handleImageSubmit : handleVideoSubmit}
          disabled={isSubmitting || (mediaType === "post" ? selectedFiles.length === 0 : !selectedVideoFile)}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t("newpost_publishing")}
            </>
          ) : mediaType === "post" ? (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              {t("newpost_publish")}
            </>
          ) : (
            <>
              <Clapperboard className="h-4 w-4 mr-2" />
              {t("newpost_publish_shot")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
