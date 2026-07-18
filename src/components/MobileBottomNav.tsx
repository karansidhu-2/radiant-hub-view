import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Wrench, ShoppingBag, ShoppingCart, CalendarPlus } from "lucide-react";
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur-sm md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-md grid-cols-5 items-stretch">
        {items.map((n) => {
          const active = n.exact ? path === n.to : path.startsWith(n.to);
          const Icon = n.icon;
          return (
            <li key={n.to} className="flex">
              <Link
                to={n.to}
                aria-label={n.to === "/cart" && hydrated && count > 0 ? `${n.label}, ${count} item${count === 1 ? "" : "s"}` : n.label}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                <span>{n.label}</span>
                {n.to === "/cart" && hydrated && count > 0 && (
                  <span aria-hidden="true" className="absolute right-3 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[color:var(--ember)] px-1 text-[10px] font-bold text-[color:var(--ember-foreground)]">
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
            aria-label="Book a service"
            className="mx-1 my-1.5 flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg gradient-cool text-[11px] font-semibold text-primary-foreground shadow-soft transition-opacity active:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <CalendarPlus className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
            <span>Book</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
