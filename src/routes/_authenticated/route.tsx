import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/BackButton";
import { SwipeBackIndicator } from "@/components/SwipeBackIndicator";
import { hardClearAuthStorage } from "@/lib/remember-me";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getSession();
    const session = data?.session;
    const expiresAt = session?.expires_at ? session.expires_at * 1000 : 0;
    const expired = !session || (expiresAt && expiresAt < Date.now()) || !!error;
    if (expired) {
      hardClearAuthStorage();
      if (typeof window !== "undefined" && session) {
        try { sessionStorage.setItem("hvac:auth:expired", "1"); } catch { /* ignore */ }
      }
      throw redirect({
        to: "/auth",
        search: {
          redirect: location.href,
          ...(session ? { expired: 1 } : {}),
        } as any,
      });
    }
    return { user: session.user };
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

