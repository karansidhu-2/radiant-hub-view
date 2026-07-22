import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/BackButton";
import { SwipeBackIndicator } from "@/components/SwipeBackIndicator";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  beforeLoad: async ({ location }) => {
    // Use getSession() (reads local storage, triggers refresh only if needed)
    // instead of getUser() which makes a network call on every navigation and
    // spuriously signs users out on transient network errors.
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    return { user: data.session.user };
  },
  component: AuthedLayout,
});


function AuthedLayout() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  // Admin has its own header/back navigation; skip the extra back row there.
  const showBack = !path.startsWith("/admin");
  return (
    <>
      <SwipeBackIndicator fallback="/" />
      {showBack && (
        <div className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md md:static md:z-auto md:border-0 md:bg-transparent md:backdrop-blur-none">
          <div className="mx-auto w-full max-w-7xl px-2 py-1 md:px-6 md:pt-3 md:pb-0">
            <BackButton fallback="/" alwaysUseFallback />
          </div>
        </div>
      )}
      <Outlet />
    </>
  );
}

