import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { BackButton } from "@/components/BackButton";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { SwipeBackIndicator } from "@/components/SwipeBackIndicator";

export const Route = createFileRoute("/_site")({
  component: SiteLayout,
});

function SiteLayout() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const showBack = path !== "/" && path !== "";
  
  return (
    <div className="flex min-h-screen flex-col pb-20 md:pb-0">
      <SwipeBackIndicator fallback="/" />
      <SiteHeader />
      {showBack && (
        <div className="sticky top-14 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md md:static md:top-auto md:z-auto md:border-0 md:bg-transparent md:backdrop-blur-none">
          <div className="mx-auto w-full max-w-7xl px-2 py-1 md:px-6 md:pt-3 md:pb-0">
            <BackButton />
          </div>
        </div>
      )}
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
      <MobileBottomNav />
    </div>
  );
}
