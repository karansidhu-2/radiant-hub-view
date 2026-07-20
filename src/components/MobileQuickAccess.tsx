import { Link } from "@tanstack/react-router";
import { CalendarCheck, LogIn, LogOut, Phone, Shield, ShoppingBag, Star, User as UserIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSettings, telHref } from "@/hooks/useSiteSettings";

const LAST_TAP_STORAGE_KEY = "mqa:last-tapped";

type Tile = {
  key: string;
  label: string;
  icon: typeof UserIcon;
  to?: string;
  href?: string;
  onClick?: () => void;
  accent?: boolean;
};

/**
 * Compact mobile-only quick-access rail shown on the home page so the items
 * usually hidden behind the hamburger (My account, Admin, Reviews, …) are one
 * tap away without making the page feel busy. Uses a horizontal scroll row so
 * it never wraps into a crowded grid on small screens.
 */
export function MobileQuickAccess() {
  const { user, isAdmin, signOut } = useAuth();
  const settings = useSiteSettings();

  // Persist the last tile the user tapped so the highlight survives refresh
  // and navigation back to the home page during the same session.
  const [lastTapped, setLastTapped] = useState<string | null>(null);
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(LAST_TAP_STORAGE_KEY);
      if (stored) setLastTapped(stored);
    } catch {
      /* sessionStorage unavailable — ignore */
    }
  }, []);

  const rememberTap = useCallback((key: string) => {
    setLastTapped(key);
    try {
      sessionStorage.setItem(LAST_TAP_STORAGE_KEY, key);
    } catch {
      /* ignore */
    }
  }, []);


  const tiles: Tile[] = user
    ? [
        { key: "account", label: "My account", icon: UserIcon, to: "/account" },
        { key: "bookings", label: "My bookings", icon: CalendarCheck, to: "/account" },
        { key: "orders", label: "My orders", icon: ShoppingBag, to: "/account" },
        { key: "reviews", label: "My reviews", icon: Star, to: "/reviews" },
        ...(isAdmin ? [{ key: "admin", label: "Admin panel", icon: Shield, to: "/admin" } as Tile] : []),
        { key: "call", label: "Call us", icon: Phone, href: telHref(settings.support_phone) },
        { key: "signout", label: "Sign out", icon: LogOut, onClick: () => signOut() },
      ]
    : [
        { key: "signin", label: "Sign in", icon: LogIn, to: "/auth", accent: true },
        { key: "shop", label: "Shop", icon: ShoppingBag, to: "/shop" },
        { key: "call", label: "Call us", icon: Phone, href: telHref(settings.support_phone) },
      ];


  // Few tiles (signed-out): render an even grid so buttons align edge-to-edge
  // instead of clustering on the left. Many tiles (signed-in): keep the
  // horizontal snap rail so nothing gets cramped.
  const useGrid = tiles.length <= 4;

  const tileClass = (accent?: boolean) =>
    `group flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-[11px] font-semibold transition-all active:scale-[0.97] ${
      accent
        ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
        : "border-border/70 bg-card text-foreground hover:border-primary/30 hover:bg-accent/60"
    } ${useGrid ? "w-full" : "min-w-[92px] shrink-0 snap-start"}`;

  const renderInner = (t: Tile) => {
    const Icon = t.icon;
    return (
      <>
        <span
          className={`grid h-9 w-9 place-items-center rounded-lg ${
            t.accent
              ? "gradient-cool text-primary-foreground shadow-soft"
              : "bg-secondary text-secondary-foreground"
          }`}
        >
          <Icon className="h-4 w-4" strokeWidth={2.3} />
        </span>
        <span className="w-full truncate text-center leading-tight">{t.label}</span>
      </>
    );
  };

  const renderTile = (t: Tile) => {
    const cls = tileClass(t.accent);
    if (t.to) {
      return (
        <Link
          key={t.key}
          to={t.to}
          {...(t.to === "/auth" ? { search: { redirect: "/" } as any } : {})}
          className={cls}
        >
          {renderInner(t)}
        </Link>
      );
    }
    if (t.href) {
      return (
        <a key={t.key} href={t.href} className={cls}>
          {renderInner(t)}
        </a>
      );
    }
    return (
      <button key={t.key} type="button" onClick={t.onClick} className={cls}>
        {renderInner(t)}
      </button>
    );
  };

  return (
    <section aria-label="Quick access" className="md:hidden">
      <div className="mx-auto max-w-7xl px-4 pt-4">
        {useGrid ? (
          <div
            className="grid gap-2.5"
            style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}
          >
            {tiles.map(renderTile)}
          </div>
        ) : (
          <div className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tiles.map(renderTile)}
          </div>
        )}
      </div>
    </section>
  );
}

