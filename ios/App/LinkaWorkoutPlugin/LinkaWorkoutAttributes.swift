import ActivityKit
import Foundation

/// Shared data model for the Linka Workout Live Activity.
/// Compiled into both the App target (via LinkaWorkoutPlugin) and the
/// LinkaWorkoutWidget extension target so both sides agree on the type.
public struct LinkaWorkoutAttributes: ActivityAttributes {

    public static let activityType = "com.linka.meuapp.workout"

    public struct ContentState: Codable, Hashable {
        var exerciseName: String
        var seriesLabel: String
        /// Absolute start date — used by SwiftUI Text(.timer) to auto-advance on lock screen.
        var startDate: Date
        /// Elapsed seconds frozen at the moment the workout was paused (used only when isPaused == true).
        var pausedElapsedSeconds: Int
        var isPaused: Bool
    }

    var routineName: String
}
