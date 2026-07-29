import UIKit
import Capacitor

class ViewController: CAPBridgeViewController {
    // Plugins locais (fora de node_modules) não entram no `packageClassList` do
    // capacitor.config.json, então precisam ser registrados na mão aqui.
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(EditedMediaPlugin())
    }
}
