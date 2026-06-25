import { Haptics, ImpactStyle } from "@capacitor/haptics";

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
