import ActivityKit
import Foundation

/// Shared data model for the Linka Workout Live Activity.
/// - ContentState: values that UPDATE during the activity (timer, series, exercise name)
/// - Attributes: values that are FIXED when the activity starts (routine name)
public struct LinkaWorkoutAttributes: ActivityAttributes {

    public static let activityType = "com.linka.meuapp.workout"

    public struct ContentState: Codable, Hashable {
        /// Name of the current exercise being performed
        var exerciseName: String
        /// "Set X de Y" label
        var seriesLabel: String
        /// Elapsed seconds since workout started (used to drive the timer display)
        var elapsedSeconds: Int
        /// Whether the workout is paused
        var isPaused: Bool
        /// When the workout started (drives the live timer)
        var startDate: Date
        /// Frozen elapsed seconds used when isPaused is true
        var pausedElapsedSeconds: Int
    }

    /// Fixed: the routine name shown in the header
    var routineName: String
}
