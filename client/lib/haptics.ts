import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

const isCapacitor = () =>
  typeof window !== "undefined" &&
  !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor?.isNativePlatform?.();

export async function hapticLight() {
  if (!isCapacitor()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {}
}

export async function hapticMedium() {
  if (!isCapacitor()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {}
}

export async function hapticHeavy() {
  if (!isCapacitor()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch {}
}

export async function hapticSuccess() {
  if (!isCapacitor()) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {}
}

export async function hapticError() {
  if (!isCapacitor()) return;
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch {}
}

export async function hapticWarning() {
  if (!isCapacitor()) return;
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch {}
}
