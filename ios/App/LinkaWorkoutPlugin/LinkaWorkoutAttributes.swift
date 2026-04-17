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
        var elapsedSeconds: Int
        var isPaused: Bool
    }

    var routineName: String
}
