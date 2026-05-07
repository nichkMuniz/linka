import { Capacitor, registerPlugin } from "@capacitor/core";
import type {
  BackgroundGeolocationPlugin,
  Location,
  CallbackError,
} from "@capacitor-community/background-geolocation";

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>(
  "BackgroundGeolocation"
);

type LocationHandler = (data: {
  lat: number;
  lng: number;
  accuracy: number;
  altitude: number;
  speed: number;
  timestamp: number;
}) => void;

type ErrorHandler = (data: { message: string }) => void;

let watcherId: string | null = null;
const locationHandlers = new Set<LocationHandler>();
const errorHandlers = new Set<ErrorHandler>();

const startWatcher = async () => {
  if (watcherId) return;
  watcherId = await BackgroundGeolocation.addWatcher(
    {
      backgroundMessage: "Rastreando sua corrida em segundo plano",
      backgroundTitle: "LinKa",
      requestPermissions: true,
      stale: false,
      distanceFilter: 0,
    },
    (location?: Location, error?: CallbackError) => {
      if (error) {
        const message =
          error.code === "NOT_AUTHORIZED" ? "PERMISSION_DENIED" : error.message || String(error.code);
        errorHandlers.forEach((h) => h({ message }));
        return;
      }
      if (!location) return;
      const payload = {
        lat: location.latitude,
        lng: location.longitude,
        accuracy: location.accuracy ?? 0,
        altitude: location.altitude ?? 0,
        speed: location.speed ?? 0,
        timestamp: location.time ?? Date.now(),
      };
      locationHandlers.forEach((h) => h(payload));
    }
  );
};

const stopWatcher = async () => {
  if (!watcherId) return;
  const id = watcherId;
  watcherId = null;
  await BackgroundGeolocation.removeWatcher({ id });
};

interface GpsTrackingApi {
  start(): Promise<{ started: boolean }>;
  stop(): Promise<{ stopped: boolean }>;
  addListener(event: "location", handler: LocationHandler): Promise<{ remove: () => void }>;
  addListener(event: "error", handler: ErrorHandler): Promise<{ remove: () => void }>;
  removeAllListeners(): Promise<void>;
}

export const GpsTracking: GpsTrackingApi = {
  async start() {
    await startWatcher();
    return { started: true };
  },
  async stop() {
    await stopWatcher();
    return { stopped: true };
  },
  async addListener(event: "location" | "error", handler: LocationHandler | ErrorHandler) {
    if (event === "location") {
      locationHandlers.add(handler as LocationHandler);
      return { remove: () => locationHandlers.delete(handler as LocationHandler) };
    }
    errorHandlers.add(handler as ErrorHandler);
    return { remove: () => errorHandlers.delete(handler as ErrorHandler) };
  },
  async removeAllListeners() {
    locationHandlers.clear();
    errorHandlers.clear();
  },
};

export const isNativeGpsSupported = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

/**
 * On native, the background-geolocation watcher will trigger the iOS permission
 * dialog automatically. On web, we still need the Web Geolocation prompt.
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
