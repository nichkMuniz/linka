import ActivityKit
import SwiftUI
import WidgetKit

// MARK: - Helpers

private func formatElapsed(_ secs: Int) -> String {
    let h = secs / 3600
    let m = (secs % 3600) / 60
    let s = secs % 60
    if h > 0 {
        return String(format: "%d:%02d:%02d", h, m, s)
    }
    return String(format: "%02d:%02d", m, s)
}

/// A timer view that auto-advances on the lock screen using ActivityKit's
/// date-driven rendering. When paused, shows the frozen elapsed string instead.
private struct WorkoutTimer: View {
    let startDate: Date
    let pausedElapsedSeconds: Int
    let isPaused: Bool

    var body: some View {
        if isPaused {
            Text(formatElapsed(pausedElapsedSeconds))
                .font(.system(size: 28, weight: .bold, design: .monospaced))
                .foregroundColor(.white.opacity(0.5))
        } else {
            Text(timerInterval: startDate...Date.distantFuture, pauseTime: nil)
                .font(.system(size: 28, weight: .bold, design: .monospaced))
                .foregroundColor(.white)
                .monospacedDigit()
        }
    }
}

// Brand orange used throughout the app
private let brandOrange = Color(red: 249/255, green: 115/255, blue: 22/255)

// MARK: - Lock Screen / Notification Banner view

struct WorkoutLockScreenView: View {
    let context: ActivityViewContext<LinkaWorkoutAttributes>

    var body: some View {
        HStack(alignment: .center, spacing: 16) {
            // App icon placeholder circle
            ZStack {
                Circle()
                    .fill(brandOrange.opacity(0.15))
                    .frame(width: 52, height: 52)
                Image(systemName: "figure.strengthtraining.traditional")
                    .font(.system(size: 26, weight: .semibold))
                    .foregroundColor(brandOrange)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(context.state.exerciseName)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                Text(context.state.seriesLabel)
                    .font(.system(size: 13, weight: .regular))
                    .foregroundColor(.white.opacity(0.7))
            }

            Spacer()

            // Elapsed timer — advances automatically on lock screen via ActivityKit
            VStack(alignment: .trailing, spacing: 2) {
                WorkoutTimer(
                    startDate: context.state.startDate,
                    pausedElapsedSeconds: context.state.pausedElapsedSeconds,
                    isPaused: context.state.isPaused
                )
                if context.state.isPaused {
                    Text("pausado")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(.white.opacity(0.5))
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(Color.black.opacity(0.85))
    }
}

// MARK: - Dynamic Island views

struct WorkoutDynamicIslandCompact: View {
    let context: ActivityViewContext<LinkaWorkoutAttributes>
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "figure.run")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(brandOrange)
            if context.state.isPaused {
                Text(formatElapsed(context.state.pausedElapsedSeconds))
                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                    .foregroundColor(.white.opacity(0.5))
            } else {
                Text(timerInterval: context.state.startDate...Date.distantFuture, pauseTime: nil)
                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                    .foregroundColor(.white)
                    .monospacedDigit()
            }
        }
    }
}

struct WorkoutDynamicIslandMinimal: View {
    let context: ActivityViewContext<LinkaWorkoutAttributes>
    var body: some View {
        Image(systemName: "figure.run")
            .font(.system(size: 12, weight: .semibold))
            .foregroundColor(brandOrange)
    }
}

struct WorkoutDynamicIslandExpanded: View {
    let context: ActivityViewContext<LinkaWorkoutAttributes>
    var body: some View {
        VStack(spacing: 6) {
            HStack {
                Label(context.attributes.routineName, systemImage: "figure.strengthtraining.traditional")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(brandOrange)
                Spacer()
                Text(formatElapsed(context.state.elapsedSeconds))
                    .font(.system(size: 18, weight: .bold, design: .monospaced))
                    .foregroundColor(.white)
            }
            HStack {
                Text(context.state.exerciseName)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                Spacer()
                Text(context.state.seriesLabel)
                    .font(.system(size: 13))
                    .foregroundColor(.white.opacity(0.7))
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }
}

// MARK: - Widget declaration

@available(iOS 16.1, *)
struct LinkaWorkoutLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: LinkaWorkoutAttributes.self) { context in
            WorkoutLockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label(context.attributes.routineName,
                          systemImage: "figure.strengthtraining.traditional")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(brandOrange)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if context.state.isPaused {
                        Text(formatElapsed(context.state.pausedElapsedSeconds))
                            .font(.system(size: 16, weight: .bold, design: .monospaced))
                            .foregroundColor(.white.opacity(0.5))
                    } else {
                        Text(timerInterval: context.state.startDate...Date.distantFuture, pauseTime: nil)
                            .font(.system(size: 16, weight: .bold, design: .monospaced))
                            .foregroundColor(.white)
                            .monospacedDigit()
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text(context.state.exerciseName)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)
                        Spacer()
                        Text(context.state.seriesLabel)
                            .font(.system(size: 13))
                            .foregroundColor(.white.opacity(0.7))
                    }
                    .padding(.horizontal, 4)
                }
            } compactLeading: {
                Image(systemName: "figure.run")
                    .foregroundColor(brandOrange)
            } compactTrailing: {
                if context.state.isPaused {
                    Text(formatElapsed(context.state.pausedElapsedSeconds))
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .foregroundColor(.white.opacity(0.5))
                } else {
                    Text(timerInterval: context.state.startDate...Date.distantFuture, pauseTime: nil)
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                        .monospacedDigit()
                }
            } minimal: {
                Image(systemName: "figure.run")
                    .foregroundColor(brandOrange)
            }
            .widgetURL(URL(string: "linka://metas"))
            .keylineTint(brandOrange)
        }
    }
}
