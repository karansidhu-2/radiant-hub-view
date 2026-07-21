import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import { NotFoundPage, GenericErrorPage } from "@/components/error-pages/ErrorPages";
import { OfflineDetector } from "@/components/OfflineDetector";
import { PerfProfilerControls } from "@/lib/perf-profiler";
import { useAuth } from "@/hooks/useAuth";



function NotFoundComponent() {
  return <NotFoundPage />;
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <GenericErrorPage
      error={error}
      reset={reset}
      onRetry={() => {
        router.invalidate();
        reset();
      }}
    />
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "HVAC Pro — Trusted HVAC Service, Repair & Installation" },
      { name: "description", content: "US-based HVAC experts. Book AC, furnace, and heat-pump service, or shop top-brand systems with professional installation." },
      { name: "author", content: "HVAC Pro" },
      { property: "og:title", content: "HVAC Pro — Service, Repair & Installation" },
      { property: "og:description", content: "Book HVAC service or shop systems with professional installation, nationwide." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "@id": "https://radiant-hub-view.lovable.app/#business",
          name: "HVAC Pro",
          description: "US-based HVAC experts offering AC, furnace and heat-pump service, repair and installation, plus top-brand HVAC systems with professional installation.",
          url: "https://radiant-hub-view.lovable.app/",
          telephone: "+1-800-000-0000",
          priceRange: "$$",
          areaServed: { "@type": "Country", name: "United States" },
          address: { "@type": "PostalAddress", addressCountry: "US" },
          openingHoursSpecification: [{
            "@type": "OpeningHoursSpecification",
            dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
            opens: "08:00", closes: "18:00",
          }],
          sameAs: [],
        }),
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    void import("../lib/observability").then((m) => m.initObservability());
    const onError = (event: ErrorEvent) => {
      reportLovableError(event.error ?? event.message, {
        source: "window_onerror",
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      reportLovableError(event.reason, { source: "unhandled_promise_rejection" });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <OfflineDetector />
          <Outlet />
          <PerfControlsGate />
          <Toaster richColors position="top-right" />
        </CartProvider>
      </AuthProvider>

    </QueryClientProvider>
  );
}

function PerfControlsGate() {
  const { isAdmin } = useAuth();
  return <PerfProfilerControls isAdmin={!!isAdmin} />;
}



