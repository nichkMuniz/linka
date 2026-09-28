import * as React from "react";
import { cn } from "@/lib/utils";
import { renderHighlightedInput } from "@/lib/post-visuals";

/** Classes base do `Textarea` do shadcn (`components/ui/textarea.tsx`). */
export const SHADCN_TEXTAREA_CLASS =
  "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export interface HighlightTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  /** Cor do placeholder (ele é desenhado na camada espelho). */
  placeholderColor?: string;
  /** Cor do cursor. Padrão branco — todos os campos de legenda são escuros. */
  caretColor?: string;
  /** Classes do wrapper `relative` (ex.: largura/flex no layout do pai). */
  wrapperClassName?: string;
}

/**
 * `<textarea>` que pinta #hashtags e @menções de azul ENQUANTO se digita.
 *
 * Um textarea não colore trechos do próprio texto, então a técnica é a da
 * "camada espelho": uma `<div>` atrás, com EXATAMENTE a mesma caixa (classes,
 * estilo, padding, fonte, quebra de linha), desenha o texto colorido; o
 * textarea real fica por cima com o texto transparente — só o cursor e a
 * seleção aparecem. A rolagem do espelho segue a do campo.
 *
 * Regras para não desalinhar o cursor:
 *  - o espelho usa `renderHighlightedInput`, que muda só a COR (nunca o peso);
 *  - a mesma `className`/`style` vai para os dois elementos; o espelho só
 *    ganha `display:block` (o `flex` do shadcn transformaria cada trecho em
 *    item flex) e o textarea perde fundo/borda visíveis (quem desenha é o
 *    espelho, atrás).
 *  - o placeholder também é desenhado no espelho: com o texto do campo
 *    transparente, o do WebKit ficaria invisível.
 *
 * O `ref` aponta para o textarea real — `MentionSuggestions` e os hooks de
 * teclado continuam funcionando sem mudança.
 */
export const HighlightTextarea = React.forwardRef<HTMLTextAreaElement, HighlightTextareaProps>(
  (
    {
      value,
      className,
      style,
      placeholder,
      placeholderColor = "rgba(255,255,255,.4)",
      caretColor = "#fff",
      wrapperClassName,
      onScroll,
      ...props
    },
    ref,
  ) => {
    const innerRef = React.useRef<HTMLTextAreaElement>(null);
    const mirrorRef = React.useRef<HTMLDivElement>(null);
    React.useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

    const syncScroll = React.useCallback(() => {
      if (mirrorRef.current && innerRef.current) {
        mirrorRef.current.scrollTop = innerRef.current.scrollTop;
      }
    }, []);
    // Digitar no fim de um texto longo rola o campo sem disparar `scroll` em
    // todo WebKit — ressincroniza a cada mudança de valor.
    React.useLayoutEffect(syncScroll, [value, syncScroll]);

    return (
      <div className={cn("relative", wrapperClassName)}>
        <div
          ref={mirrorRef}
          aria-hidden="true"
          className={cn("hl-textarea-mirror", className)}
          style={{
            ...style,
            position: "absolute",
            inset: 0,
            height: "auto",
            minHeight: 0,
            display: "block",
            overflow: "hidden",
            whiteSpace: "pre-wrap",
            overflowWrap: "break-word",
            wordBreak: "break-word",
            pointerEvents: "none",
          }}
        >
          {value ? (
            <>
              {renderHighlightedInput(value)}
              {/* Mantém a última linha vazia quando o texto termina em "\n". */}
              {"​"}
            </>
          ) : (
            <span style={{ color: placeholderColor }}>{placeholder}</span>
          )}
        </div>
        <textarea
          ref={innerRef}
          value={value}
          placeholder={placeholder}
          className={cn("hl-textarea-input", className)}
          style={{
            ...style,
            position: "relative",
            background: "transparent",
            backdropFilter: "none",
            WebkitBackdropFilter: "none",
            borderColor: "transparent",
            boxShadow: "none",
            color: "transparent",
            WebkitTextFillColor: "transparent",
            caretColor,
          }}
          onScroll={(e) => {
            syncScroll();
            onScroll?.(e);
          }}
          {...props}
        />
      </div>
    );
  },
);
HighlightTextarea.displayName = "HighlightTextarea";
