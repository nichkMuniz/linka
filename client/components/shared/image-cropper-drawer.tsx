import * as React from "react";
import { X, ZoomIn, ZoomOut, RotateCcw, Check } from "lucide-react";
import {
  Drawer,
  DrawerContent,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface ImageCropperDrawerProps {
  /** URL da imagem a editar (data URL ou URL remota) */
  imageSrc: string | null;
  /** Razão de aspecto do crop (ex: 1 = quadrado, 4/5 = retrato, 16/9 = paisagem). Padrão: 1 */
  aspectRatio?: number;
  onConfirm: (croppedDataUrl: string, croppedBlob: Blob) => void;
  onCancel: () => void;
}

interface Transform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function ImageCropperDrawer({
  imageSrc,
  aspectRatio = 1,
  onConfirm,
  onCancel,
}: ImageCropperDrawerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const imgRef = React.useRef<HTMLImageElement | null>(null);

  const [transform, setTransform] = React.useState<Transform>({ scale: 1, offsetX: 0, offsetY: 0 });
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });

  // Touch/pointer state refs (avoid re-renders during gesture)
  const gestureRef = React.useRef<{
    type: "none" | "drag" | "pinch";
    lastX: number;
    lastY: number;
    lastDist: number;
    lastScale: number;
  }>({ type: "none", lastX: 0, lastY: 0, lastDist: 0, lastScale: 1 });

  // Reset state when image changes
  React.useEffect(() => {
    if (!imageSrc) {
      setImageLoaded(false);
      setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
      return;
    }

    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);
      setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Measure container
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, [imageLoaded]);

  // Draw canvas preview
  React.useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imageLoaded || containerSize.width === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const { width: cw } = containerSize;
    // Crop frame size inside container (CSS pixels)
    const frameW = cw;
    const frameH = cw / aspectRatio;

    // Set internal buffer at physical pixel resolution for crisp rendering on retina
    canvas.width = Math.round(frameW * dpr);
    canvas.height = Math.round(frameH * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, frameW, frameH);

    const { scale, offsetX, offsetY } = transform;

    // Base size: fit image into frame (in CSS pixels)
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const frameAspect = frameW / frameH;

    let baseW: number, baseH: number;
    if (imgAspect > frameAspect) {
      baseH = frameH;
      baseW = frameH * imgAspect;
    } else {
      baseW = frameW;
      baseH = frameW / imgAspect;
    }

    const drawW = baseW * scale;
    const drawH = baseH * scale;

    // Center + offset
    const drawX = (frameW - drawW) / 2 + offsetX;
    const drawY = (frameH - drawH) / 2 + offsetY;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  }, [transform, imageLoaded, containerSize, aspectRatio]);

  // Clamp offset so image doesn't show gaps at crop edges
  const clampOffset = React.useCallback(
    (scale: number, offsetX: number, offsetY: number) => {
      if (!imgRef.current || containerSize.width === 0) return { offsetX, offsetY };

      const { width: cw } = containerSize;
      const frameW = cw;
      const frameH = cw / aspectRatio;

      const imgAspect = imgRef.current.naturalWidth / imgRef.current.naturalHeight;
      const frameAspect = frameW / frameH;

      let baseW: number, baseH: number;
      if (imgAspect > frameAspect) {
        baseH = frameH;
        baseW = frameH * imgAspect;
      } else {
        baseW = frameW;
        baseH = frameW / imgAspect;
      }

      const drawW = baseW * scale;
      const drawH = baseH * scale;

      // Limit offset so edges don't reveal background
      const maxOffsetX = (drawW - frameW) / 2;
      const maxOffsetY = (drawH - frameH) / 2;

      return {
        offsetX: clamp(offsetX, -maxOffsetX, maxOffsetX),
        offsetY: clamp(offsetY, -maxOffsetY, maxOffsetY),
      };
    },
    [containerSize, aspectRatio]
  );

  // Pointer events for drag
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") return; // handled by touch events
    gestureRef.current = { type: "drag", lastX: e.clientX, lastY: e.clientY, lastDist: 0, lastScale: transform.scale };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (gestureRef.current.type !== "drag") return;
    const dx = e.clientX - gestureRef.current.lastX;
    const dy = e.clientY - gestureRef.current.lastY;
    gestureRef.current.lastX = e.clientX;
    gestureRef.current.lastY = e.clientY;
    setTransform((prev) => {
      const clamped = clampOffset(prev.scale, prev.offsetX + dx, prev.offsetY + dy);
      return { ...prev, ...clamped };
    });
  };

  const onPointerUp = () => {
    gestureRef.current.type = "none";
  };

  // Mouse wheel zoom
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setTransform((prev) => {
      const newScale = clamp(prev.scale + delta, MIN_SCALE, MAX_SCALE);
      const clamped = clampOffset(newScale, prev.offsetX, prev.offsetY);
      return { scale: newScale, ...clamped };
    });
  };

  // Touch events for pinch + drag
  const touchRef = React.useRef<React.Touch[]>([]);

  const onTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    touchRef.current = Array.from(e.touches);
    if (e.touches.length === 1) {
      gestureRef.current = {
        type: "drag",
        lastX: e.touches[0].clientX,
        lastY: e.touches[0].clientY,
        lastDist: 0,
        lastScale: transform.scale,
      };
    } else if (e.touches.length === 2) {
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      gestureRef.current = { type: "pinch", lastX: midX, lastY: midY, lastDist: dist, lastScale: transform.scale };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.touches.length === 1 && gestureRef.current.type === "drag") {
      const dx = e.touches[0].clientX - gestureRef.current.lastX;
      const dy = e.touches[0].clientY - gestureRef.current.lastY;
      gestureRef.current.lastX = e.touches[0].clientX;
      gestureRef.current.lastY = e.touches[0].clientY;
      setTransform((prev) => {
        const clamped = clampOffset(prev.scale, prev.offsetX + dx, prev.offsetY + dy);
        return { ...prev, ...clamped };
      });
    } else if (e.touches.length === 2 && gestureRef.current.type === "pinch") {
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scaleDelta = dist / gestureRef.current.lastDist;
      // Also track midpoint translation during pinch
      const panDx = midX - gestureRef.current.lastX;
      const panDy = midY - gestureRef.current.lastY;
      gestureRef.current.lastDist = dist;
      gestureRef.current.lastX = midX;
      gestureRef.current.lastY = midY;
      setTransform((prev) => {
        const newScale = clamp(prev.scale * scaleDelta, MIN_SCALE, MAX_SCALE);
        const clamped = clampOffset(newScale, prev.offsetX + panDx, prev.offsetY + panDy);
        return { scale: newScale, ...clamped };
      });
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches.length < 2) {
      if (e.touches.length === 1) {
        gestureRef.current = {
          type: "drag",
          lastX: e.touches[0].clientX,
          lastY: e.touches[0].clientY,
          lastDist: 0,
          lastScale: transform.scale,
        };
      } else {
        gestureRef.current.type = "none";
      }
    }
  };

  const handleReset = () => {
    setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  };

  const handleZoom = (newScale: number) => {
    setTransform((prev) => {
      const clamped = clampOffset(newScale, prev.offsetX, prev.offsetY);
      return { scale: newScale, ...clamped };
    });
  };

  const handleConfirm = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsProcessing(true);
    try {
      // Export: use the image's own natural resolution as the source of truth.
      // We derive how many natural pixels fall inside the visible crop frame,
      // then draw exactly those pixels into the export canvas — no upscaling ever.
      const img = imgRef.current;
      if (!img) return;

      const { width: cw } = containerSize;
      const frameW = cw;
      const frameH = cw / aspectRatio;

      const imgAspect = img.naturalWidth / img.naturalHeight;
      const frameAspect = frameW / frameH;

      // Base rendered size of the full image (in CSS pixels) at scale=1
      let baseW: number, baseH: number;
      if (imgAspect > frameAspect) {
        baseH = frameH;
        baseW = frameH * imgAspect;
      } else {
        baseW = frameW;
        baseH = frameW / imgAspect;
      }

      const { scale, offsetX, offsetY } = transform;

      // Ratio: how many CSS pixels correspond to one natural pixel
      const cssPerNaturalX = (baseW * scale) / img.naturalWidth;
      const cssPerNaturalY = (baseH * scale) / img.naturalHeight;

      // Top-left corner of the crop frame in natural image coordinates
      const cropOriginX = ((baseW * scale - frameW) / 2 - offsetX) / cssPerNaturalX;
      const cropOriginY = ((baseH * scale - frameH) / 2 - offsetY) / cssPerNaturalY;

      // How many natural pixels fit inside the crop frame
      const cropNatW = frameW / cssPerNaturalX;
      const cropNatH = frameH / cssPerNaturalY;

      // Export canvas size: up to 2160px but never larger than the natural crop region
      const MAX_EXPORT = 2160;
      const exportW = Math.round(Math.min(cropNatW, MAX_EXPORT));
      const exportH = Math.round(Math.min(cropNatH, MAX_EXPORT / aspectRatio));

      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = exportW;
      exportCanvas.height = exportH;

      const exportCtx = exportCanvas.getContext("2d");
      if (!exportCtx) return;

      // Draw the natural-pixel crop region into the export canvas
      exportCtx.drawImage(
        img,
        cropOriginX, cropOriginY, cropNatW, cropNatH,  // source: natural px region
        0, 0, exportW, exportH,                         // dest: export canvas
      );

      const dataUrl = exportCanvas.toDataURL("image/jpeg", 0.92);
      exportCanvas.toBlob(
        (blob) => {
          if (blob) onConfirm(dataUrl, blob);
        },
        "image/jpeg",
        0.92
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const frameH = containerSize.width > 0 ? containerSize.width / aspectRatio : 300;

  return (
    <Drawer open={!!imageSrc} onOpenChange={(open) => { if (!open) onCancel(); }} dismissible={false} shouldScaleBackground={false}>
      <DrawerContent
        className="h-[100dvh] mt-0 rounded-none flex flex-col bg-black !z-[200]"
        overlayClassName="!z-[190] bg-black/90"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-white/10"
          style={{ paddingTop: `calc(env(safe-area-inset-top, 0px) + 0.75rem)` }}
        >
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm transition-colors"
          >
            <X className="h-5 w-5" />
            Cancelar
          </button>
          <span className="text-white text-sm font-semibold">Ajustar foto</span>
          <Button
            onClick={handleConfirm}
            disabled={!imageLoaded || isProcessing}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-white rounded-full px-4 h-8 text-sm font-semibold"
          >
            {isProcessing ? (
              <span className="animate-pulse">...</span>
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                Confirmar
              </>
            )}
          </Button>
        </div>

        {/* Canvas area */}
        <div className="flex-1 flex flex-col items-center justify-center overflow-hidden">
          <div
            ref={containerRef}
            className="w-full relative select-none overflow-hidden bg-black cursor-grab active:cursor-grabbing"
            style={{ height: frameH, touchAction: "none" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onWheel={onWheel}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <canvas
              ref={canvasRef}
              className="w-full h-full"
              style={{ display: "block" }}
            />
            {/* Grid overlay */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
                backgroundSize: "33.33% 33.33%",
              }}
            />
          </div>
        </div>

        {/* Controls */}
        <div
          className="px-5 pt-4 space-y-4 border-t border-white/10"
          style={{ paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 1rem)` }}
        >
          {/* Zoom slider */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleZoom(clamp(transform.scale - 0.25, MIN_SCALE, MAX_SCALE))}
              className="text-white/70 hover:text-white transition-colors"
            >
              <ZoomOut className="h-5 w-5" />
            </button>
            <Slider
              min={MIN_SCALE * 100}
              max={MAX_SCALE * 100}
              step={5}
              value={[Math.round(transform.scale * 100)]}
              onValueChange={([v]) => handleZoom(v / 100)}
              className="flex-1"
            />
            <button
              onClick={() => handleZoom(clamp(transform.scale + 0.25, MIN_SCALE, MAX_SCALE))}
              className="text-white/70 hover:text-white transition-colors"
            >
              <ZoomIn className="h-5 w-5" />
            </button>
          </div>

          {/* Zoom label + reset */}
          <div className="flex items-center justify-between">
            <span className="text-white/50 text-xs">
              Zoom: {Math.round(transform.scale * 100)}%
            </span>
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-white/60 hover:text-white text-xs transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Resetar
            </button>
          </div>

          {/* Hint */}
          <p className="text-center text-white/30 text-xs">
            Arraste para reposicionar · Pinça para zoom no celular
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
