import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { BadgeMedallion, BADGE_ACCENT_GRADIENT } from "@/components/shared/badge-medallion";
import { badgeDescription, badgeName, subscribeBadgeAnnouncements } from "@/lib/badges";
import { hapticSuccess } from "@/lib/haptics";
import { useLanguage } from "@/lib/language-context";
import type { Badge } from "@/lib/ritmofit-db";
import {
  TOP_BANNER_HANDOFF_MS,
  isSystemBannerVisible,
  subscribeSystemBannerVisibility,
} from "@/lib/top-banner-slot";

/** Tempo em tela — um pouco mais que o aviso de mensagem: é para comemorar. */
const AUTO_DISMISS_MS = 6000;
/**
 * Medalhões visíveis na pilha quando são várias; o resto vira "+N". Dois (e
 * menores) para sobrar largura ao texto num iPhone de 375pt — com três
 * medalhões grandes o título truncava em "Primeiro treino, Pr…".
 */
const MAX_STACK = 2;

/**
 * Pop up "você conquistou uma insígnia" (2026-10-06) — substitui o toast
 * genérico do shadcn, que mostrava tudo numa linha de texto corrido
 * ("🏋️ Primeiro treino · 📸 Primeiro post · …") e espremia o login de quem
 * ganhava várias de uma vez.
 *
 * Mesmo lugar e gestos do aviso de mensagem (`IncomingMessageToast`): banner de
 * vidro no topo, respeitando a safe area, some sozinho, arrasta para cima para
 * dispensar, toque abre o drawer de insígnias em Metas. Não é modal de
 * propósito — pode aparecer por cima de qualquer tela ou overlay sem travar nada.
 *
 * Hierarquia: medalhão(ões) → "NOVA INSÍGNIA" (rótulo de acento) → nome (o que
 * a pessoa ganhou) → descrição (por quê) ou "toque para ver". Várias de uma vez
 * viram UM banner com a pilha de medalhões; uma conquista que chega com o
 * banner aberto entra nele e reinicia o tempo.
 *
 * Vez no topo (2026-10-06): o aviso de mensagem/notificação tem prioridade
 * (`top-banner-slot.ts`). Com ele na tela a insígnia fica na fila; se ele chega
 * com a insígnia aberta, ela sai e volta depois — com o tempo cheio, e o tempo
 * só corre enquanto ela está de fato visível.
 */
export function BadgeCelebrationBanner() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  // Fila de conquistas a mostrar (vazia = nada a comemorar).
  const [badges, setBadges] = React.useState<Badge[]>([]);
  // Reinicia animação e barra de tempo quando o conteúdo muda.
  const [tick, setTick] = React.useState(0);
  // O aviso do sistema está (ou acabou de sair) do topo → a insígnia espera.
  const [systemBusy, setSystemBusy] = React.useState(isSystemBannerVisible);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggedRef = React.useRef(false);

  const dismiss = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setBadges([]);
  }, []);

  React.useEffect(() => {
    return subscribeBadgeAnnouncements((incoming) => {
      setBadges((prev) => {
        const seen = new Set(prev.map((b) => String(b.id)));
        const fresh = incoming.filter((b) => !seen.has(String(b.id)));
        return fresh.length > 0 ? [...prev, ...fresh] : prev;
      });
      setTick((n) => n + 1);
    });
  }, []);

  // Ocupa na hora; libera só depois da folga, para a saída do aviso terminar
  // antes de a insígnia entrar no mesmo lugar.
  React.useEffect(() => {
    let handoff: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeSystemBannerVisibility((visible) => {
      if (handoff) clearTimeout(handoff);
      handoff = null;
      if (visible) setSystemBusy(true);
      else handoff = setTimeout(() => setSystemBusy(false), TOP_BANNER_HANDOFF_MS);
    });
    return () => {
      unsubscribe();
      if (handoff) clearTimeout(handoff);
    };
  }, []);

  const visible = badges.length > 0 && !systemBusy;

  // O relógio só anda com o banner na tela. Voltar depois de ceder a vez (ou
  // ganhar mais uma insígnia) recomeça os 6 s e vibra de novo.
  React.useEffect(() => {
    if (!visible) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      return;
    }
    void hapticSuccess();
    timerRef.current = setTimeout(() => setBadges([]), AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [visible, tick]);

  const open = () => {
    dismiss();
    navigate("/metas", { state: { openBadges: true } });
  };

  const count = badges.length;
  const single = count === 1 ? badges[0] : null;
  const kicker =
    count === 1
      ? t("badge_banner_kicker_one")
      : t("badge_banner_kicker_many").replace("{n}", String(count));
  // Várias: "Primeiro treino e mais 5" — um nome inteiro lê melhor que dois cortados.
  // Sem insígnias (o estado normal, banner fechado) não há título: `badges[0]`
  // não existe e o banner mora no AppLayout — quebrar aqui derrubaria o app.
  const title =
    count === 0
      ? ""
      : single
        ? badgeName(single, t)
        : badgeName(badges[0], t) + t("badge_banner_more").replace("{n}", String(count - 1));
  const subtitle = single ? badgeDescription(single, t) : t("badge_banner_cta");
  const stack = single ? badges : badges.slice(0, MAX_STACK);
  const overflow = count - stack.length;
  const medallionSize = single ? "md" : "sm";

  return (
    <div
      className="fixed inset-x-0 z-[9999] flex justify-center px-3 pointer-events-none"
      style={{ top: "max(12px, env(safe-area-inset-top))" }}
      role="status"
      aria-live="polite"
    >
      <AnimatePresence>
        {visible && (
          <motion.button
            key={`badge-banner-${tick}`}
            type="button"
            aria-label={`${kicker}: ${title}. ${t("badge_banner_aria")}`}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.5, bottom: 0 }}
            onDragStart={() => { draggedRef.current = true; }}
            onDragEnd={(_, info) => {
              if (info.offset.y < -32) dismiss();
              requestAnimationFrame(() => { draggedRef.current = false; });
            }}
            onClick={() => {
              if (draggedRef.current) return;
              open();
            }}
            initial={{ opacity: 0, y: -32, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -22, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 24 }}
            // Borda em degradê: o "aro" de 1px é o fundo deste botão; o vidro
            // vem por dentro.
            className="pointer-events-auto relative w-full max-w-[420px] rounded-[24px] p-px text-left active:scale-[0.98] transition-transform"
            style={{
              background: "linear-gradient(135deg,rgba(255,200,120,.85),rgba(255,122,60,.35) 45%,rgba(157,107,255,.45))",
              boxShadow: "0 18px 40px -12px rgba(0,0,0,.75), 0 0 32px -10px rgba(255,138,42,.55)",
            }}
          >
            <div
              className="relative overflow-hidden rounded-[23px]"
              style={{
                background: "linear-gradient(135deg,rgba(46,32,28,.92),rgba(18,15,24,.94))",
                backdropFilter: "blur(24px) saturate(180%)",
                WebkitBackdropFilter: "blur(24px) saturate(180%)",
              }}
            >
              {/* Brilho que atravessa o card uma vez, na entrada. */}
              <motion.span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-1/3"
                style={{ background: "linear-gradient(100deg,transparent,rgba(255,220,170,.18),transparent)" }}
                initial={{ left: "-40%" }}
                animate={{ left: "120%" }}
                transition={{ duration: 1.1, delay: 0.25, ease: "easeOut" }}
              />

              <div className="relative flex items-center gap-3 px-3.5 py-3">
                {/* Pilha de medalhões */}
                <div className="flex shrink-0 items-center">
                  {stack.map((b, i) => (
                    <motion.span
                      key={b.id}
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 420, damping: 18, delay: 0.08 + i * 0.07 }}
                      style={{ marginLeft: i === 0 ? 0 : -10, zIndex: MAX_STACK - i + 1 }}
                      className="relative rounded-full"
                    >
                      <BadgeMedallion
                        emoji={b.emoji}
                        size={medallionSize}
                        glow={i === 0}
                        style={{ boxShadow: i === 0 ? undefined : "0 0 0 2px #1a141d" }}
                      />
                    </motion.span>
                  ))}
                  {overflow > 0 && (
                    // Fica POR BAIXO do último medalhão (z 0) e começa escondido
                    // atrás dele — o padding da esquerda garante o "+N" inteiro.
                    <span
                      className="relative flex h-[30px] items-center justify-center rounded-full pr-2 text-[12px] font-extrabold text-white tabular-nums"
                      style={{
                        marginLeft: -10,
                        paddingLeft: 14,
                        zIndex: 0,
                        background: "rgba(255,255,255,.12)",
                        border: "1px solid rgba(255,255,255,.18)",
                      }}
                    >
                      +{overflow}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className="text-[11px] font-extrabold uppercase tracking-[0.08em] leading-none bg-clip-text text-transparent"
                    style={{ backgroundImage: BADGE_ACCENT_GRADIENT }}
                  >
                    {kicker}
                  </p>
                  <p className="mt-1 truncate text-[15px] font-bold leading-tight text-white">{title}</p>
                  <p className="mt-0.5 truncate text-[12.5px] leading-tight text-white/65">{subtitle}</p>
                </div>

                <ChevronRight className="h-5 w-5 shrink-0 text-white/45" />
              </div>

              {/* Tempo restante — diz que o aviso vai sumir sozinho. */}
              <motion.span
                aria-hidden
                className="absolute bottom-0 left-0 h-[2px]"
                style={{ background: BADGE_ACCENT_GRADIENT }}
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: AUTO_DISMISS_MS / 1000, ease: "linear" }}
              />
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
