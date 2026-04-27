import ActivityKit
import Foundation

/// Shared data model for the Linka Workout Live Activity.
/// - ContentState: values that UPDATE during the activity (timer, series, exercise name)
/// - Attributes: values that are FIXED when the activity starts (routine name)
public struct LinkaWorkoutAttributes: ActivityAttributes {

    public static let activityType = "com.linka.meuapp.workout"

    public struct ContentState: Codable, Hashable {
        var exerciseName: String
        var seriesLabel: String
        var startDate: Date
        var pausedElapsedSeconds: Int
        var isPaused: Bool
    }

    /// Fixed: the routine name shown in the header
    var routineName: String
}
