import ActivityKit
import Foundation

/// Shared data model for the Linka Workout Live Activity.
/// - ContentState: values that UPDATE during the activity (timer, series, exercise name)
/// - Attributes: values that are FIXED when the activity starts (routine name)
public struct LinkaWorkoutAttributes: ActivityAttributes {

    public struct ContentState: Codable, Hashable {
        /// Name of the current exercise being performed
        var exerciseName: String
        /// "Set X de Y" label
        var seriesLabel: String
        /// Elapsed seconds since workout started (used to drive the timer display)
        var elapsedSeconds: Int
        /// Whether the workout is paused
        var isPaused: Bool
    }

    /// Fixed: the routine name shown in the header
    var routineName: String
}
