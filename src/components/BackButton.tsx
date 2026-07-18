import { useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
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

  const defaultFallback = pathname.startsWith("/admin") ? "/admin" : "/";
  const target = fallback ?? defaultFallback;

  const onClick = () => {
    // Prefer the router index recorded in history.state — it's authoritative
    // for whether there's a real prior SPA entry in this tab. If we can't
    // determine that (deep link, refresh, external referrer), navigate to
    // the fallback route so the user always lands somewhere useful.
    if (typeof window !== "undefined") {
      const state: any = window.history.state;
      const idx = state?.__TSR_index ?? state?.index;
      const sameOriginReferrer =
        !!document.referrer && document.referrer.startsWith(window.location.origin);
      const canGoBack = (typeof idx === "number" && idx > 0) || sameOriginReferrer;
      if (canGoBack) {
        router.history.back();
        return;
      }
    }
    router.navigate({ to: target });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      aria-label={`Back to ${target === "/" ? "home" : target}`}
      className={`gap-1 -ml-2 ${className ?? ""}`}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {label}
    </Button>
  );
}
