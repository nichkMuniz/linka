// Biometric login (Face ID / Touch ID) wrapper.
//
// Apple-recommended pattern: the email/password are stored in the iOS Keychain
// and access to them is gated behind a biometric prompt (verifyIdentity). After
// the gate passes we read the credentials back and call signInWithPassword.
//
// Everything here is defensive: on web (`pnpm dev`) or when the plugin/hardware
// is unavailable, calls resolve to "not available" instead of throwing, so the
// login screen keeps working as a plain email/password form.

import { Capacitor } from "@capacitor/core";
import {
  NativeBiometric,
  BiometryType,
} from "@capgo/capacitor-native-biometric";

// Keychain entry key — one credential pair per device (single logged-in account).
const SERVER = "com.linka.meuapp";

// localStorage flag: whether the user opted in to biometric login.
const BIOMETRIC_ENABLED_KEY = "linka_biometric_enabled";

export interface BiometricSupport {
  available: boolean;
  /** Human-friendly biometry name for UI copy ("Face ID" / "Touch ID" / "Biometria"). */
  label: string;
}

/** True only on a native iOS/Android build with biometric hardware enrolled. */
export async function isBiometricSupported(): Promise<BiometricSupport> {
  if (!Capacitor.isNativePlatform()) {
    return { available: false, label: "Biometria" };
  }
  try {
    const result = await NativeBiometric.isAvailable({ useFallback: false });
    return {
      available: result.isAvailable,
      label: getBiometryLabel(result.biometryType),
    };
  } catch {
    return { available: false, label: "Biometria" };
  }
}

/** Human-friendly name of the device's biometry, for UI copy. */
function getBiometryLabel(biometryType: BiometryType): string {
  switch (biometryType) {
    case BiometryType.FACE_ID:
    case BiometryType.FACE_AUTHENTICATION:
      return "Face ID";
    case BiometryType.TOUCH_ID:
    case BiometryType.FINGERPRINT:
      return "Touch ID";
    default:
      return "Biometria";
  }
}

/** Whether the user has opted in to biometric login (local flag). */
export function isBiometricEnabled(): boolean {
  try {
    return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Ask for biometric confirmation, then persist the credentials in the Keychain
 * and mark biometric login as enabled. Returns true on success.
 */
export async function enableBiometric(
  email: string,
  password: string,
): Promise<boolean> {
  const { available } = await isBiometricSupported();
  if (!available) return false;

  await NativeBiometric.verifyIdentity({
    reason: "Confirme sua identidade para ativar o login por biometria.",
    title: "Ativar login por biometria",
  });

  await NativeBiometric.setCredentials({
    username: email,
    password,
    server: SERVER,
  });

  try {
    localStorage.setItem(BIOMETRIC_ENABLED_KEY, "1");
  } catch {
    // ignore storage failures
  }
  return true;
}

/** Remove stored credentials from the Keychain and clear the enabled flag. */
export async function disableBiometric(): Promise<void> {
  try {
    localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
  } catch {
    // ignore
  }
  try {
    await NativeBiometric.deleteCredentials({ server: SERVER });
  } catch {
    // credentials may already be gone — non-fatal
  }
}

/**
 * Prompt for biometrics and, on success, return the stored credentials.
 * Throws if the user cancels/fails the biometric prompt or no credentials exist.
 */
export async function authenticateWithBiometric(): Promise<{
  email: string;
  password: string;
}> {
  await NativeBiometric.verifyIdentity({
    reason: "Entre na sua conta com biometria.",
    title: "Entrar no LinKa",
  });

  const credentials = await NativeBiometric.getCredentials({ server: SERVER });
  return { email: credentials.username, password: credentials.password };
}
