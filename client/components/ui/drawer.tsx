import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/lib/utils";

// Tracks the iOS software keyboard via the visualViewport API.
// Returns both the keyboard height (`offset`) and the height of the visible area
// above the keyboard (`availableHeight`, only meaningful while the keyboard is open).
// Uses a threshold to ignore tiny residual offsets that iOS sometimes leaves after the
// keyboard dismisses, and re-checks on focusout so the drawer reliably returns to its
// full size when an input loses focus (e.g. after submitting a comment).
const KEYBOARD_OPEN_THRESHOLD = 80;

type KeyboardInsets = { offset: number; availableHeight: number };

function useKeyboardInsets(): KeyboardInsets {
  const [insets, setInsets] = React.useState<KeyboardInsets>({ offset: 0, availableHeight: 0 });

  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let recheckId: number | null = null;

    const compute = () => {
      const raw = window.innerHeight - vv.height - vv.offsetTop;
      const offset = raw > KEYBOARD_OPEN_THRESHOLD ? Math.max(0, raw) : 0;
      // Visible height above the keyboard; 0 when the keyboard is closed.
      const availableHeight = offset > 0 ? vv.height : 0;
      setInsets((prev) =>
        prev.offset === offset && prev.availableHeight === availableHeight
          ? prev
          : { offset, availableHeight },
      );
    };

    const scheduleRecheck = () => {
      if (recheckId !== null) window.clearTimeout(recheckId);
      recheckId = window.setTimeout(() => {
        compute();
        recheckId = null;
      }, 180);
    };

    const onFocusOut = () => scheduleRecheck();

    vv.addEventListener("resize", compute);
    vv.addEventListener("scroll", compute);
    document.addEventListener("focusout", onFocusOut, true);
    return () => {
      if (recheckId !== null) window.clearTimeout(recheckId);
      vv.removeEventListener("resize", compute);
      vv.removeEventListener("scroll", compute);
      document.removeEventListener("focusout", onFocusOut, true);
    };
  }, []);

  return insets;
}

const Drawer = ({
  shouldScaleBackground = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root
    shouldScaleBackground={shouldScaleBackground}
    {...props}
  />
);
Drawer.displayName = "Drawer";

const DrawerTrigger = DrawerPrimitive.Trigger;

const DrawerPortal = DrawerPrimitive.Portal;

const DrawerClose = DrawerPrimitive.Close;

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-[300] bg-black/80", className)}
    {...props}
  />
));
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & { overlayClassName?: string; handleClassName?: string }
>(({ className, children, overlayClassName, handleClassName, style, ...props }, ref) => {
  const { offset: keyboardOffset, availableHeight } = useKeyboardInsets();
  const innerRef = React.useRef<HTMLDivElement | null>(null);

  React.useImperativeHandle(ref, () => innerRef.current as HTMLDivElement);

  // While the iOS keyboard is open, lift the whole bottom-anchored sheet above it
  // and cap its height to the visible area. This keeps the sheet (and its scrollable
  // content) the same size and just slides it up, instead of consumers growing the
  // sheet from the bottom via margins (which made content balloon and jump upward).
  // Overrides any consumer max-height only while typing; reverts when the keyboard closes.
  const keyboardStyle: React.CSSProperties | undefined =
    keyboardOffset > 0
      ? { bottom: `${keyboardOffset}px`, maxHeight: `${Math.max(0, availableHeight - 8)}px` }
      : undefined;

  return (
    <DrawerPortal>
      <DrawerOverlay className={overlayClassName} />
      <DrawerPrimitive.Content
        ref={innerRef}
        className={cn(
          "fixed bottom-0 z-[310] mt-24 flex h-auto w-full max-w-[680px] flex-col rounded-t-[10px] border bg-background md:rounded-xl",
          "left-0 right-0 mx-auto",
          className,
        )}
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
          // Still exposed for backwards compatibility, but consumers no longer need to
          // lift their own input bars: DrawerContent now lifts the entire sheet (above).
          ["--keyboard-offset" as any]: `${keyboardOffset}px`,
          ...style,
          ...keyboardStyle,
        }}
        {...props}
      >
        <div className={cn("mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full bg-muted", handleClassName)} />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
});
DrawerContent.displayName = "DrawerContent";

const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("grid gap-1 px-4 pt-4 pb-2 text-left", className)}
    {...props}
  />
);
DrawerHeader.displayName = "DrawerHeader";

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("mt-auto flex flex-col gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]", className)}
    {...props}
  />
);
DrawerFooter.displayName = "DrawerFooter";

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn(
      "text-xl font-bold leading-tight",
      className,
    )}
    {...props}
  />
));
DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
