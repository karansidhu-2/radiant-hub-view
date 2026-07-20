import { queryOptions } from "@tanstack/react-query";
import { adminAnalytics } from "@/lib/hvac.functions";

/**
 * Shared query options for admin analytics. All KPI cards and chart
 * components that depend on the analytics payload should call
 * `useQuery(adminAnalyticsQueryOptions(days, sinceOverride))` (or
 * `useSuspenseQuery`) instead of firing their own server function call.
 *
 * React Query will:
 *   - dedupe/coalesce concurrent fetches with the same key into one request,
 *   - cache the result for `staleTime` so re-mounts read from cache,
 *   - keep siblings in sync via a single source of truth.
 */
export function adminAnalyticsQueryOptions(
  days: number,
  sinceOverride: string | null,
) {
  return queryOptions({
    queryKey: ["admin", "analytics", days, sinceOverride] as const,
    queryFn: () => adminAnalytics({ data: { days, sinceOverride } }),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

/**
 * Warm the recharts chunk in the background so the dashboard renders
 * charts instantly on first paint. Safe to call from route loaders /
 * hover handlers — the browser dedupes the module fetch.
 */
export function prefetchDashboardChartsChunk() {
  return import("@/components/admin/DashboardCharts");
}
