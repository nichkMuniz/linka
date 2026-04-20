import Foundation
import Capacitor
import LocalAuthentication
import Security

@objc(LinkaBiometricPlugin)
public class LinkaBiometricPlugin: CAPPlugin {

    // MARK: - isAvailable

    @objc func isAvailable(_ call: CAPPluginCall) {
        let context = LAContext()
        var error: NSError?
        let available = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        if available {
            var biometryType = "fingerprint"
            if #available(iOS 11.0, *) {
                if context.biometryType == .faceID { biometryType = "face" }
            }
            call.resolve(["isAvailable": true, "biometryType": biometryType])
        } else {
            call.resolve(["isAvailable": false, "errorCode": error?.code ?? -1])
        }
    }

    // MARK: - verifyIdentity

    @objc func verifyIdentity(_ call: CAPPluginCall) {
        let reason = call.getString("reason") ?? "Autentique-se"
        let useFallback = call.getBool("useFallback") ?? true
        let context = LAContext()
        let policy: LAPolicy = useFallback
            ? .deviceOwnerAuthentication
            : .deviceOwnerAuthenticationWithBiometrics
        context.evaluatePolicy(policy, localizedReason: reason) { success, error in
            if success {
                call.resolve()
            } else {
                let nsError = error as NSError?
                call.reject(nsError?.localizedDescription ?? "Autenticação falhou", "\(nsError?.code ?? 0)")
            }
        }
    }

    // MARK: - setCredentials

    @objc func setCredentials(_ call: CAPPluginCall) {
        guard let username = call.getString("username"),
              let password = call.getString("password"),
              let server  = call.getString("server") else {
            call.reject("Parâmetros ausentes")
            return
        }
        let data = password.data(using: .utf8)!
        let query: [String: Any] = [
            kSecClass as String:       kSecClassInternetPassword,
            kSecAttrServer as String:  server,
            kSecAttrAccount as String: username
        ]
        SecItemDelete(query as CFDictionary)
        let attrs: [String: Any] = query.merging([
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]) { _, new in new }
        let status = SecItemAdd(attrs as CFDictionary, nil)
        if status == errSecSuccess {
            call.resolve()
        } else {
            call.reject("Erro ao salvar credenciais: \(status)")
        }
    }

    // MARK: - getCredentials

    @objc func getCredentials(_ call: CAPPluginCall) {
        guard let server = call.getString("server") else {
            call.reject("Parâmetro 'server' ausente")
            return
        }
        let query: [String: Any] = [
            kSecClass as String:            kSecClassInternetPassword,
            kSecAttrServer as String:       server,
            kSecReturnAttributes as String: true,
            kSecReturnData as String:       true,
            kSecMatchLimit as String:       kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let existing = item as? [String: Any],
              let passwordData = existing[kSecValueData as String] as? Data,
              let password = String(data: passwordData, encoding: .utf8),
              let username = existing[kSecAttrAccount as String] as? String else {
            call.reject("Credenciais não encontradas", "\(status)")
            return
        }
        call.resolve(["username": username, "password": password])
    }

    // MARK: - deleteCredentials

    @objc func deleteCredentials(_ call: CAPPluginCall) {
        guard let server = call.getString("server") else {
            call.reject("Parâmetro 'server' ausente")
            return
        }
        let query: [String: Any] = [
            kSecClass as String:      kSecClassInternetPassword,
            kSecAttrServer as String: server
        ]
        SecItemDelete(query as CFDictionary)
        call.resolve()
    }
}
