import * as React from "react";
import { X, ImageIcon } from "lucide-react";
import {
  Drawer,
  DrawerContent,
} from "@/components/ui/drawer";

interface ImageZoomItem {
  src: string | null;
  name: string;
  description?: string;
}

interface ImageZoomDrawerProps {
  item: ImageZoomItem | null;
  onClose: () => void;
}

export function ImageZoomDrawer({ item, onClose }: ImageZoomDrawerProps) {
  return (
    <Drawer open={!!item} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DrawerContent className="h-[100dvh] flex flex-col modal-enter">
        {item && (
          <>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 h-8 w-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            {item.src ? (
              <img
                src={item.src}
                alt={item.name}
                className="w-full flex-shrink-0 object-cover"
                style={{ height: item.description ? "60dvh" : "80dvh" }}
              />
            ) : (
              <div className="w-full flex-shrink-0 bg-muted flex items-center justify-center" style={{ height: "40dvh" }}>
                <ImageIcon className="h-16 w-16 text-muted-foreground/40" />
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <p className="font-semibold text-lg">{item.name}</p>
              {item.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              )}
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
