import UIKit
import Capacitor
import AppTrackingTransparency
import UserNotifications
import AVFoundation

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Register as UNUserNotificationCenter delegate for local + remote notifications
        UNUserNotificationCenter.current().delegate = self
        // Faz o áudio de mídia (vídeos de flow/shots no WKWebView) tocar mesmo com o
        // botão físico de silencioso ligado, como Instagram/TikTok.
        configureAudioSessionForPlayback()
        return true
    }

    /// Configura a AVAudioSession compartilhada na categoria `.playback`, que ignora
    /// o switch de silencioso do iPhone para reprodução de mídia. O WKWebView ativa
    /// a sessão quando um `<video>` com áudio toca; sem esta categoria ele respeitaria
    /// o silencioso e o vídeo sairia mudo. Reaplicamos em `applicationDidBecomeActive`
    /// porque interrupções (ligação, outro app de mídia) ou o próprio WebKit podem
    /// rebaixar a categoria enquanto o app roda.
    private func configureAudioSessionForPlayback() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback, options: [])
        } catch {
            print("AudioSession: falha ao configurar categoria .playback: \(error)")
        }
    }

    // Called by iOS after APNs registration succeeds — forwards the token to Capacitor
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(
            name: Notification.Name.capacitorDidRegisterForRemoteNotifications,
            object: deviceToken
        )
    }

    // Called by iOS if APNs registration fails
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(
            name: Notification.Name.capacitorDidFailToRegisterForRemoteNotifications,
            object: error
        )
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
        // Reafirma a categoria de áudio: uma interrupção (ligação/outro app) pode ter
        // rebaixado a sessão enquanto estávamos inativos.
        configureAudioSessionForPlayback()
        requestTrackingAuthorization()
        // Clear the app icon badge whenever the user opens the app
        UIApplication.shared.applicationIconBadgeNumber = 0
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
    }

    private func requestTrackingAuthorization() {
        if #available(iOS 14, *) {
            // Pequeno delay para garantir que a UI esteja pronta antes de exibir o alerta
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                ATTrackingManager.requestTrackingAuthorization { status in
                    switch status {
                    case .authorized:
                        print("ATT: rastreamento autorizado")
                    case .denied:
                        print("ATT: rastreamento negado")
                    case .notDetermined:
                        print("ATT: não determinado")
                    case .restricted:
                        print("ATT: rastreamento restrito")
                    @unknown default:
                        print("ATT: status desconhecido")
                    }
                }
            }
        }
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

// MARK: - UNUserNotificationCenterDelegate
// Required so that local notifications display banners/sounds while the app
// is in the foreground (the default iOS behavior is to suppress them silently).
extension AppDelegate: UNUserNotificationCenterDelegate {

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Show banner + play sound even when the app is in the foreground
        completionHandler([.banner, .sound, .badge])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        // Forward tap events to Capacitor so the JS listener fires correctly
        NotificationCenter.default.post(
            name: Notification.Name(rawValue: "CAPNotificationDelegateDidReceiveResponse"),
            object: response
        )
        completionHandler()
    }

}
