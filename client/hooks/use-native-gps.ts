import { registerPlugin, Capacitor } from "@capacitor/core";

interface GpsTrackingPlugin {
  start(): Promise<{ started: boolean }>;
  stop(): Promise<{ stopped: boolean }>;
  addListener(
    event: "location",
    handler: (data: {
      lat: number;
      lng: number;
      accuracy: number;
      altitude: number;
      speed: number;
      timestamp: number;
    }) => void
  ): Promise<{ remove: () => void }>;
  addListener(
    event: "error",
    handler: (data: { message: string }) => void
  ): Promise<{ remove: () => void }>;
  removeAllListeners(): Promise<void>;
}

const GpsTracking = registerPlugin<GpsTrackingPlugin>("GpsTrackingPlugin");

export const isNativeGpsSupported = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

/**
 * Requests location permission via the Web Geolocation API (triggers the iOS system dialog)
 * before starting the native plugin. Returns true if permission was granted.
 */
export const requestLocationPermission = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      (err) => resolve(err.code !== err.PERMISSION_DENIED),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
};

export { GpsTracking };
