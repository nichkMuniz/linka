import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/lib/utils";

// Tracks the keyboard height on iOS via visualViewport API.
// Returns the number of pixels the keyboard is occupying above the bottom of the window.
// Uses a threshold to ignore tiny residual offsets that iOS sometimes leaves after the
// keyboard dismisses, and re-checks on focusout so the drawer reliably returns to its
// full size when an input loses focus (e.g. after submitting a comment).
const KEYBOARD_OPEN_THRESHOLD = 80;

function useKeyboardOffset() {
  const [offset, setOffset] = React.useState(0);

  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let recheckId: number | null = null;

    const compute = () => {
      const raw = window.innerHeight - vv.height - vv.offsetTop;
      const next = raw > KEYBOARD_OPEN_THRESHOLD ? Math.max(0, raw) : 0;
      setOffset((prev) => (prev === next ? prev : next));
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

  return offset;
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
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & { overlayClassName?: string }
>(({ className, children, overlayClassName, style, ...props }, ref) => {
  const keyboardOffset = useKeyboardOffset();
  const innerRef = React.useRef<HTMLDivElement | null>(null);

  React.useImperativeHandle(ref, () => innerRef.current as HTMLDivElement);

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
          // Expose the keyboard height as a CSS var so consumers can lift fixed
          // input bars above the keyboard (e.g. `marginBottom: var(--keyboard-offset)`)
          // without resizing the drawer itself — matching native iOS behavior where
          // the keyboard overlays the sheet instead of shrinking it.
          ["--keyboard-offset" as any]: `${keyboardOffset}px`,
          ...style,
        }}
        {...props}
      >
        <div className="mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full bg-muted" />
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
    className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
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
      "text-lg font-semibold leading-none tracking-tight",
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
