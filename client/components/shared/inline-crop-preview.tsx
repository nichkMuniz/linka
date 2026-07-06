import * as React from "react";

// ─── Crop types & helpers ───────────────────────────────────────────────────
// Reaproveitado por NewPost.tsx e workout-summary-overlay.tsx: zoom/pan direto
// no frame da foto (pinch + drag), sem passar por uma tela de crop separada.

export interface CropTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export const MIN_SCALE = 1;
export const MAX_SCALE = 5;
export const DEFAULT_TRANSFORM: CropTransform = { scale: 1, offsetX: 0, offsetY: 0 };

export function clampVal(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi);
}

export function clampedOffset(
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

export function applyTransformToBlob(
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

export function getCachedImage(src: string): HTMLImageElement {
  if (!decodedImageCache[src]) {
    const img = new Image();
    img.src = src;
    decodedImageCache[src] = img;
  }
  return decodedImageCache[src];
}

// ─── Static cropped thumbnail ───────────────────────────────────────────────
// Renders a small preview that reflects the same scale/pan transform applied
// in InlineCropPreview, scaling offsetX/offsetY to the thumbnail's own size
// since the transform's pixel values were captured against `referenceWidth`
// (the width of the full-size crop frame in Etapa 1).

export function CroppedThumb({
  imageSrc,
  transform,
  referenceWidth,
  className,
  style,
  alt = "",
}: {
  imageSrc: string;
  transform: CropTransform;
  referenceWidth: number;
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState(0);
  const [natural, setNatural] = React.useState<{ w: number; h: number } | null>(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize(el.clientWidth));
    ro.observe(el);
    setSize(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    const img = getCachedImage(imageSrc);
    const set = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    if (img.complete && img.naturalWidth > 0) set();
    else img.addEventListener("load", set, { once: true });
    return () => img.removeEventListener("load", set);
  }, [imageSrc]);

  let imgStyle: React.CSSProperties = { display: "none" };
  if (size > 0 && natural && referenceWidth > 0) {
    const ratio = size / referenceWidth;
    const { scale, offsetX, offsetY } = transform;
    const imgAspect = natural.w / natural.h;
    let baseW: number, baseH: number;
    if (imgAspect > 1) { baseH = size; baseW = size * imgAspect; }
    else { baseW = size; baseH = size / imgAspect; }
    const drawW = baseW * scale;
    const drawH = baseH * scale;
    imgStyle = {
      position: "absolute",
      left: (size - drawW) / 2 + offsetX * ratio,
      top: (size - drawH) / 2 + offsetY * ratio,
      width: drawW,
      height: drawH,
      maxWidth: "none",
    };
  }

  return (
    <div ref={containerRef} className={className} style={{ position: "relative", overflow: "hidden", ...style }}>
      <img src={imageSrc} alt={alt} draggable={false} style={imgStyle} />
    </div>
  );
}

// ─── Inline crop preview ────────────────────────────────────────────────────

export function InlineCropPreview({
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
