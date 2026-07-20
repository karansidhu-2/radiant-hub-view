import { Link } from "@tanstack/react-router";
import { LogIn, LogOut, Menu, Phone, Shield, ShoppingCart, User as UserIcon, Wind, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSettings, telHref } from "@/hooks/useSiteSettings";

const nav = [
  { to: "/services", label: "Services" },
  { to: "/shop", label: "Shop" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const { count, hydrated } = useCart();
  const { user, isAdmin, signOut } = useAuth();
  const settings = useSiteSettings();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 md:bg-background/95 md:backdrop-blur-none">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:h-16 md:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2 text-base font-bold tracking-tight md:text-lg">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg gradient-cool text-primary-foreground shadow-soft md:h-9 md:w-9">
            <Wind className="h-4 w-4 md:h-5 md:w-5" strokeWidth={2.4} />
          </span>
          <span className="truncate">{settings.company_name}</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              activeProps={{ className: "text-foreground", "aria-current": "page" } as any}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={telHref(settings.support_phone)}
            aria-label={`Call ${settings.support_phone}`}
            className="hidden items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:inline-flex"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            {settings.support_phone}
          </a>
          <Link to="/cart" aria-label={hydrated && count > 0 ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart"} className="relative hidden md:block">
            <Button variant="outline" size="icon" aria-label={hydrated && count > 0 ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart"}>
              <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            </Button>
            {hydrated && count > 0 && (
              <span aria-hidden="true" className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[color:var(--ember)] px-1 text-[11px] font-bold text-[color:var(--ember-foreground)]">
                {count}
              </span>
            )}
          </Link>
          {user ? (
            <>
              <Link to="/account" className="hidden md:block" title="My account">
                <Button variant="outline" size="icon" aria-label="My account"><UserIcon className="h-4 w-4" /></Button>
              </Link>
              {isAdmin && (
                <Link to="/admin" className="hidden md:block" title="Admin">
                  <Button variant="outline" size="icon" aria-label="Admin"><Shield className="h-4 w-4" /></Button>
                </Link>
              )}
              <Button variant="outline" size="icon" onClick={() => signOut()} className="hidden md:inline-flex" title="Sign out" aria-label="Sign out"><LogOut className="h-4 w-4" /></Button>
            </>
          ) : (
            <Link to="/auth" search={{ redirect: "/" }} className="hidden md:block">
              <Button variant="outline" size="sm" className="gap-1.5" title="Sign in" aria-label="Sign in">
                <LogIn className="h-4 w-4" />
                <span className="text-xs font-semibold">Sign in</span>
              </Button>
            </Link>
          )}

          <Link to="/book" search={{ service: undefined }} className="hidden md:block">
            <Button className="gradient-cool text-primary-foreground shadow-soft hover:opacity-95">
              Book Service
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="animate-rise-in border-t border-border bg-background/95 backdrop-blur-md md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center rounded-md px-3 text-[15px] font-medium text-foreground hover:bg-accent active:bg-accent/70"
              >
                {n.label}
              </Link>
            ))}
            <a href={telHref(settings.support_phone)} className="flex min-h-11 items-center gap-2 rounded-md px-3 text-[15px] font-medium text-foreground hover:bg-accent">
              <Phone className="h-4 w-4" /> {settings.support_phone}
            </a>
            {user ? (
              <>
                <Link to="/account" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-2 rounded-md px-3 text-[15px] font-medium text-foreground hover:bg-accent">
                  <UserIcon className="h-4 w-4" /> My account
                </Link>
                {isAdmin && (
                  <Link to="/admin" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-2 rounded-md px-3 text-[15px] font-medium text-foreground hover:bg-accent">
                    <Shield className="h-4 w-4" /> Admin panel
                  </Link>
                )}
                <Link to="/reviews" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-2 rounded-md px-3 text-[15px] font-medium text-foreground hover:bg-accent">
                  <Shield className="h-4 w-4" /> My reviews
                </Link>
                <button
                  onClick={() => { setOpen(false); signOut(); }}
                  className="flex min-h-11 items-center gap-2 rounded-md px-3 text-left text-[15px] font-medium text-foreground hover:bg-accent"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </>
            ) : (
              <Link to="/auth" search={{ redirect: "/" }} onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-2 rounded-md px-3 text-[15px] font-medium text-foreground hover:bg-accent">
                <LogIn className="h-4 w-4" /> Sign in
              </Link>
            )}
            <Link to="/book" search={{ service: undefined }} onClick={() => setOpen(false)}>
              <Button className="mt-2 h-11 w-full gradient-cool text-primary-foreground">Book Service</Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
