import { createFileRoute, Outlet, Link, useRouterState, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { isCurrentUserAdmin } from "@/lib/hvac.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, Shield, LayoutDashboard, Wrench, Package, Calendar, ShoppingBag, MapPin, UserCog, Settings } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const nav: { to: string; label: string; icon: any; exact?: boolean }[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/services", label: "Services", icon: Wrench },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/bookings", label: "Bookings", icon: Calendar },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/zips", label: "Service Areas", icon: MapPin },
  { to: "/admin/admins", label: "Admins", icon: UserCog },
  { to: "/admin/settings", label: "Site Settings", icon: Settings },
];

function AdminLayout() {
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "admin" | "denied">("loading");
  const [email, setEmail] = useState("");
  const check = useServerFn(isCurrentUserAdmin);
  const path = useRouterState({ select: (r) => r.location.pathname });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    check().then((isAdmin) => setState(isAdmin ? "admin" : "denied"));
  }, [check]);

  if (state === "loading") return <div className="p-16 text-center">Loading…</div>;
  if (state === "denied") {
    return (
      <div className="mx-auto max-w-md p-16 text-center">
        <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-3 text-xl font-bold">Admin access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Signed in as <b>{email}</b>. Ask an existing admin to invite your email from the Admins page.
        </p>
        <Button className="mt-4" onClick={() => navigate({ to: "/" })}>Back</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/20">
      <div className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-2 font-bold"><Shield className="h-5 w-5 text-primary" /> Admin Panel</div>
          <div className="text-xs text-muted-foreground">{email}</div>
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[220px_1fr] md:px-6">
        <aside>
          <nav className="flex flex-col gap-1">
            {nav.map((n) => {
              const active = n.exact ? path === n.to : path.startsWith(n.to);
              return (
                <Link key={n.to} to={n.to as any}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
                  <n.icon className="h-4 w-4" /> {n.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main><Outlet /></main>
      </div>
    </div>
  );
}
