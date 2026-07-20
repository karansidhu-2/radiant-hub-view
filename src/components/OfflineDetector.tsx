import { useEffect, useRef, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";

/**
 * Only shows a banner when the browser actually fires an `offline` event,
 * and briefly confirms when `online` fires afterward. We deliberately do
 * NOT trust `navigator.onLine` on first render — in iframes / previews /
 * some browsers it can report `false` even when the network is fine, which
 * caused the banner to appear for online users.
 */
export function OfflineDetector() {
  const [state, setState] = useState<"idle" | "offline" | "restored">("idle");
  const restoreTimer = useRef<number | null>(null);

  useEffect(() => {
    const goOffline = () => {
      if (restoreTimer.current) window.clearTimeout(restoreTimer.current);
      setState("offline");
    };
    const goOnline = () => {
      // Only celebrate a restore if we were actually offline before.
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

  return (
    <div
      role="status"
      aria-live="polite"
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
      </div>
    </div>
  );
}
