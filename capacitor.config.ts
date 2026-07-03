import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.linka.meuapp',
  appName: 'Linka',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Browser: {
      presentationStyle: 'popover',
    },
    Keyboard: {
      // 'native' encolhe o frame do WKWebView quando o teclado abre. Assim,
      // drawers/inputs fixados em bottom-0 ficam automaticamente acima do
      // teclado, e caps de altura em dvh / useKeyboardAwareHeight passam a
      // refletir a área realmente visível. Também impede o WKWebView de
      // "empurrar" a página inteira para revelar o input focado.
      resize: 'native',
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
