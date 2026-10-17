import AuthenticationServices
import CryptoKit
import UIKit

/// Native Sign in with Apple for online play. The game passes the identity token and the raw nonce to Firebase
/// (OAuthProvider "apple.com"); the authorization code lets it revoke the token when the player deletes the account.
@MainActor
final class AppleSignIn: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    private var rawNonce = ""
    private var completion: (([String: String]) -> Void)?
    weak var anchor: UIWindow?

    func start(_ done: @escaping ([String: String]) -> Void) {
        completion = done
        rawNonce = Self.randomNonce()
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = SHA256.hash(data: Data(rawNonce.utf8)).map { String(format: "%02x", $0) }.joined()
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        anchor ?? UIWindow()
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let cred = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = cred.identityToken, let token = String(data: tokenData, encoding: .utf8) else {
            finish(["error": "Không nhận được mã xác thực"])
            return
        }
        var out = ["idToken": token, "rawNonce": rawNonce]
        if let code = cred.authorizationCode.flatMap({ String(data: $0, encoding: .utf8) }) { out["code"] = code }
        let name = [cred.fullName?.givenName, cred.fullName?.familyName].compactMap { $0 }.joined(separator: " ")
        if !name.isEmpty { out["name"] = name }
        finish(out)
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        let cancelled = (error as? ASAuthorizationError)?.code == .canceled
        finish(["error": cancelled ? "cancel" : error.localizedDescription])
    }

    private func finish(_ result: [String: String]) {
        completion?(result)
        completion = nil
    }

    private static func randomNonce(length: Int = 32) -> String {
        let chars = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var bytes = [UInt8](repeating: 0, count: length)
        _ = SecRandomCopyBytes(kSecRandomDefault, length, &bytes)
        return String(bytes.map { chars[Int($0) % chars.count] })
    }
}
