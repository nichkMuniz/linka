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
      // 'none': o frame do WKWebView NUNCA é redimensionado quando o teclado
      // abre — o teclado apenas sobrepõe o webview. Isso elimina o relayout/
      // repaint da página inteira (a "piscada" + delay de ~1s que o modo
      // 'native' causava: o resize do frame acontece DEPOIS da animação do
      // teclado e força reflow global).
      // Quem posiciona a UI acima do teclado é o JS/CSS: client/lib/keyboard.ts
      // escuta keyboardWillShow/Hide (síncronos com a animação do teclado) e
      // publica a altura na CSS var --keyboard-height; drawer.tsx/dialog.tsx
      // usam essa var para erguer sheets e dialogs em sincronia com o teclado.
      resize: 'none',
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
