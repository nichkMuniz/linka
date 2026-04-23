import Foundation
import Capacitor
import ActivityKit

/// Capacitor plugin that exposes LiveActivity control to JavaScript.
///
/// JS API:
///   WorkoutActivityPlugin.start({ routineName, exerciseName, seriesLabel, elapsedSeconds })
///   WorkoutActivityPlugin.update({ exerciseName, seriesLabel, elapsedSeconds, isPaused })
///   WorkoutActivityPlugin.stop()
@objc(WorkoutActivityPlugin)
public class WorkoutActivityPlugin: CAPPlugin {

    /// Stored as Any? so the class compiles on iOS 15 (Activity requires iOS 16.2+).
    private var _currentActivity: Any?

    @available(iOS 16.2, *)
    private var currentActivity: Activity<LinkaWorkoutAttributes>? {
        get { _currentActivity as? Activity<LinkaWorkoutAttributes> }
        set { _currentActivity = newValue }
    }

    // MARK: - Start

    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["supported": false])
            return
        }

        let routineName   = call.getString("routineName")  ?? "Treino"
        let exerciseName  = call.getString("exerciseName") ?? ""
        let seriesLabel   = call.getString("seriesLabel")  ?? ""
        // startTimeMs is Unix epoch in milliseconds from JS Date.now()
        let startTimeMs   = call.getDouble("startTimeMs")  ?? Double(Date().timeIntervalSince1970 * 1000)
        let startDate     = Date(timeIntervalSince1970: startTimeMs / 1000)

        let attributes = LinkaWorkoutAttributes(routineName: routineName)
        let state = LinkaWorkoutAttributes.ContentState(
            exerciseName:          exerciseName,
            seriesLabel:           seriesLabel,
            startDate:             startDate,
            pausedElapsedSeconds:  0,
            isPaused:              false
        )
        let content = ActivityContent(state: state, staleDate: nil)

        do {
            let activity = try Activity<LinkaWorkoutAttributes>.request(
                attributes: attributes,
                content: content
            )
            currentActivity = activity
            call.resolve(["id": activity.id, "supported": true])
        } catch {
            call.reject("Failed to start Live Activity: \(error.localizedDescription)")
        }
    }

    // MARK: - Update

    @objc func update(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *), let activity = currentActivity else {
            call.resolve(["updated": false])
            return
        }

        let exerciseName       = call.getString("exerciseName")      ?? activity.content.state.exerciseName
        let seriesLabel        = call.getString("seriesLabel")       ?? activity.content.state.seriesLabel
        let isPaused           = call.getBool("isPaused")            ?? activity.content.state.isPaused
        let pausedElapsedSecs  = call.getInt("pausedElapsedSeconds") ?? activity.content.state.pausedElapsedSeconds
        // startDate never changes after the activity starts — keep existing value
        let startDate          = activity.content.state.startDate

        let newState = LinkaWorkoutAttributes.ContentState(
            exerciseName:         exerciseName,
            seriesLabel:          seriesLabel,
            startDate:            startDate,
            pausedElapsedSeconds: pausedElapsedSecs,
            isPaused:             isPaused
        )
        let content = ActivityContent(state: newState, staleDate: nil)

        Task {
            await activity.update(content)
            call.resolve(["updated": true])
        }
    }

    // MARK: - Stop

    @objc func stop(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *), let activity = currentActivity else {
            call.resolve(["stopped": false])
            return
        }

        Task {
            let finalState = activity.content.state
            let content = ActivityContent(state: finalState, staleDate: nil)
            await activity.end(content, dismissalPolicy: .immediate)
            currentActivity = nil
            call.resolve(["stopped": true])
        }
    }
}
