import UIKit
import WebKit

/// Hosts the HTML game (www/en.html or www/vi.html) in a full-screen web view.
final class GameViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private var webView: WKWebView!
    private static let background = UIColor(red: 0.043, green: 0.071, blue: 0.125, alpha: 1)
    private static let languageKey = "language"
    private let pro = ProStore()

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
    override var prefersHomeIndicatorAutoHidden: Bool { true }

    override func loadView() {
        let config = WKWebViewConfiguration()
        // A fixed origin (app://game) keeps localStorage, and with it the saved game, across launches.
        config.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: BundleSchemeHandler.scheme)
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.userContentController.add(LanguageHandler(owner: self), name: "lang")
        config.userContentController.add(ProHandler(owner: self), name: "pro")

        webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = Self.background
        webView.scrollView.backgroundColor = Self.background
        webView.scrollView.bounces = false
        webView.allowsLinkPreview = false
        webView.navigationDelegate = self
        webView.uiDelegate = self

        let root = UIView()
        root.backgroundColor = Self.background
        webView.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: root.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: root.safeAreaLayoutGuide.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: root.trailingAnchor),
        ])
        view = root
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        load(language: UserDefaults.standard.string(forKey: Self.languageKey) ?? Self.deviceLanguage)
        pro.onChange = { [weak self] in self?.sendProState() }
        Task { await pro.refresh() }
    }

    // MARK: PRO (in-app purchase)

    private func sendProState(error: String? = nil) {
        webView.evaluateJavaScript("window.proUpdate&&window.proUpdate(\(pro.stateJSON(error: error)))")
    }

    func handlePro(_ action: String, id: String) {
        Task {
            switch action {
            case "buy": sendProState(error: await pro.buy(id))
            case "restore": sendProState(error: await pro.restore())
            default: sendProState()
            }
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        sendProState()
    }

    private static var deviceLanguage: String {
        (Locale.preferredLanguages.first ?? "en").hasPrefix("vi") ? "vi" : "en"
    }

    func load(language: String) {
        let lang = language == "vi" ? "vi" : "en"
        // Screenshot runs pass e.g. -demo board; the game reads it from the URL hash.
        let args = ProcessInfo.processInfo.arguments
        var hash = ""
        if let i = args.firstIndex(of: "-demo"), i + 1 < args.count { hash = "#demo-" + args[i + 1] }
        webView.load(URLRequest(url: URL(string: "\(BundleSchemeHandler.scheme)://game/\(lang).html\(hash)")!))
    }

    func switchLanguage(to lang: String) {
        UserDefaults.standard.set(lang, forKey: Self.languageKey)
        load(language: lang)
    }

    // External links (privacy page, etc.) open in Safari; everything else stays in the game.
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = action.request.url, url.scheme == "https", action.navigationType == .linkActivated {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    // Links with target="_blank" (terms of use, privacy policy) open in Safari.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url, url.scheme == "https" { UIApplication.shared.open(url) }
        return nil
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }

    // MARK: alert() / confirm() / prompt() from the game

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: cancelTitle, style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        alert.addTextField { $0.text = defaultText }
        alert.addAction(UIAlertAction(title: cancelTitle, style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(alert.textFields?.first?.text) })
        present(alert, animated: true)
    }

    private var cancelTitle: String {
        webView.url?.lastPathComponent == "vi.html" ? "Huỷ" : "Cancel"
    }
}

/// Receives PRO purchase requests (webkit.messageHandlers.pro: {action: "buy" | "restore" | "status"}).
private final class ProHandler: NSObject, WKScriptMessageHandler {
    weak var owner: GameViewController?
    init(owner: GameViewController) { self.owner = owner }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        let body = message.body as? [String: Any]
        owner?.handlePro(body?["action"] as? String ?? "status", id: body?["id"] as? String ?? "")
    }
}

/// Receives the in-game language button (webkit.messageHandlers.lang). Holds the controller weakly to avoid a retain cycle.
private final class LanguageHandler: NSObject, WKScriptMessageHandler {
    weak var owner: GameViewController?
    init(owner: GameViewController) { self.owner = owner }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let lang = message.body as? String, ["en", "vi"].contains(lang) else { return }
        owner?.switchLanguage(to: lang)
    }
}
