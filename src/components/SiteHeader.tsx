import { Link } from "@tanstack/react-router";
import { LogIn, LogOut, Menu, Phone, Shield, ShoppingCart, Wind, X } from "lucide-react";
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
  const { user, signOut } = useAuth();
  const settings = useSiteSettings();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="grid h-9 w-9 place-items-center rounded-lg gradient-cool text-primary-foreground shadow-soft">
            <Wind className="h-5 w-5" strokeWidth={2.4} />
          </span>
          <span>{settings.company_name}</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={telHref(settings.support_phone)}
            className="hidden items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-accent md:inline-flex"
          >
            <Phone className="h-4 w-4" />
            {settings.support_phone}
          </a>
          <Link to="/cart" className="relative">
            <Button variant="outline" size="icon" aria-label="Cart">
              <ShoppingCart className="h-4 w-4" />
            </Button>
            {hydrated && count > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[color:var(--ember)] px-1 text-[11px] font-bold text-[color:var(--ember-foreground)]">
                {count}
              </span>
            )}
          </Link>
          {user ? (
            <>
              <Link to="/admin" className="hidden md:block" title="Admin">
                <Button variant="outline" size="icon"><Shield className="h-4 w-4" /></Button>
              </Link>
              <Button variant="outline" size="icon" onClick={() => signOut()} className="hidden md:inline-flex" title="Sign out"><LogOut className="h-4 w-4" /></Button>
            </>
          ) : (
            <Link to="/auth" search={{ redirect: "/" }} className="hidden md:block">
              <Button variant="outline" size="icon" title="Sign in"><LogIn className="h-4 w-4" /></Button>
            </Link>
          )}
          <Link to="/book" className="hidden md:block">
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
        <div className="border-t border-border md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                {n.label}
              </Link>
            ))}
            <a href={telHref(settings.support_phone)} className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent">
              📞 {settings.support_phone}
            </a>
            <Link to="/book" onClick={() => setOpen(false)}>
              <Button className="mt-2 w-full gradient-cool text-primary-foreground">Book Service</Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
