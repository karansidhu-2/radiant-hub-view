import { useRouter, useRouterState } from "@tanstack/react-router";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import { useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  label?: string;
  className?: string;
  /** Route to navigate to when there's no prior history (e.g. direct deep link or refresh). */
  fallback?: string;
  /** Always navigate to the fallback route instead of browser history. */
  alwaysUseFallback?: boolean;
};

// Derive a friendly parent label from a pathname (e.g. "/shop/ac-unit" -> "Shop").
function labelForPath(path: string): string {
  if (!path || path === "/") return "Home";
  const seg = path.split("?")[0].split("/").filter(Boolean)[0] ?? "";
  const map: Record<string, string> = {
    shop: "Shop",
    services: "Services",
    book: "Booking",
    cart: "Cart",
    account: "Account",
    admin: "Admin",
    auth: "Sign in",
    checkout: "Checkout",
    order: "Order",
    booking: "Booking",
  };
  return map[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
}

/**
 * Safe, mobile-friendly back button:
 * - 44px tap target on mobile with contextual parent label.
 * - Uses SPA history when there's a real previous entry in this tab.
 * - Falls back to a sensible default route on deep links / refresh.
 * - Debounced to prevent double-navigation on rapid taps.
 * - Fires a short haptic pulse on supported devices.
 */
export function BackButton({ label, className, fallback, alwaysUseFallback = false }: Props) {
  const router = useRouter();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const busy = useRef(false);

  const defaultFallback = pathname.startsWith("/admin") ? "/admin" : "/";
  const target = fallback ?? defaultFallback;

  // Prefer explicit label; otherwise infer from parent segment.
  const computedLabel = useMemo(() => {
    if (label) return label;
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length <= 1) return labelForPath(target);
    return labelForPath("/" + parts.slice(0, -1).join("/"));
  }, [label, pathname, target]);

  const onClick = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    setTimeout(() => (busy.current = false), 400);

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate?.(8); } catch { /* noop */ }
    }

    if (alwaysUseFallback) {
      router.navigate({ to: target });
      return;
    }

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
  }, [alwaysUseFallback, router, target]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      aria-label={`Back to ${computedLabel}`}
      className={`gap-1.5 -ml-2 h-11 px-3 text-sm md:h-9 md:px-2 ${className ?? ""}`}
    >
      <ArrowLeft className="h-5 w-5 md:h-4 md:w-4" aria-hidden="true" />
      <span className="font-medium">{computedLabel}</span>
    </Button>
  );
}
