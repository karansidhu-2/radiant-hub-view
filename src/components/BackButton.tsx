import { useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  label?: string;
  className?: string;
  /** Route to navigate to when there's no prior history (e.g. direct deep link or refresh). */
  fallback?: string;
};

/**
 * Safe back button:
 * - Uses router history when there's a real previous entry in this tab session.
 * - Falls back to a sensible default route on direct deep links or after a refresh
 *   (refresh resets our session marker even though window.history.length may be > 1).
 * - Never navigates back to the same URL we're already on.
 */
export function BackButton({ label = "Back", className, fallback }: Props) {
  const router = useRouter();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [canGoBack, setCanGoBack] = useState(false);

  // Track whether the user has navigated within this SPA session.
  // sessionStorage persists across in-tab navigations but resets on hard refresh
  // and doesn't exist for freshly-opened deep links.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const KEY = "__nav_depth__";
    const prev = Number(window.sessionStorage.getItem(KEY) ?? "0");
    const next = prev + 1;
    window.sessionStorage.setItem(KEY, String(next));
    setCanGoBack(next > 1);
  }, [pathname]);

  const defaultFallback = pathname.startsWith("/admin") ? "/admin" : "/";
  const target = fallback ?? defaultFallback;

  const onClick = () => {
    if (canGoBack) {
      router.history.back();
      return;
    }
    if (pathname !== target) {
      router.navigate({ to: target });
    } else {
      router.navigate({ to: "/" });
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      aria-label={canGoBack ? "Go back" : `Go to ${target}`}
      className={`gap-1 -ml-2 ${className ?? ""}`}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {label}
    </Button>
  );
}
