import { Link, useRouterState } from "@tanstack/react-router";
import Home from "lucide-react/dist/esm/icons/home";
import Wrench from "lucide-react/dist/esm/icons/wrench";
import ShoppingBag from "lucide-react/dist/esm/icons/shopping-bag";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import CalendarPlus from "lucide-react/dist/esm/icons/calendar-plus";
import { useCart } from "@/context/CartContext";

type NavItem = { to: "/" | "/services" | "/shop" | "/cart"; label: string; icon: typeof Home; exact?: boolean };
const items: NavItem[] = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/services", label: "Services", icon: Wrench },
  { to: "/shop", label: "Shop", icon: ShoppingBag },
  { to: "/cart", label: "Cart", icon: ShoppingCart },
];

export function MobileBottomNav() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { count, hydrated } = useCart();

  return (
    <nav
      aria-label="Primary mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/90 shadow-[0_-6px_20px_-12px_rgba(0,0,0,0.25)] backdrop-blur-lg supports-[backdrop-filter]:bg-background/75 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-md grid-cols-5 items-stretch px-1 pt-1">
        {items.map((n) => {
          const active = n.exact ? path === n.to : path.startsWith(n.to);
          const Icon = n.icon;
          return (
            <li key={n.to} className="flex">
              <Link
                to={n.to}
                // Touch devices never fire hover, so "intent" preloading never
                // triggers on mobile. The bottom bar is always on screen, so
                // viewport-preload warms every tab's chunk + data up front and
                // taps land on already-loaded routes.
                preload="viewport"
                aria-label={n.to === "/cart" && hydrated && count > 0 ? `${n.label}, ${count} item${count === 1 ? "" : "s"}` : n.label}
                aria-current={active ? "page" : undefined}

                className={`relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition-all duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute top-0 left-1/2 h-0.5 -translate-x-1/2 rounded-full bg-primary transition-all duration-300 ease-out ${
                    active ? "w-8 opacity-100" : "w-0 opacity-0"
                  }`}
                />
                <Icon
                  className={`h-[22px] w-[22px] transition-transform duration-200 ease-out ${active ? "scale-110" : "scale-100"}`}
                  strokeWidth={active ? 2.4 : 1.9}
                  aria-hidden="true"
                />
                <span className="leading-none">{n.label}</span>
                {n.to === "/cart" && hydrated && count > 0 && (
                  <span aria-hidden="true" className="absolute right-2 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[color:var(--ember)] px-1 text-[10px] font-bold text-[color:var(--ember-foreground)]">
                    {count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
        <li className="flex">
          <Link
            to="/book"
            search={{ service: undefined }}
            preload="viewport"

            aria-label="Book a service"
            className="mx-1 my-1 flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 rounded-xl gradient-cool text-[11px] font-semibold text-primary-foreground shadow-soft transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <CalendarPlus className="h-[22px] w-[22px]" strokeWidth={2.4} aria-hidden="true" />
            <span className="leading-none">Book</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
