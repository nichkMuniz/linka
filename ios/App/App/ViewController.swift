import UIKit
import Capacitor

class ViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(GpsTrackingPlugin())
        bridge?.registerPluginInstance(LinkaBiometricPlugin())
        bridge?.registerPluginInstance(WorkoutActivityPlugin())
    }
}
