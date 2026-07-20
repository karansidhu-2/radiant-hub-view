import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";

/**
 * Small toast-style banner that appears when the user goes offline and
 * briefly confirms when connectivity is restored. Non-blocking; individual
 * pages/queries can still show the full OfflinePage on failed fetches.
 */
export function OfflineDetector() {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const goOffline = () => {
      setOnline(false);
      setShowRestored(false);
    };
    const goOnline = () => {
      setOnline(true);
      setShowRestored(true);
      const t = setTimeout(() => setShowRestored(false), 2500);
      return () => clearTimeout(t);
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (online && !showRestored) return null;

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
