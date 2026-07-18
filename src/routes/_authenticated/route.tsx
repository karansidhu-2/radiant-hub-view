import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/BackButton";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { redirect: "/admin" } });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  // Admin has its own header/back navigation; skip the extra back row there.
  const showBack = !path.startsWith("/admin");
  return (
    <>
      {showBack && (
        <div className="mx-auto w-full max-w-7xl px-4 pt-3 md:px-6">
          <BackButton fallback="/" alwaysUseFallback />
        </div>
      )}
      <Outlet />
    </>
  );
}

