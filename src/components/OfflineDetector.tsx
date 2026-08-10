import { useEffect, useRef, useState } from "react";
import WifiOff from "lucide-react/dist/esm/icons/wifi-off";
import Wifi from "lucide-react/dist/esm/icons/wifi";
import X from "lucide-react/dist/esm/icons/x";

/**
 * Only shows a banner when the browser actually fires an `offline` event,
 * and briefly confirms when `online` fires afterward. We deliberately do
 * NOT trust `navigator.onLine` on first render — in iframes / previews /
 * some browsers it can report `false` even when the network is fine.
 *
 * Behavior:
 *  - Cooldown: after showing an offline banner we suppress re-showing for
 *    COOLDOWN_MS so flaky "quick reconnect" bounces don't spam the banner.
 *  - Manual dismiss: user can close the banner; dismissal is remembered in
 *    sessionStorage for the current tab session.
 */
const COOLDOWN_MS = 15_000;
const DISMISS_KEY = "offline-banner-dismissed";

export function OfflineDetector() {
  const [state, setState] = useState<"idle" | "offline" | "restored">("idle");
  const restoreTimer = useRef<number | null>(null);
  const lastShownAt = useRef<number>(0);
  const dismissed = useRef<boolean>(false);

  useEffect(() => {
    try {
      dismissed.current = sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // sessionStorage may throw in sandboxed iframes; treat as not dismissed.
    }

    const goOffline = () => {
      if (dismissed.current) return;
      const now = Date.now();
      if (now - lastShownAt.current < COOLDOWN_MS) return; // cooldown active
      lastShownAt.current = now;
      if (restoreTimer.current) window.clearTimeout(restoreTimer.current);
      setState("offline");
    };
    const goOnline = () => {
      setState((prev) => (prev === "offline" ? "restored" : prev));
      if (restoreTimer.current) window.clearTimeout(restoreTimer.current);
      restoreTimer.current = window.setTimeout(() => setState("idle"), 2500);
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      if (restoreTimer.current) window.clearTimeout(restoreTimer.current);
    };
  }, []);

  if (state === "idle") return null;
  const online = state === "restored";

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    dismissed.current = true;
    setState("idle");
  };

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
      data-state={state}
      className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex justify-center px-3 sm:top-4"
    >
      <div
        className={`pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300 ${
          online
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
        }`}
      >
        {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
        <span>{online ? "Back online" : "You're offline — some features may not work"}</span>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss offline notification"
          data-testid="offline-banner-dismiss"
          className="ml-1 -mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full opacity-70 transition hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
