import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { reportLovableError } from "./lib/lovable-error-reporting";
import { handleError, toErrorMessage } from "./lib/error-toast";
import { toast } from "sonner";
import { GenericErrorPage, NotFoundPage } from "./components/error-pages/ErrorPages";

function DefaultErrorComponent({ error, reset }: ErrorComponentProps) {
  const routeError = error instanceof Error ? error : new Error(String(error));
  if (typeof window !== "undefined") {
    console.error(routeError);
  }
  return <GenericErrorPage error={routeError} reset={reset} />;
}

function DefaultNotFoundComponent() {
  return <NotFoundPage />;
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          // Don't retry on 4xx / auth / not-found style errors.
          const status =
            (error as { status?: number; statusCode?: number } | undefined)?.status ??
            (error as { statusCode?: number } | undefined)?.statusCode;
          if (typeof status === "number" && status >= 400 && status < 500) return false;
          return failureCount < 2;
        },
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: {
        retry: 0,
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        reportLovableError(error, { source: "react_query", queryKey: query.queryKey });
        // Only toast on background refetches when there is already data on screen —
        // initial-load failures are surfaced by route errorComponents / empty states.
        if (query.state.data !== undefined) {
          try {
            toast.error("Couldn't refresh data", { description: toErrorMessage(error) });
          } catch { /* ignore */ }
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        // Skip auto-toast when the mutation defines its own onError handler
        // (avoids double toasts for callers that already handle errors).
        if (mutation.options.onError) {
          reportLovableError(error, { source: "react_query_mutation" });
          return;
        }
        handleError(error, { context: { source: "react_query_mutation" } });
      },
    }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    // Fire the preload almost immediately on hover/focus instead of the 50ms
    // default — by the time the click lands, the route chunk is usually there.
    defaultPreloadDelay: 15,
    // Reuse cached loader/query data across intent-preload → click so hovering
    // a link then clicking doesn't refetch. Matches Query's staleTime.
    defaultPreloadStaleTime: 60_000,
    // Reuse loader data on nav for a short window (cheap back/forward, tab
    // switches, and re-visits render instantly instead of hitting the network).
    defaultStaleTime: 30_000,
    // Delay the pending UI so fast navigations don't flash a spinner.
    defaultPendingMs: 700,
    defaultPendingMinMs: 200,

    defaultErrorComponent: DefaultErrorComponent,
    defaultNotFoundComponent: DefaultNotFoundComponent,
  });

  return router;
};
