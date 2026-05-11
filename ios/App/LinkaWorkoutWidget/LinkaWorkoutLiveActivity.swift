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
    return String(format: "%d:%02d", m, s)
}

private let brandOrange = Color(red: 249/255, green: 115/255, blue: 22/255)
private let brandBlue   = Color(red: 59/255,  green: 130/255, blue: 246/255)

// MARK: - Working / Rest timer view

private struct WorkoutTimer: View {
    let state: LinkaWorkoutAttributes.ContentState
    var fontSize: CGFloat = 28

    var body: some View {
        if state.phase == "resting", let end = state.restEndsAt {
            // Counts DOWN automatically without JS updates
            Text(timerInterval: Date()...end, countsDown: true)
                .font(.system(size: fontSize, weight: .bold, design: .monospaced))
                .foregroundColor(.white)
                .monospacedDigit()
        } else if state.isPaused {
            Text(formatElapsed(state.pausedElapsedSeconds))
                .font(.system(size: fontSize, weight: .bold, design: .monospaced))
                .foregroundColor(.white.opacity(0.5))
        } else {
            Text(timerInterval: state.startDate...Date.distantFuture, pauseTime: nil)
                .font(.system(size: fontSize, weight: .bold, design: .monospaced))
                .foregroundColor(.white)
                .monospacedDigit()
        }
    }
}

// MARK: - Lock Screen / Notification Banner view

struct WorkoutLockScreenView: View {
    let context: ActivityViewContext<LinkaWorkoutAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Header row: title + timer
            HStack(alignment: .center, spacing: 12) {
                ZStack {
                    Circle()
                        .fill(brandOrange.opacity(0.18))
                        .frame(width: 40, height: 40)
                    Image(systemName: "figure.strengthtraining.traditional")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(brandOrange)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("Treinamento")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.white)
                    Text(context.attributes.routineName)
                        .font(.system(size: 11))
                        .foregroundColor(.white.opacity(0.55))
                        .lineLimit(1)
                }

                Spacer()

                if context.state.phase == "resting", let end = context.state.restEndsAt {
                    Text(timerInterval: Date()...end, countsDown: true)
                        .font(.system(size: 14, weight: .semibold, design: .monospaced))
                        .foregroundColor(.white.opacity(0.7))
                        .monospacedDigit()
                } else {
                    Text(timerInterval: context.state.startDate...Date.distantFuture, pauseTime: nil)
                        .font(.system(size: 14, weight: .semibold, design: .monospaced))
                        .foregroundColor(.white.opacity(0.7))
                        .monospacedDigit()
                }
            }

            // Body
            HStack(alignment: .top, spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Color.white.opacity(0.08))
                        .frame(width: 44, height: 44)
                    Image(systemName: "dumbbell.fill")
                        .font(.system(size: 20))
                        .foregroundColor(.white.opacity(0.85))
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(context.state.exerciseName)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(.white)
                        .lineLimit(1)
                    Text(context.state.phase == "resting"
                         ? context.state.nextSeriesLabel
                         : context.state.seriesLabel)
                        .font(.system(size: 12))
                        .foregroundColor(.white.opacity(0.6))
                        .lineLimit(1)
                }
                Spacer()
            }

            // Rest progress bar (only in resting phase)
            if context.state.phase == "resting",
               let end = context.state.restEndsAt,
               context.state.restTotalSeconds > 0 {
                let start = end.addingTimeInterval(-Double(context.state.restTotalSeconds))
                ProgressView(timerInterval: start...end, countsDown: false) {
                    EmptyView()
                } currentValueLabel: {
                    EmptyView()
                }
                .progressViewStyle(.linear)
                .tint(brandBlue)
                .frame(height: 4)
            }

            // Big countdown row (resting) OR omit (working — header already has timer)
            if context.state.phase == "resting" {
                HStack {
                    Spacer()
                    WorkoutTimer(state: context.state, fontSize: 32)
                    Spacer()
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(Color.black.opacity(0.85))
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
                    WorkoutTimer(state: context.state, fontSize: 16)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text(context.state.exerciseName)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)
                        Spacer()
                        Text(context.state.phase == "resting"
                             ? context.state.nextSeriesLabel
                             : context.state.seriesLabel)
                            .font(.system(size: 13))
                            .foregroundColor(.white.opacity(0.7))
                            .lineLimit(1)
                    }
                    .padding(.horizontal, 4)
                }
            } compactLeading: {
                Image(systemName: context.state.phase == "resting" ? "timer" : "figure.run")
                    .foregroundColor(context.state.phase == "resting" ? brandBlue : brandOrange)
            } compactTrailing: {
                if context.state.phase == "resting", let end = context.state.restEndsAt {
                    Text(timerInterval: Date()...end, countsDown: true)
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .foregroundColor(brandBlue)
                        .monospacedDigit()
                        .frame(maxWidth: 50)
                } else if context.state.isPaused {
                    Text(formatElapsed(context.state.pausedElapsedSeconds))
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .foregroundColor(.white.opacity(0.5))
                        .frame(maxWidth: 50)
                } else {
                    Text(timerInterval: context.state.startDate...Date.distantFuture, pauseTime: nil)
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                        .monospacedDigit()
                        .frame(maxWidth: 50)
                }
            } minimal: {
                Image(systemName: context.state.phase == "resting" ? "timer" : "figure.run")
                    .foregroundColor(context.state.phase == "resting" ? brandBlue : brandOrange)
            }
            .widgetURL(URL(string: "linka://metas"))
            .keylineTint(context.state.phase == "resting" ? brandBlue : brandOrange)
        }
    }
}
