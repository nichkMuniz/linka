import AuthenticationServices
import Capacitor
import CryptoKit
import Foundation
import Security
import UIKit

/// Login nativo do Google (jsName `GoogleAuth`, wrapper JS em
/// `client/lib/social-auth.ts`).
///
/// Por que existe: o OAuth do Supabase aberto no navegador volta para
/// `<projeto>.supabase.co`, e o Google mostra esse domínio na tela de escolher
/// conta ("Prosseguir para zymkndqpashqxcvttdlc.supabase.co"). Aqui o app fala
/// direto com o Google usando o **Client ID do tipo iOS**: o retorno é o
/// próprio app (esquema `com.googleusercontent.apps.<id>`), então o Google
/// mostra o nome do app da tela de consentimento. O `id_token` resultante vai
/// para o Supabase via `signInWithIdToken` — mesmo desenho do Sign in with Apple.
///
/// Sem SDK do Google de propósito: o `GoogleSignIn-iOS` faz exatamente isto por
/// baixo (`ASWebAuthenticationSession` + PKCE), e o plugin pronto que o embrulha
/// para Capacitor arrasta junto o SDK inteiro do Facebook. O
/// `ASWebAuthenticationSession` captura o retorno pelo esquema sozinho — não é
/// preciso registrar URL scheme no Info.plist.
///
/// Fluxo: authorize (PKCE S256 + state + nonce) → code → troca no endpoint de
/// token do Google (cliente iOS é público: sem client secret) → `id_token`.
@objc(GoogleAuthPlugin)
public class GoogleAuthPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "GoogleAuthPlugin"
    public let jsName = "GoogleAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise)
    ]

    private static let clientIdSuffix = ".apps.googleusercontent.com"

    /// Mantém a sessão viva enquanto a folha está aberta (sem referência forte
    /// o sistema a descarta e a folha fecha sozinha).
    private var authSession: ASWebAuthenticationSession?

    @objc func signIn(_ call: CAPPluginCall) {
        guard let clientId = call.getString("clientId"), clientId.hasSuffix(GoogleAuthPlugin.clientIdSuffix) else {
            call.reject("Client ID do Google inválido.", "INVALID_CLIENT_ID")
            return
        }

        // Esquema de retorno = Client ID invertido (padrão do Google para iOS).
        let idPrefix = String(clientId.dropLast(GoogleAuthPlugin.clientIdSuffix.count))
        let callbackScheme = "com.googleusercontent.apps.\(idPrefix)"
        let redirectUri = "\(callbackScheme):/oauth2redirect"

        let codeVerifier = GoogleAuthPlugin.randomURLSafeString(byteCount: 32)
        let codeChallenge = GoogleAuthPlugin.base64URLEncode(Data(SHA256.hash(data: Data(codeVerifier.utf8))))
        let state = GoogleAuthPlugin.randomURLSafeString(byteCount: 16)

        guard var components = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth") else {
            call.reject("URL de autorização inválida.", "START_FAILED")
            return
        }
        var queryItems: [URLQueryItem] = [
            URLQueryItem(name: "client_id", value: clientId),
            URLQueryItem(name: "redirect_uri", value: redirectUri),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: "openid email profile"),
            URLQueryItem(name: "code_challenge", value: codeChallenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "state", value: state),
            // Sempre mostra o seletor — quem tem várias contas escolhe qual usar.
            URLQueryItem(name: "prompt", value: "select_account")
        ]
        // O JS manda o nonce já em SHA-256; o cru vai para o Supabase conferir.
        if let nonce = call.getString("nonce"), !nonce.isEmpty {
            queryItems.append(URLQueryItem(name: "nonce", value: nonce))
        }
        components.queryItems = queryItems
        guard let authURL = components.url else {
            call.reject("URL de autorização inválida.", "START_FAILED")
            return
        }

        DispatchQueue.main.async {
            let session = ASWebAuthenticationSession(url: authURL, callbackURLScheme: callbackScheme) { [weak self] callbackURL, error in
                guard let self = self else { return }
                self.authSession = nil

                if let error = error {
                    if let sessionError = error as? ASWebAuthenticationSessionError, sessionError.code == .canceledLogin {
                        call.reject("canceled", "CANCELED")
                    } else {
                        call.reject(error.localizedDescription, "AUTH_FAILED", error)
                    }
                    return
                }

                guard let callbackURL = callbackURL,
                      let items = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)?.queryItems else {
                    call.reject("Retorno do Google sem dados.", "AUTH_FAILED")
                    return
                }
                let value: (String) -> String? = { name in items.first(where: { $0.name == name })?.value }

                if let oauthError = value("error") {
                    // "access_denied" = o usuário recusou na tela do Google.
                    if oauthError == "access_denied" {
                        call.reject("canceled", "CANCELED")
                    } else {
                        call.reject(value("error_description") ?? oauthError, "AUTH_FAILED")
                    }
                    return
                }
                guard value("state") == state else {
                    call.reject("Retorno do Google não confere (state).", "AUTH_FAILED")
                    return
                }
                guard let code = value("code") else {
                    call.reject("Retorno do Google sem código.", "AUTH_FAILED")
                    return
                }

                self.exchangeCode(code, codeVerifier: codeVerifier, clientId: clientId, redirectUri: redirectUri, call: call)
            }
            session.presentationContextProvider = self
            // false = aproveita a sessão do Google já logada no Safari (seletor
            // com as contas do aparelho, sem digitar senha).
            session.prefersEphemeralWebBrowserSession = false
            self.authSession = session
            if !session.start() {
                self.authSession = nil
                call.reject("Não foi possível abrir o login do Google.", "START_FAILED")
            }
        }
    }

    private func exchangeCode(_ code: String, codeVerifier: String, clientId: String, redirectUri: String, call: CAPPluginCall) {
        guard let tokenURL = URL(string: "https://oauth2.googleapis.com/token") else {
            call.reject("URL de token inválida.", "TOKEN_FAILED")
            return
        }
        var request = URLRequest(url: tokenURL)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        let params: [(String, String)] = [
            ("code", code),
            ("client_id", clientId),
            ("redirect_uri", redirectUri),
            ("grant_type", "authorization_code"),
            ("code_verifier", codeVerifier)
        ]
        request.httpBody = GoogleAuthPlugin.formEncode(params).data(using: .utf8)

        URLSession.shared.dataTask(with: request) { data, _, error in
            if let error = error {
                call.reject(error.localizedDescription, "TOKEN_FAILED", error)
                return
            }
            guard let data = data,
                  let json = (try? JSONSerialization.jsonObject(with: data, options: [])) as? [String: Any] else {
                call.reject("Resposta de token inválida.", "TOKEN_FAILED")
                return
            }
            guard let idToken = json["id_token"] as? String else {
                let description = (json["error_description"] as? String) ?? (json["error"] as? String) ?? "Token do Google não retornado."
                call.reject(description, "TOKEN_FAILED")
                return
            }
            var result = JSObject()
            result["idToken"] = idToken
            if let accessToken = json["access_token"] as? String {
                result["accessToken"] = accessToken
            }
            call.resolve(result)
        }.resume()
    }

    // MARK: - ASWebAuthenticationPresentationContextProviding

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        if let window = bridge?.webView?.window {
            return window
        }
        return ASPresentationAnchor()
    }

    // MARK: - Helpers

    private static func randomURLSafeString(byteCount: Int) -> String {
        var bytes = [UInt8](repeating: 0, count: byteCount)
        let status = SecRandomCopyBytes(kSecRandomDefault, byteCount, &bytes)
        if status != errSecSuccess {
            // Fallback improvável; ainda assim aleatório o bastante para PKCE/state.
            for index in 0..<byteCount {
                bytes[index] = UInt8.random(in: 0...255)
            }
        }
        return base64URLEncode(Data(bytes))
    }

    private static func base64URLEncode(_ data: Data) -> String {
        return data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private static func formEncode(_ params: [(String, String)]) -> String {
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~")
        return params.map { key, value in
            let encodedKey = key.addingPercentEncoding(withAllowedCharacters: allowed) ?? key
            let encodedValue = value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
            return "\(encodedKey)=\(encodedValue)"
        }.joined(separator: "&")
    }
}
