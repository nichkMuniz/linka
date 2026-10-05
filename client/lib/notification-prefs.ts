/**
 * Preferências de notificação do aparelho (Configurações → Notificações).
 *
 * Moram no `localStorage` — cada interruptor é aplicado no próprio app
 * (lembretes locais de rotina, registro do token APNs). A exceção é
 * `reminders` ("Lembretes e novidades"): quem envia é o SERVIDOR
 * (`supabase/functions/reengagement-push`), então o valor também sobe para
 * `user_activity.reminders_enabled` via `touchUserActivityDb`.
 */

export const NOTIF_PREFS_KEY = "linka_notif_prefs";

export const DEFAULT_NOTIF_PREFS = {
  workoutReminders: true,
  achievementAlerts: true,
  friendActivity: true,
  messages: true,
  /** Lembretes de volta ao app: posts novos de quem você segue, dias sem entrar. */
  reminders: true,
  sound: true,
};

export type NotifPrefs = typeof DEFAULT_NOTIF_PREFS;

export function readNotifPrefs(): NotifPrefs {
  try {
    const stored = localStorage.getItem(NOTIF_PREFS_KEY);
    if (stored) return { ...DEFAULT_NOTIF_PREFS, ...(JSON.parse(stored) as Partial<NotifPrefs>) };
  } catch {
    // Sem storage (modo privado / bloqueado): vale o padrão.
  }
  return { ...DEFAULT_NOTIF_PREFS };
}

export function writeNotifPrefs(prefs: NotifPrefs): void {
  try {
    localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Sem storage: a preferência vale só nesta sessão.
  }
}
