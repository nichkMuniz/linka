import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/lib/utils";

// Keyboard handling (iOS): @capacitor/keyboard runs with `resize: 'none'`
// (capacitor.config.ts) — the WKWebView frame NEVER resizes when the keyboard
// opens; the keyboard just overlays the webview. This kills the whole-page
// relayout/flicker that `resize: 'native'` caused (the frame resize happened
// AFTER the keyboard animation, with up to ~1s of lag).
//
// Sheets are lifted above the keyboard here, in CSS: `client/lib/keyboard.ts`
// publishes the keyboard height to the `--keyboard-height` CSS var the moment
// `keyboardWillShow` fires (start of the keyboard animation). DrawerContent
// wraps the vaul sheet in a *lift wrapper* — a fixed, full-screen div with
// `transform: translateY(-var(--keyboard-height))` + transition. Because a
// transformed ancestor becomes the containing block for fixed descendants,
// translating the wrapper moves the whole sheet up in sync with the keyboard,
// GPU-accelerated, without ever touching the element vaul animates (vaul owns
// the sheet's inline transform/transition for open/close/drag — mutating those
// would fight it). Height caps come from `useKeyboardAwareHeight` +
// the `html.kb-open` clamp in global.css.
//
// vaul's `repositionInputs` MUST stay disabled: it mutates the sheet's inline
// `height`/`bottom` from visualViewport events that are unreliable inside
// WKWebView (stale height locks, double-movement), which is exactly what used
// to break every drawer with a text input on iPhone.

// Swipe para fechar vale no sheet INTEIRO — arrastar para baixo a partir de
// qualquer ponto do corpo fecha o drawer, que é o que o gesto do iOS ensina.
// O vaul já protege sozinho o que precisa ser protegido: um container rolável
// que não está no topo (`scrollTop !== 0`) e qualquer arraste para CIMA cancelam
// o dismiss, então rolar lista continua funcionando. A única exceção somos nós
// que marcamos: campos de formulário (ver `markFormFieldNoDrag` abaixo).
//
// `handleOnly` (repassado ao vaul): escape hatch — quando true, só a ALÇA
// arrasta e o corpo inteiro fica inerte. Está DESLIGADO em todos os drawers do
// app de propósito (matava o gesto no corpo todo para resolver um miss-click que
// hoje o `data-vaul-no-drag` resolve de forma cirúrgica). Se algum dia for
// preciso ligar, passe em ambos (`<Drawer>` e `<DrawerContent>`) — o
// DrawerContent precisa renderizar a alça como <Drawer.Handle>, que é a única
// que o vaul reconhece nesse modo.

// Campos de formulário não arrastam o sheet: puxar para baixo a partir de um
// input/textarea (tipicamente com o teclado aberto) fecharia o drawer e jogaria
// fora o que a pessoa estava digitando. `data-vaul-no-drag` é o atributo que o
// `shouldDrag` do vaul respeita; marcamos o campo no CAPTURE do pointerdown, que
// roda antes do handler do próprio vaul no mesmo elemento — assim vale para
// qualquer drawer do app, inclusive campos renderizados dinamicamente, sem
// precisar anotar um por um. (Não removemos o atributo: ele é permanente e
// correto para aquele campo.)
const FORM_FIELD_SELECTOR = "input, textarea, [contenteditable='true']";

const markFormFieldNoDrag = (event: React.PointerEvent) => {
  const target = event.target as HTMLElement | null;
  const field = target?.closest?.(FORM_FIELD_SELECTOR);
  if (field && !field.hasAttribute("data-vaul-no-drag")) {
    field.setAttribute("data-vaul-no-drag", "");
  }
};
const Drawer = ({
  shouldScaleBackground = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root
    shouldScaleBackground={shouldScaleBackground}
    repositionInputs={false}
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
>(({ className, style, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn("pointer-events-auto fixed inset-0 z-[300] bg-black/80", className)}
    style={{
      // The overlay rides inside the lift wrapper, so it travels up with the
      // keyboard: grow it downwards by the same amount so no strip of the
      // screen is left unpainted below it.
      bottom: "calc(-1 * var(--keyboard-height, 0px))",
      ...style,
    }}
    {...props}
  />
));
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & {
    overlayClassName?: string;
    handleClassName?: string;
    /** Espelha o `handleOnly` do <Drawer>: renderiza a alça como <Drawer.Handle>
     *  (a única que o vaul arrasta nesse modo) em vez de um div decorativo. */
    handleOnly?: boolean;
  }
>(({ className, children, overlayClassName, handleClassName, handleOnly, style, onPointerDownCapture, ...props }, ref) => {
  return (
    <DrawerPortal>
      {/* Lift wrapper: transformed ancestor = containing block for the fixed
          sheet below. Translating it raises the whole sheet above the iOS
          keyboard in sync with the keyboard animation (see header comment).
          The overlay MUST live inside it too: the transform makes the wrapper a
          stacking context, so a sheet that raises its z-index (nested drawers,
          the image cropper) only raises it *within* the wrapper — an overlay
          left outside would then paint on top of the sheet it is supposed to
          sit behind, blacking out the screen and swallowing every tap. */}
      <div
        className="pointer-events-none fixed inset-0 z-[310]"
        style={{
          transform: "translateY(calc(-1 * var(--keyboard-height, 0px)))",
          transition: "transform 0.28s cubic-bezier(0.38, 0.7, 0.125, 1)",
        }}
      >
        <DrawerOverlay className={overlayClassName} />
        <DrawerPrimitive.Content
          ref={ref}
          className={cn(
            "fixed bottom-0 z-[310] mt-24 flex h-auto w-full max-w-[680px] flex-col rounded-t-[10px] border bg-background md:rounded-xl",
            "left-0 right-0 mx-auto",
            className,
          )}
          style={{
            pointerEvents: "auto",
            // Com o teclado aberto o sheet fica em cima dele — o inset da home
            // bar deixa de fazer sentido; o max() zera o padding nesse caso.
            paddingBottom:
              "max(0px, calc(env(safe-area-inset-bottom) - var(--keyboard-height, 0px)))",
            paddingLeft: "env(safe-area-inset-left)",
            paddingRight: "env(safe-area-inset-right)",
            ...style,
          }}
          onPointerDownCapture={(event) => {
            markFormFieldNoDrag(event);
            onPointerDownCapture?.(event);
          }}
          {...props}
        >
          {handleOnly ? (
            // <Drawer.Handle> é a alça que o vaul reconhece no modo handleOnly.
            // Os estilos default do vaul (`[data-vaul-handle]`, injetados em
            // runtime) venceriam utilitárias de igual especificidade, então a
            // aparência da pílula é forçada com `!` (o mt/posição vem do
            // handleClassName). `preventCycle`: sem snap points, o clique não faz nada.
            <DrawerPrimitive.Handle
              preventCycle
              className={cn(
                "mx-auto mt-4 shrink-0 !h-1 !w-[38px] !rounded-full !bg-white/25 !opacity-100",
                handleClassName,
              )}
            />
          ) : (
            <div className={cn("mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full bg-muted", handleClassName)} />
          )}
          {children}
        </DrawerPrimitive.Content>
      </div>
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
