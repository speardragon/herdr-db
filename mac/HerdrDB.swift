// Herdr DB — a thin native window around the local viewer (http://127.0.0.1:<port>/).
// Build with mac/build.sh. Runs as a menu-bar (accessory) app: no Dock icon.
// The web UI posts {type: "reveal"} when a new MongoDB MCP call arrives; the window then comes to
// the front without taking keyboard focus from the terminal. {type: "quit"} is sent when the user
// switches the viewer to browser mode.
import Cocoa
import WebKit

/// Accessory apps have no visible menu bar, so standard editing shortcuts are routed here.
final class ViewerWebView: WKWebView {
    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        guard flags == .command, let key = event.charactersIgnoringModifiers?.lowercased() else {
            return super.performKeyEquivalent(with: event)
        }
        let editing: [String: Selector] = [
            "c": #selector(NSText.copy(_:)),
            "x": #selector(NSText.cut(_:)),
            "v": #selector(NSText.paste(_:)),
            "a": #selector(NSText.selectAll(_:)),
            "z": Selector(("undo:")),
        ]
        if let action = editing[key], NSApp.sendAction(action, to: nil, from: self) { return true }
        switch key {
        case "w":
            window?.performClose(nil)
            return true
        case "r":
            reload()
            return true
        case "q":
            NSApp.terminate(nil)
            return true
        default:
            return super.performKeyEquivalent(with: event)
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate {
    private var window: NSWindow!
    private var webView: ViewerWebView!
    private var statusItem: NSStatusItem!
    // Keyed by the page's menu-title keys so the page can relabel them when its language changes.
    private var menuItems: [String: NSMenuItem] = [:]
    private var retryTimer: Timer?
    private let baseURL: URL

    override init() {
        let portArgument = CommandLine.arguments.first { $0.hasPrefix("--port=") }
        let port = portArgument.flatMap { Int($0.dropFirst("--port=".count)) } ?? 47917
        baseURL = URL(string: "http://127.0.0.1:\(port)/")!
        super.init()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildWindow()
        buildStatusItem()
        load()
        window.orderFrontRegardless()
    }

    // The hook's `open -g -a` reopens a running app in the background: show the window, keep focus where it is.
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if NSApp.isActive {
            window.makeKeyAndOrderFront(nil)
        } else {
            window.orderFrontRegardless()
        }
        return false
    }

    // Closing the window keeps the app (and its live event stream) running in the menu bar.
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

    private func buildWindow() {
        let controller = WKUserContentController()
        controller.add(self, name: "herdrdb")
        let config = WKWebViewConfiguration()
        config.userContentController = controller
        config.websiteDataStore = .default()

        webView = ViewerWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.setValue(false, forKey: "drawsBackground")

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1280, height: 820),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Herdr DB"
        window.isReleasedWhenClosed = false
        window.contentView = webView
        window.center()
        window.setFrameAutosaveName("HerdrDBMainWindow")
        window.collectionBehavior = [.moveToActiveSpace]
    }

    private func buildStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let button = statusItem.button {
            let image = NSImage(systemSymbolName: "leaf.fill", accessibilityDescription: "Herdr DB")
            image?.isTemplate = true
            button.image = image
        }
        // Until the page loads and sends its own titles, follow the system language.
        let korean = Locale.preferredLanguages.first?.hasPrefix("ko") ?? false
        let menu = NSMenu()
        menu.addItem(item("open", korean ? "Herdr DB 열기" : "Open Herdr DB", #selector(showWindow)))
        menu.addItem(item("settings", korean ? "설정…" : "Settings…", #selector(showSettings), key: ","))
        menu.addItem(item("browser", korean ? "브라우저에서 열기" : "Open in Browser", #selector(openInBrowser)))
        menu.addItem(.separator())
        menu.addItem(item("quit", korean ? "Herdr DB 종료" : "Quit Herdr DB", #selector(quit), key: "q"))
        statusItem.menu = menu
    }

    private func applyMenuTitles(_ titles: [String: Any]) {
        for (key, value) in titles {
            if let title = value as? String, !title.isEmpty { menuItems[key]?.title = title }
        }
    }

    private func item(_ id: String, _ title: String, _ action: Selector, key: String = "") -> NSMenuItem {
        let menuItem = NSMenuItem(title: title, action: action, keyEquivalent: key)
        menuItem.target = self
        menuItems[id] = menuItem
        return menuItem
    }

    private func load() {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "client", value: "app")]
        webView.load(URLRequest(url: components.url!, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 5))
    }

    // The server may still be starting when the hook launches the app.
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        scheduleRetry()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        scheduleRetry()
    }

    private func scheduleRetry() {
        retryTimer?.invalidate()
        retryTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: false) { [weak self] _ in self?.load() }
    }

    // Links to other sites open in the default browser instead of inside the viewer.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url, url.host != baseURL.host || url.port != baseURL.port {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "reveal":
            if window.isMiniaturized { window.deminiaturize(nil) }
            window.orderFrontRegardless()
            if let title = body["title"] as? String, !title.isEmpty { window.title = "Herdr DB — \(title)" }
        case "activate":
            showWindow()
        case "quit":
            NSApp.terminate(nil)
        case "menu":
            if let titles = body["titles"] as? [String: Any] { applyMenuTitles(titles) }
        default:
            break
        }
    }

    @objc private func showWindow() {
        NSApp.activate(ignoringOtherApps: true)
        window.makeKeyAndOrderFront(nil)
    }

    @objc private func showSettings() {
        showWindow()
        webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('herdrdb:navigate', { detail: 'settings' }))")
    }

    @objc private func openInBrowser() {
        NSWorkspace.shared.open(baseURL)
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
