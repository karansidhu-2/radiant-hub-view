import { Link } from "@tanstack/react-router";
import { CalendarCheck, LogIn, LogOut, Phone, Shield, ShoppingBag, Star, User as UserIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSettings, telHref } from "@/hooks/useSiteSettings";

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
  const { user, signOut } = useAuth();
  const settings = useSiteSettings();

  const tiles: Tile[] = user
    ? [
        { key: "account", label: "My account", icon: UserIcon, to: "/account" },
        { key: "bookings", label: "My bookings", icon: CalendarCheck, to: "/account" },
        { key: "orders", label: "My orders", icon: ShoppingBag, to: "/account" },
        { key: "reviews", label: "My reviews", icon: Star, to: "/reviews" },
        { key: "admin", label: "Admin panel", icon: Shield, to: "/admin" },
        { key: "call", label: "Call us", icon: Phone, href: telHref(settings.support_phone) },
        { key: "signout", label: "Sign out", icon: LogOut, onClick: () => signOut() },
      ]
    : [
        { key: "signin", label: "Sign in", icon: LogIn, to: "/auth", accent: true },
        { key: "shop", label: "Shop", icon: ShoppingBag, to: "/shop" },
        { key: "call", label: "Call us", icon: Phone, href: telHref(settings.support_phone) },
      ];


  return (
    <section aria-label="Quick access" className="md:hidden">
      <div className="mx-auto max-w-7xl px-4 pt-4">
        <div className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tiles.map((t) => {
            const Icon = t.icon;
            const cls = `group flex min-w-[92px] shrink-0 snap-start flex-col items-center justify-center gap-1.5 rounded-xl border px-3 py-3 text-[11px] font-semibold transition-all active:scale-[0.97] ${
              t.accent
                ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                : "border-border/70 bg-card text-foreground hover:border-primary/30 hover:bg-accent/60"
            }`;
            const inner = (
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
                <span className="leading-tight">{t.label}</span>
              </>
            );
            if (t.to) {
              return (
                <Link
                  key={t.key}
                  to={t.to}
                  {...(t.to === "/auth" ? { search: { redirect: "/" } as any } : {})}
                  className={cls}
                >
                  {inner}
                </Link>
              );
            }
            if (t.href) {
              return (
                <a key={t.key} href={t.href} className={cls}>
                  {inner}
                </a>
              );
            }
            return (
              <button key={t.key} type="button" onClick={t.onClick} className={cls}>
                {inner}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
