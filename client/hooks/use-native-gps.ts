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

export { GpsTracking };
