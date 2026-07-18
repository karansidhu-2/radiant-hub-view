import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { BackButton } from "@/components/BackButton";

export const Route = createFileRoute("/_site")({
  component: SiteLayout,
});

function SiteLayout() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const showBack = path !== "/" && path !== "";
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      {showBack && (
        <div className="mx-auto w-full max-w-7xl px-4 pt-3 md:px-6">
          <BackButton />
        </div>
      )}
      <main key={path} className="flex-1 animate-page-in">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
