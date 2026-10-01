import * as React from "react";
import { Pin, PinOff, Loader2 } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/language-context";
import { FLOW_PIN_TITLE_MAX } from "@/lib/ritmofit-db";
import {
  GLASS_SHEET_PROPS,
  GLASS_SHEET_STYLE,
  GLASS_FIELD_STYLE,
  GLASS_FIELD_CLASS,
  GLASS_LABEL_CLASS,
} from "@/lib/glass-styles";

/**
 * "Fixar no perfil" — fonte única de fixar/renomear/desafixar um flow, usada na
 * criação (antes de postar), no FlowViewer (dono) e no Arquivo de flows.
 *
 * - `pinned = false`: título "Fixar no perfil", campo de nome e botão "Fixar".
 * - `pinned = true`:  mesmo campo já preenchido (renomear) + "Desafixar".
 *
 * Não fala com o banco: quem abre decide o que `onConfirm`/`onUnpin` fazem
 * (na criação, por exemplo, só guarda a escolha até o flow ser publicado).
 */
export function PinFlowDrawer({
  open,
  onOpenChange,
  pinned,
  initialTitle,
  onConfirm,
  onUnpin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** O flow já está fixado (modo renomear). */
  pinned: boolean;
  initialTitle?: string | null;
  /** Fixar (ou salvar o novo nome). Rejeitar mantém o drawer aberto. */
  onConfirm: (title: string | null) => Promise<void> | void;
  onUnpin?: () => Promise<void> | void;
}) {
  const { t } = useLanguage();
  const [title, setTitle] = React.useState(initialTitle ?? "");
  const [busy, setBusy] = React.useState<"confirm" | "unpin" | null>(null);

  // Reabrir sempre parte do nome atual — não do que ficou digitado e foi descartado.
  React.useEffect(() => {
    if (open) setTitle(initialTitle ?? "");
  }, [open, initialTitle]);

  const run = async (kind: "confirm" | "unpin") => {
    if (busy) return;
    setBusy(kind);
    try {
      if (kind === "confirm") await onConfirm(title.trim() || null);
      else await onUnpin?.();
      onOpenChange(false);
    } catch {
      // Quem chamou já avisou (toast); o drawer fica aberto para tentar de novo.
    } finally {
      setBusy(null);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DrawerContent {...GLASS_SHEET_PROPS} style={GLASS_SHEET_STYLE} onOpenAutoFocus={(e) => e.preventDefault()}>
        <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center gap-2" style={{ color: "#fff" }}>
            <Pin className="h-5 w-5 text-amber-300" fill={pinned ? "currentColor" : "none"} />
            {pinned ? t("flow_pin_drawer_edit_title") : t("flow_pin_drawer_title")}
          </DrawerTitle>
          <DrawerDescription style={{ color: "rgba(255,255,255,.6)" }}>
            {t("flow_pin_drawer_desc")}
          </DrawerDescription>
        </DrawerHeader>

        <form
          className="px-4 space-y-4"
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
          onSubmit={(e) => { e.preventDefault(); void run("confirm"); }}
        >
          <div className="space-y-1.5">
            <label htmlFor="pin-flow-title" className={GLASS_LABEL_CLASS}>
              {t("flow_pin_name_label")}
            </label>
            <Input
              id="pin-flow-title"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, FLOW_PIN_TITLE_MAX))}
              placeholder={t("flow_pin_name_placeholder")}
              maxLength={FLOW_PIN_TITLE_MAX}
              enterKeyHint="done"
              className={`h-12 rounded-2xl ${GLASS_FIELD_CLASS}`}
              style={GLASS_FIELD_STYLE}
            />
            <div className="flex justify-between text-[11px]" style={{ color: "rgba(255,255,255,.45)" }}>
              <span>{t("flow_pin_name_hint")}</span>
              <span>{title.length}/{FLOW_PIN_TITLE_MAX}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={!!busy}
            className="w-full h-12 rounded-full bg-white text-[#0a0b12] text-[15px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {busy === "confirm" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Pin className="h-[18px] w-[18px]" />}
            {pinned ? t("flow_pin_save") : t("flow_pin_confirm")}
          </button>

          {pinned && onUnpin && (
            <button
              type="button"
              onClick={() => void run("unpin")}
              disabled={!!busy}
              className="w-full h-12 rounded-full text-[15px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
              style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", color: "#f87171" }}
            >
              {busy === "unpin" ? <Loader2 className="h-5 w-5 animate-spin" /> : <PinOff className="h-[18px] w-[18px]" />}
              {t("flow_unpin_action")}
            </button>
          )}
        </form>
      </DrawerContent>
    </Drawer>
  );
}
