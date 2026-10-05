import { useEffect } from "react";
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
// Import dinâmico: este hook é chamado pelo `RequireAuth`, que vive no App.tsx
// — uma importação estática daqui prendia o `ritmofit-db` inteiro no chunk de
// entrada. As duas funções só rodam dentro de callbacks assíncronos do plugin
// de push (registro do token e logout), muito depois do primeiro frame.
const db = () => import("@/lib/ritmofit-db");

const PUSH_TOKEN_KEY = "linka_push_token";

/**
 * Registers the device for remote push notifications via @capacitor/push-notifications.
 * - Requests permission from the OS
 * - Saves the APNs device token to Supabase so the Edge Function can send pushes
 * - Handles incoming push notifications (foreground + tap from background/closed)
 *
 * Call this hook once in App.tsx after the user is authenticated.
 */
export function usePushNotifications(userId: string | null) {
  useEffect(() => {
    if (!userId) return;
    // Only run on real iOS/Android — skip in browser/PWA context
    if (!Capacitor.isNativePlatform()) return;

    let isMounted = true;

    const setup = async () => {
      // 1. Check / request permission
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === "prompt") {
        permStatus = await PushNotifications.requestPermissions();
      }
      if (permStatus.receive !== "granted") return;

      // 2. Ouvintes ANTES do register(): o plugin não guarda o evento
      // "registration" (sem retainUntilConsumed) — se o iOS devolve o token
      // antes do addListener, ele se perde e o aparelho fica sem push.
      //
      // Grava SEMPRE, mesmo com o token igual ao do localStorage: a linha no
      // banco pode ter sumido (a edge function apaga token recusado pela
      // Apple; outra conta no mesmo iPhone reivindica o token), e o atalho
      // "não mudou, não grava" deixava o aparelho mudo para sempre.
      // `claim_push_token` é idempotente — uma chamada por sessão.
      const regListener = await PushNotifications.addListener("registration", async (token) => {
        if (!isMounted) return;
        await (await db()).savePushTokenDb(token.value, "ios");
        localStorage.setItem(PUSH_TOKEN_KEY, token.value);
      });

      const errListener = await PushNotifications.addListener("registrationError", (err) => {
        console.error("Push registration error:", err.error);
      });

      // 5. Push received while app is in FOREGROUND
      // (background/closed pushes are handled by the OS natively — no code needed)
      const fgListener = await PushNotifications.addListener(
        "pushNotificationReceived",
        (_notification) => {
          // iOS shows the banner via presentationOptions in capacitor.config.ts.
          // Badge count is handled separately via Supabase Realtime in app-layout.
        }
      );

      // 6. User tapped the notification
      const tapListener = await PushNotifications.addListener(
        "pushNotificationActionPerformed",
        (action) => {
          const url: string = action.notification.data?.url || "/notificacoes";
          // Use hash navigation since the app may be re-launching
          window.location.href = url.startsWith("/") ? url : `/${url}`;
        }
      );

      // 7. Só agora pede o token à Apple (ouvintes já estão no lugar).
      await PushNotifications.register();

      return () => {
        regListener.remove();
        errListener.remove();
        fgListener.remove();
        tapListener.remove();
      };
    };

    let cleanup: (() => void) | undefined;
    setup().then((fn) => { cleanup = fn; });

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [userId]);

  /**
   * Call on logout to remove the token from Supabase so the user
   * stops receiving pushes after signing out.
   */
  const unregister = async () => {
    if (!Capacitor.isNativePlatform()) return;
    const token = localStorage.getItem(PUSH_TOKEN_KEY);
    if (token) {
      await (await db()).deletePushTokenDb(token);
      localStorage.removeItem(PUSH_TOKEN_KEY);
    }
    await PushNotifications.unregister();
  };

  return { unregister };
}
