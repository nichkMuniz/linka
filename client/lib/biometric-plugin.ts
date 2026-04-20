import { registerPlugin } from "@capacitor/core";

export interface BiometricPlugin {
  isAvailable(options: { useFallback?: boolean }): Promise<{ isAvailable: boolean; biometryType?: string; errorCode?: number }>;
  verifyIdentity(options: { reason?: string; title?: string; useFallback?: boolean }): Promise<void>;
  setCredentials(options: { username: string; password: string; server: string }): Promise<void>;
  getCredentials(options: { server: string }): Promise<{ username: string; password: string }>;
  deleteCredentials(options: { server: string }): Promise<void>;
}

export const NativeBiometric = registerPlugin<BiometricPlugin>("LinkaBiometric");
