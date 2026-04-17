import Foundation
import Capacitor
import CoreLocation

/// Capacitor plugin that provides background-capable GPS tracking.
///
/// JS API:
///   GpsTrackingPlugin.start()
///   GpsTrackingPlugin.stop()
///   GpsTrackingPlugin.addListener("location", handler)
///   GpsTrackingPlugin.addListener("error", handler)
@objc(GpsTrackingPlugin)
public class GpsTrackingPlugin: CAPPlugin, CLLocationManagerDelegate {

    private var locationManager: CLLocationManager?

    // MARK: - Start

    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let manager = CLLocationManager()
            manager.delegate = self
            manager.desiredAccuracy = kCLLocationAccuracyBest
            manager.distanceFilter = kCLDistanceFilterNone
            manager.pausesLocationUpdatesAutomatically = false

            // Required for background location (screen locked)
            if manager.responds(to: #selector(getter: CLLocationManager.allowsBackgroundLocationUpdates)) {
                manager.allowsBackgroundLocationUpdates = true
            }

            self.locationManager = manager

            let status = manager.authorizationStatus
            switch status {
            case .notDetermined:
                manager.requestAlwaysAuthorization()
                // Will start updates after authorization is granted (delegate callback)
            case .authorizedAlways, .authorizedWhenInUse:
                manager.startUpdatingLocation()
            default:
                call.reject("Permissão de localização negada")
                return
            }

            call.resolve(["started": true])
        }
    }

    // MARK: - Stop

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.locationManager?.stopUpdatingLocation()
            self.locationManager = nil
            call.resolve(["stopped": true])
        }
    }

    // MARK: - CLLocationManagerDelegate

    public func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        if status == .authorizedAlways || status == .authorizedWhenInUse {
            manager.startUpdatingLocation()
        } else if status == .denied || status == .restricted {
            notifyListeners("error", data: ["message": "Permissão de localização negada"])
        }
    }

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        notifyListeners("location", data: [
            "lat": loc.coordinate.latitude,
            "lng": loc.coordinate.longitude,
            "accuracy": loc.horizontalAccuracy,
            "altitude": loc.altitude,
            "speed": loc.speed >= 0 ? loc.speed : 0,
            "timestamp": loc.timestamp.timeIntervalSince1970 * 1000
        ])
    }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        notifyListeners("error", data: ["message": error.localizedDescription])
    }
}
