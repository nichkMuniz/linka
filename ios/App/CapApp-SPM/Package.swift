// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "7.6.2"),
        .package(name: "CapacitorApp", path: "..\..\..\node_modules\.pnpm\@capacitor+app@7.1.2_@capacitor+core@7.6.2\node_modules\@capacitor\app"),
        .package(name: "CapacitorBrowser", path: "..\..\..\node_modules\.pnpm\@capacitor+browser@7.0.5_@capacitor+core@7.6.2\node_modules\@capacitor\browser"),
        .package(name: "CapacitorGeolocation", path: "..\..\..\node_modules\.pnpm\@capacitor+geolocation@7.1.8_@capacitor+core@7.6.2\node_modules\@capacitor\geolocation"),
        .package(name: "CapacitorHaptics", path: "..\..\..\node_modules\.pnpm\@capacitor+haptics@7.0.5_@capacitor+core@7.6.2\node_modules\@capacitor\haptics"),
        .package(name: "CapacitorKeyboard", path: "..\..\..\node_modules\.pnpm\@capacitor+keyboard@7.0.6_@capacitor+core@7.6.2\node_modules\@capacitor\keyboard"),
        .package(name: "CapacitorLocalNotifications", path: "..\..\..\node_modules\.pnpm\@capacitor+local-notifications@7.0.6_@capacitor+core@7.6.2\node_modules\@capacitor\local-notifications"),
        .package(name: "CapacitorPushNotifications", path: "..\..\..\node_modules\.pnpm\@capacitor+push-notifications@7.0.6_@capacitor+core@7.6.2\node_modules\@capacitor\push-notifications"),
        .package(name: "CapacitorShare", path: "..\..\..\node_modules\.pnpm\@capacitor+share@7.0.4_@capacitor+core@7.6.2\node_modules\@capacitor\share"),
        .package(name: "CapacitorStatusBar", path: "..\..\..\node_modules\.pnpm\@capacitor+status-bar@7.0.6_@capacitor+core@7.6.2\node_modules\@capacitor\status-bar"),
        .package(name: "CapgoCapacitorNativeBiometric", path: "..\..\..\node_modules\.pnpm\@capgo+capacitor-native-bio_58e8312a69844743673a89b9dbf56e22\node_modules\@capgo\capacitor-native-biometric"),
        .package(name: "CapgoCapacitorPhotoLibrary", path: "..\..\..\node_modules\.pnpm\@capgo+capacitor-photo-library@7.2.11_@capacitor+core@7.6.2\node_modules\@capgo\capacitor-photo-library")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorBrowser", package: "CapacitorBrowser"),
                .product(name: "CapacitorGeolocation", package: "CapacitorGeolocation"),
                .product(name: "CapacitorHaptics", package: "CapacitorHaptics"),
                .product(name: "CapacitorKeyboard", package: "CapacitorKeyboard"),
                .product(name: "CapacitorLocalNotifications", package: "CapacitorLocalNotifications"),
                .product(name: "CapacitorPushNotifications", package: "CapacitorPushNotifications"),
                .product(name: "CapacitorShare", package: "CapacitorShare"),
                .product(name: "CapacitorStatusBar", package: "CapacitorStatusBar"),
                .product(name: "CapgoCapacitorNativeBiometric", package: "CapgoCapacitorNativeBiometric"),
                .product(name: "CapgoCapacitorPhotoLibrary", package: "CapgoCapacitorPhotoLibrary")
            ]
        )
    ]
)
