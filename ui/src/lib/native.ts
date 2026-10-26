// Bridge to the macOS host app (mac/HerdrDB.swift). No-ops in a regular browser.
interface NativeBridge {
  postMessage(message: { type: 'reveal' | 'activate' | 'quit'; title?: string }): void;
}

function bridge(): NativeBridge | undefined {
  return (window as unknown as { webkit?: { messageHandlers?: { herdrdb?: NativeBridge } } }).webkit?.messageHandlers?.herdrdb;
}

export const isNativeApp = () => bridge() !== undefined;

/** Which kind of viewer this page is, reported to the server so it can count browser tabs. */
export const clientKind = () => (new URLSearchParams(window.location.search).get('client') === 'app' ? 'app' : 'browser');

/** Brings the window to the front without taking keyboard focus from the terminal. */
export function revealWindow(title?: string) {
  bridge()?.postMessage({ type: 'reveal', title });
}

export function activateWindow() {
  bridge()?.postMessage({ type: 'activate' });
}

/** Called when the user switches to browser mode: the native window is no longer wanted. */
export function quitNativeApp() {
  bridge()?.postMessage({ type: 'quit' });
}
