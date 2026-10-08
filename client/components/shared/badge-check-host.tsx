import * as React from "react";

import { BadgeCelebrationBanner } from "@/components/shared/badge-celebration-banner";
import { awardMyBadgesDb } from "@/lib/ritmofit-db";
import { announceBadges, subscribeBadgeCheckRequests } from "@/lib/badges";
import { FEATURES } from "@/lib/feature-flags";
import { reportHandledError } from "@/lib/monitoring";

/** Espera depois do último pedido: uma rajada de incentivos vira uma avaliação só. */
const CHECK_DEBOUNCE_MS = 1500;
/** Primeira avaliação depois do login/abertura — deixa a tela inicial carregar antes. */
const FIRST_CHECK_DELAY_MS = 2500;

/**
 * Avalia insígnias fora da tela de Metas (2026-10-06) e comemora com o
 * `BadgeCelebrationBanner` — em qualquer tela; o toque leva ao drawer de insígnias.
 *
 * Roda quando:
 *  - o app abre / o usuário entra (insígnias passivas, como seguidores, e as
 *    que quem já usava o app tinha alcançado antes da v2);
 *  - alguma escrita pede (`requestBadgeCheck` em post, flow, rotina,
 *    incentivo, desafio) ou o app volta do segundo plano (AppLayout).
 *
 * Banner e não o diálogo grande de propósito: o diálogo é modal (Radix) e, por
 * cima de um overlay aberto (resumo do treino, criador de flow), travaria a
 * tela por trás. O diálogo fica para o fim do treino, onde Metas controla a vez.
 */
export function BadgeCheckHost({ userId }: { userId: string | null }) {
  React.useEffect(() => {
    if (!FEATURES.badges || !userId) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let running = false;
    let again = false;

    const run = async () => {
      timer = null;
      if (running) {
        again = true;
        return;
      }
      running = true;
      try {
        const { awarded } = await awardMyBadgesDb();
        if (!disposed) announceBadges(awarded);
      } catch (err: any) {
        // PGRST202 = banco sem a migração 20261006-badges-v2 (a RPC não existe):
        // nada a reportar, só não há insígnias ainda.
        if (err?.code !== "PGRST202") reportHandledError(err, "badges:check");
      } finally {
        running = false;
        if (again && !disposed) {
          again = false;
          schedule(CHECK_DEBOUNCE_MS);
        }
      }
    };

    const schedule = (delay: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void run(), delay);
    };

    schedule(FIRST_CHECK_DELAY_MS);
    const unsubscribe = subscribeBadgeCheckRequests(() => schedule(CHECK_DEBOUNCE_MS));
    return () => {
      disposed = true;
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [userId]);

  return FEATURES.badges ? <BadgeCelebrationBanner /> : null;
}
