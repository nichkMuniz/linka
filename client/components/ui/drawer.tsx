import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/lib/utils";

// Tracks the keyboard height on iOS via visualViewport API.
// Returns the number of pixels the keyboard is occupying above the bottom of the window.
function useKeyboardOffset() {
  const [offset, setOffset] = React.useState(0);

  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      // On iOS, when the keyboard opens the visualViewport height shrinks.
      // offsetTop accounts for any scrolling of the viewport itself.
      const keyboardHeight = window.innerHeight - vv.height - vv.offsetTop;
      setOffset(Math.max(0, keyboardHeight));
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
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
    className={cn("fixed inset-0 z-[100] bg-black/80", className)}
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

  // When the keyboard opens, ensure the focused field is visible inside the
  // drawer's scrollable area. We delay slightly so the layout settles after the
  // visualViewport resize event.
  React.useEffect(() => {
    if (keyboardOffset <= 0) return;
    const el = document.activeElement as HTMLElement | null;
    if (!el) return;
    const tag = el.tagName;
    const editable =
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      el.isContentEditable;
    if (!editable) return;
    if (!innerRef.current?.contains(el)) return;
    const id = window.setTimeout(() => {
      try {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      } catch {
        el.scrollIntoView();
      }
    }, 80);
    return () => window.clearTimeout(id);
  }, [keyboardOffset]);

  const keyboardOpen = keyboardOffset > 0;

  return (
    <DrawerPortal>
      <DrawerOverlay className={overlayClassName} />
      <DrawerPrimitive.Content
        ref={innerRef}
        className={cn(
          "fixed bottom-0 z-[110] mt-24 flex h-auto w-full max-w-[680px] flex-col rounded-t-[10px] border bg-background md:rounded-xl",
          "left-0 right-0 mx-auto",
          className,
        )}
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
          transition:
            "bottom 0.25s ease-out, max-height 0.25s ease-out, padding-bottom 0.25s ease-out",
          // Consumer styles (e.g. maxHeight) come first so we can override them
          // when the keyboard is open and the drawer must shrink to fit.
          ...style,
          ...(keyboardOpen
            ? {
                bottom: `${keyboardOffset}px`,
                // Cap the drawer height to the space above the keyboard so the
                // top of the sheet (drag handle, header) never goes off-screen
                // when consumers also set maxHeight (e.g. min(80dvh, ...)).
                maxHeight: `calc(100dvh - ${keyboardOffset}px - env(safe-area-inset-top) - 8px)`,
                // The keyboard already provides bottom inset; safe-area would
                // double-pad and push the last input out of view.
                paddingBottom: 0,
              }
            : null),
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
