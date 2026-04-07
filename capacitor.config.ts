import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.linka.meuapp',
  appName: 'Linka',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
