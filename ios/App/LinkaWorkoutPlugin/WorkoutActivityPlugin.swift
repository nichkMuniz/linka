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

    private var currentActivity: Activity<LinkaWorkoutAttributes>?

    // MARK: - Start

    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.resolve(["supported": false])
            return
        }

        let routineName   = call.getString("routineName")   ?? "Treino"
        let exerciseName  = call.getString("exerciseName")  ?? ""
        let seriesLabel   = call.getString("seriesLabel")   ?? ""
        let elapsedSecs   = call.getInt("elapsedSeconds")   ?? 0

        let attributes = LinkaWorkoutAttributes(routineName: routineName)
        let state = LinkaWorkoutAttributes.ContentState(
            exerciseName:   exerciseName,
            seriesLabel:    seriesLabel,
            elapsedSeconds: elapsedSecs,
            isPaused:       false
        )

        do {
            let activity = try Activity<LinkaWorkoutAttributes>.request(
                attributes: attributes,
                contentState: state,
                pushType: nil
            )
            currentActivity = activity
            call.resolve(["id": activity.id, "supported": true])
        } catch {
            call.reject("Failed to start Live Activity: \(error.localizedDescription)")
        }
    }

    // MARK: - Update

    @objc func update(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *), let activity = currentActivity else {
            call.resolve(["updated": false])
            return
        }

        let exerciseName  = call.getString("exerciseName")  ?? activity.contentState.exerciseName
        let seriesLabel   = call.getString("seriesLabel")   ?? activity.contentState.seriesLabel
        let elapsedSecs   = call.getInt("elapsedSeconds")   ?? activity.contentState.elapsedSeconds
        let isPaused      = call.getBool("isPaused")        ?? activity.contentState.isPaused

        let newState = LinkaWorkoutAttributes.ContentState(
            exerciseName:   exerciseName,
            seriesLabel:    seriesLabel,
            elapsedSeconds: elapsedSecs,
            isPaused:       isPaused
        )

        Task {
            await activity.update(using: newState)
            call.resolve(["updated": true])
        }
    }

    // MARK: - Stop

    @objc func stop(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *), let activity = currentActivity else {
            call.resolve(["stopped": false])
            return
        }

        Task {
            await activity.end(dismissalPolicy: .immediate)
            currentActivity = nil
            call.resolve(["stopped": true])
        }
    }
}
