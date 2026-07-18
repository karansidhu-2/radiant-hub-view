import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { BackButton } from "@/components/BackButton";
import { MobileBottomNav } from "@/components/MobileBottomNav";

export const Route = createFileRoute("/_site")({
  component: SiteLayout,
});

function SiteLayout() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const showBack = path !== "/" && path !== "";
  return (
    <div className="flex min-h-screen flex-col pb-16 md:pb-0">
      <SiteHeader />
      {showBack && (
        <div className="mx-auto w-full max-w-7xl px-4 pt-3 md:px-6">
          <BackButton />
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

