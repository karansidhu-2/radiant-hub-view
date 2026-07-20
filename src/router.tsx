import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { reportLovableError } from "./lib/lovable-error-reporting";
import { handleError, toErrorMessage } from "./lib/error-toast";
import { toast } from "sonner";
import { GenericErrorPage, NotFoundPage } from "./components/error-pages/ErrorPages";

function DefaultErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  if (typeof window !== "undefined") {
    console.error(error);
  }
  return <GenericErrorPage error={error} reset={reset} />;
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
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
    defaultNotFoundComponent: DefaultNotFoundComponent,
  });

  return router;
};
