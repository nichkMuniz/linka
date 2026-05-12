import { registerPlugin, Capacitor } from "@capacitor/core";

interface IsAvailableOptions {
  useFallback?: boolean;
}

interface IsAvailableResult {
  isAvailable: boolean;
  biometryType?: "face" | "fingerprint";
  errorCode?: number;
}

interface VerifyIdentityOptions {
  reason?: string;
  title?: string;
  useFallback?: boolean;
}

interface SetCredentialsOptions {
  username: string;
  password: string;
  server: string;
}

interface GetCredentialsOptions {
  server: string;
}

interface Credentials {
  username: string;
  password: string;
}

interface DeleteCredentialsOptions {
  server: string;
}

export interface BiometricPlugin {
  isAvailable(options?: IsAvailableOptions): Promise<IsAvailableResult>;
  verifyIdentity(options?: VerifyIdentityOptions): Promise<void>;
  setCredentials(options: SetCredentialsOptions): Promise<void>;
  getCredentials(options: GetCredentialsOptions): Promise<Credentials>;
  deleteCredentials(options: DeleteCredentialsOptions): Promise<void>;
}

const isNative = Capacitor.isNativePlatform();

const webStub: BiometricPlugin = {
  async isAvailable() {
    return { isAvailable: false };
  },
  async verifyIdentity() {
    throw new Error("Biometria disponível apenas em dispositivo iOS.");
  },
  async setCredentials() {
    throw new Error("Biometria disponível apenas em dispositivo iOS.");
  },
  async getCredentials() {
    throw new Error("Credenciais não encontradas");
  },
  async deleteCredentials() {
    /* no-op */
  },
};

export const NativeBiometric: BiometricPlugin = isNative
  ? registerPlugin<BiometricPlugin>("LinkaBiometric")
  : webStub;
