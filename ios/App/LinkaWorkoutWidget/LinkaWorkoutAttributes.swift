import ActivityKit
import Foundation

/// Shared data model for the Linka Workout Live Activity.
///
/// IMPORTANT: this single source file is compiled into BOTH the App target
/// (so the JS plugin can `Activity<...>.request(...)`) and the
/// LinkaWorkoutWidget extension target (so the widget renders the UI).
/// Do NOT duplicate this file — Live Activities will silently fail to render
/// if the type exists in two separate compiled copies.
public struct LinkaWorkoutAttributes: ActivityAttributes {

    public static let activityType = "com.linka.meuapp.workout"

    public struct ContentState: Codable, Hashable {
        // --- Common
        var exerciseName: String
        var seriesLabel: String
        /// "working" → counting up the total elapsed workout time
        /// "resting" → counting down the rest interval between series
        var phase: String
        /// Absolute workout start date — drives the elapsed timer in working phase
        var startDate: Date
        var pausedElapsedSeconds: Int
        var isPaused: Bool

        // --- Resting phase only
        /// Absolute time when the rest interval ends (used by Text(timerInterval:countsDown:true))
        var restEndsAt: Date?
        /// Total seconds of the current rest interval (drives the progress bar)
        var restTotalSeconds: Int
        /// Preview of the upcoming series, e.g. "A seguir: série 2 de 3 (68 kg x 10 rep…)"
        var nextSeriesLabel: String
    }

    /// Fixed for the whole activity lifecycle
    var routineName: String
}
