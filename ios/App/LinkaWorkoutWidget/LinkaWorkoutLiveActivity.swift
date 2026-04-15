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

            // Elapsed timer
            VStack(alignment: .trailing, spacing: 2) {
                Text(formatElapsed(context.state.elapsedSeconds))
                    .font(.system(size: 28, weight: .bold, design: .monospaced))
                    .foregroundColor(context.state.isPaused ? .white.opacity(0.5) : .white)
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
            Text(formatElapsed(context.state.elapsedSeconds))
                .font(.system(size: 13, weight: .bold, design: .monospaced))
                .foregroundColor(.white)
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
                    Text(formatElapsed(context.state.elapsedSeconds))
                        .font(.system(size: 16, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
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
                Text(formatElapsed(context.state.elapsedSeconds))
                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                    .foregroundColor(.white)
            } minimal: {
                Image(systemName: "figure.run")
                    .foregroundColor(brandOrange)
            }
            .widgetURL(URL(string: "linka://metas"))
            .keylineTint(brandOrange)
        }
    }
}
