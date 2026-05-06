import Foundation
import Capacitor
import CoreLocation

@objc(GpsTrackingPlugin)
public class GpsTrackingPlugin: CAPPlugin, CLLocationManagerDelegate {

    private var locationManager: CLLocationManager?
    private var pendingStartCall: CAPPluginCall?

    // MARK: - Start

    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            // Stop any previous session before starting a new one
            self.locationManager?.stopUpdatingLocation()
            self.pendingStartCall = nil

            let manager = CLLocationManager()
            manager.delegate = self
            manager.desiredAccuracy = kCLLocationAccuracyBest
            manager.distanceFilter = kCLDistanceFilterNone
            manager.pausesLocationUpdatesAutomatically = false
            manager.allowsBackgroundLocationUpdates = true
            self.locationManager = manager

            let status = manager.authorizationStatus
            switch status {
            case .notDetermined:
                self.pendingStartCall = call
                manager.requestAlwaysAuthorization()
            case .authorizedAlways, .authorizedWhenInUse:
                manager.startUpdatingLocation()
                call.resolve(["started": true])
            case .denied, .restricted:
                call.reject("PERMISSION_DENIED")
            @unknown default:
                call.reject("UNKNOWN_AUTH_STATUS")
            }
        }
    }

    // MARK: - Stop

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.locationManager?.stopUpdatingLocation()
            self.locationManager = nil
            self.pendingStartCall = nil
            call.resolve(["stopped": true])
        }
    }

    // MARK: - CLLocationManagerDelegate

    public func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        if status == .authorizedAlways || status == .authorizedWhenInUse {
            manager.startUpdatingLocation()
            pendingStartCall?.resolve(["started": true])
            pendingStartCall = nil
        } else if status == .denied || status == .restricted {
            pendingStartCall?.reject("PERMISSION_DENIED")
            pendingStartCall = nil
            notifyListeners("error", data: ["message": "PERMISSION_DENIED"])
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
