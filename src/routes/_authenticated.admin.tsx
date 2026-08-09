import { createFileRoute, Outlet, Link, useRouterState, useNavigate, useRouter, redirect } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, Shield, LayoutDashboard, Wrench, Package, Calendar, CalendarDays, ShoppingBag, MapPin, UserCog, Settings, Star, Bell, Inbox, ScrollText, Users, KeyRound, Activity, Calculator } from "lucide-react";
import { CapacityAlerts } from "@/components/admin/CapacityAlerts";
import { NewBookingNotifier } from "@/components/admin/NewBookingNotifier";
import { isCurrentUserAdmin } from "@/lib/hvac.functions";

// Authorization is decided on the server: `isCurrentUserAdmin` runs behind
// `requireSupabaseAuth` and checks `has_role(uid,'admin')` in the database, so a
// tampered client can never paint (or fetch) admin surfaces. The verdict is
// cached in TanStack Query for 5 minutes and warmed by link preloading, so
// re-entering /admin is instant instead of a fresh round-trip every time.
const adminVerdictQuery = {
  queryKey: ["admin", "verdict"] as const,
  queryFn: () => isCurrentUserAdmin(),
  staleTime: 5 * 60_000,
  gcTime: 10 * 60_000,
  retry: 0,
};

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    let ok = false;
    try {
      ok = Boolean(await (context as any).queryClient.ensureQueryData(adminVerdictQuery));
    } catch {
      ok = false;
    }
    if (!ok) throw redirect({ to: "/account" });
    return { isAdminVerified: true as const };
  },
  component: AdminLayout,
});




const nav: { to: string; label: string; icon: any; exact?: boolean }[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/services", label: "Services", icon: Wrench },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/bookings", label: "Bookings", icon: Calendar },
  { to: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/reviews", label: "Reviews", icon: Star },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
  { to: "/admin/inbox", label: "Inbox", icon: Inbox },
  { to: "/admin/quote-leads", label: "Quote Leads", icon: Calculator },


  { to: "/admin/zips", label: "Service Areas", icon: MapPin },
  { to: "/admin/technicians", label: "Technicians", icon: Users },
  { to: "/admin/admins", label: "Admins", icon: UserCog },
  { to: "/admin/audit", label: "Audit log", icon: ScrollText },
  { to: "/admin/observability", label: "Observability", icon: Activity },
  { to: "/admin/security", label: "Security (2FA)", icon: KeyRound },
  { to: "/admin/settings", label: "Site Settings", icon: Settings },

];

function AdminLayout() {
  const navigate = useNavigate();
  const router = useRouter();
  const { user, isAdmin, loading } = useAuth();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const email = user?.email ?? "";

  // Optimistically trust a previously-verified verdict so navigating back into
  // /admin paints immediately rather than showing a blocking "Loading…".
  const [cached, setCached] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return sessionStorage.getItem(ADMIN_CACHE_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    if (isAdmin) {
      setCached(true);
      try { sessionStorage.setItem(ADMIN_CACHE_KEY, "1"); } catch { /* ignore */ }
    } else if (!loading && user) {
      setCached(false);
      try { sessionStorage.removeItem(ADMIN_CACHE_KEY); } catch { /* ignore */ }
    }
  }, [isAdmin, loading, user]);

  const state: "loading" | "admin" | "denied" =
    isAdmin || cached ? "admin" : loading || !user ? "loading" : "denied";

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
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 md:px-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.history.back()} className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <div className="hidden items-center gap-2 font-bold sm:flex"><Shield className="h-5 w-5 text-primary" /> Admin Panel</div>
          </div>
          <div className="flex items-center gap-2">
            <NewBookingNotifier />
            <Link to="/">
              <Button variant="outline" size="sm" className="gap-1"><Home className="h-4 w-4" /> <span className="hidden sm:inline">Home</span></Button>
            </Link>
            <div className="hidden text-xs text-muted-foreground md:block">{email}</div>
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-6 px-3 py-5 md:grid-cols-[220px_minmax(0,1fr)] md:px-6 md:py-6">
        <aside className="min-w-0 max-w-full overflow-hidden md:sticky md:top-4 md:self-start md:overflow-visible">
          <nav className="-mx-3 flex gap-1 overflow-x-auto px-3 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0">
            {nav.map((n) => {
              const active = n.exact ? path === n.to : path.startsWith(n.to);
              return (
                <Link key={n.to} to={n.to as any}
                  className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition-colors md:rounded-md md:px-3 ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-accent md:bg-transparent"}`}>
                  <n.icon className="h-4 w-4" /> {n.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0 max-w-full overflow-x-hidden"><CapacityAlerts /><Outlet /></main>
      </div>
    </div>
  );
}
