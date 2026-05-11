import Foundation
import Capacitor
import ActivityKit

/// Capacitor plugin that exposes Live Activity control to JavaScript.
@objc(WorkoutActivityPlugin)
public class WorkoutActivityPlugin: CAPPlugin {

    /// Stored as Any? so the class compiles on iOS 15 (Activity requires iOS 16.2+).
    private var _currentActivity: Any?

    @available(iOS 16.2, *)
    private var currentActivity: Activity<LinkaWorkoutAttributes>? {
        get { _currentActivity as? Activity<LinkaWorkoutAttributes> }
        set { _currentActivity = newValue }
    }

    // MARK: - Helpers

    @available(iOS 16.2, *)
    private func buildState(
        from call: CAPPluginCall,
        fallback: LinkaWorkoutAttributes.ContentState? = nil
    ) -> LinkaWorkoutAttributes.ContentState {
        let exerciseName       = call.getString("exerciseName")    ?? fallback?.exerciseName ?? ""
        let seriesLabel        = call.getString("seriesLabel")     ?? fallback?.seriesLabel ?? ""
        let phase              = call.getString("phase")           ?? fallback?.phase ?? "working"
        let isPaused           = call.getBool("isPaused")          ?? fallback?.isPaused ?? false
        let pausedElapsedSecs  = call.getInt("pausedElapsedSeconds") ?? fallback?.pausedElapsedSeconds ?? 0
        let nextSeriesLabel    = call.getString("nextSeriesLabel") ?? fallback?.nextSeriesLabel ?? ""
        let restTotalSeconds   = call.getInt("restTotalSeconds")   ?? fallback?.restTotalSeconds ?? 0

        // startDate: only set when starting; preserved on update
        let startDate: Date = {
            if let ms = call.getDouble("startTimeMs") {
                return Date(timeIntervalSince1970: ms / 1000)
            }
            return fallback?.startDate ?? Date()
        }()

        // restEndsAt: epoch ms from JS — null clears countdown
        let restEndsAt: Date? = {
            if let ms = call.getDouble("restEndsAtMs"), ms > 0 {
                return Date(timeIntervalSince1970: ms / 1000)
            }
            // If JS explicitly sent null, drop the previous value; if the key
            // is absent, fall back to the previous state's value.
            if call.hasOption("restEndsAtMs") {
                return nil
            }
            return fallback?.restEndsAt
        }()

        return LinkaWorkoutAttributes.ContentState(
            exerciseName: exerciseName,
            seriesLabel: seriesLabel,
            phase: phase,
            startDate: startDate,
            pausedElapsedSeconds: pausedElapsedSecs,
            isPaused: isPaused,
            restEndsAt: restEndsAt,
            restTotalSeconds: restTotalSeconds,
            nextSeriesLabel: nextSeriesLabel
        )
    }

    // MARK: - Start

    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["supported": false])
            return
        }

        // If an activity is already running, just update it instead of starting a new one
        if let existing = currentActivity {
            let newState = buildState(from: call, fallback: existing.content.state)
            let content = ActivityContent(state: newState, staleDate: nil)
            Task { await existing.update(content) }
            call.resolve(["id": existing.id, "supported": true, "reused": true])
            return
        }

        let routineName = call.getString("routineName") ?? "Treino"
        let attributes = LinkaWorkoutAttributes(routineName: routineName)
        let state = buildState(from: call)
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

        let newState = buildState(from: call, fallback: activity.content.state)
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
