import WidgetKit
import SwiftUI

@main
struct LinkaWorkoutWidgetBundle: WidgetBundle {
    var body: some Widget {
        if #available(iOS 16.1, *) {
            LinkaWorkoutLiveActivity()
        }
    }
}
