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
        .package(name: "CapacitorCommunityAppleSignIn", path: "..\..\..\node_modules\.pnpm\@capacitor-community+apple-_97a8a5dbecdaf55775174955233c7498\node_modules\@capacitor-community\apple-sign-in"),
        .package(name: "CapacitorCommunityBackgroundGeolocation", path: "..\..\..\node_modules\.pnpm\@capacitor-community+backgr_bc35f1e31b80c3dc09dc2decb539b4e4\node_modules\@capacitor-community\background-geolocation"),
        .package(name: "CapacitorApp", path: "..\..\..\node_modules\.pnpm\@capacitor+app@7.1.2_@capacitor+core@7.6.2\node_modules\@capacitor\app"),
        .package(name: "CapacitorBrowser", path: "..\..\..\node_modules\.pnpm\@capacitor+browser@7.0.5_@capacitor+core@7.6.2\node_modules\@capacitor\browser"),
        .package(name: "CapacitorFilesystem", path: "..\..\..\node_modules\.pnpm\@capacitor+filesystem@7.1.8_@capacitor+core@7.6.2\node_modules\@capacitor\filesystem"),
        .package(name: "CapacitorHaptics", path: "..\..\..\node_modules\.pnpm\@capacitor+haptics@7.0.5_@capacitor+core@7.6.2\node_modules\@capacitor\haptics"),
        .package(name: "CapacitorLocalNotifications", path: "..\..\..\node_modules\.pnpm\@capacitor+local-notifications@7.0.6_@capacitor+core@7.6.2\node_modules\@capacitor\local-notifications"),
        .package(name: "CapacitorPushNotifications", path: "..\..\..\node_modules\.pnpm\@capacitor+push-notifications@7.0.6_@capacitor+core@7.6.2\node_modules\@capacitor\push-notifications"),
        .package(name: "CapacitorShare", path: "..\..\..\node_modules\.pnpm\@capacitor+share@7.0.4_@capacitor+core@7.6.2\node_modules\@capacitor\share"),
        .package(name: "CapacitorStatusBar", path: "..\..\..\node_modules\.pnpm\@capacitor+status-bar@7.0.6_@capacitor+core@7.6.2\node_modules\@capacitor\status-bar"),
        .package(name: "CapgoCapacitorPhotoLibrary", path: "..\..\..\node_modules\.pnpm\@capgo+capacitor-photo-library@7.2.11_@capacitor+core@7.6.2\node_modules\@capgo\capacitor-photo-library")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorCommunityAppleSignIn", package: "CapacitorCommunityAppleSignIn"),
                .product(name: "CapacitorCommunityBackgroundGeolocation", package: "CapacitorCommunityBackgroundGeolocation"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorBrowser", package: "CapacitorBrowser"),
                .product(name: "CapacitorFilesystem", package: "CapacitorFilesystem"),
                .product(name: "CapacitorHaptics", package: "CapacitorHaptics"),
                .product(name: "CapacitorLocalNotifications", package: "CapacitorLocalNotifications"),
                .product(name: "CapacitorPushNotifications", package: "CapacitorPushNotifications"),
                .product(name: "CapacitorShare", package: "CapacitorShare"),
                .product(name: "CapacitorStatusBar", package: "CapacitorStatusBar"),
                .product(name: "CapgoCapacitorPhotoLibrary", package: "CapgoCapacitorPhotoLibrary")
            ]
        )
    ]
)
