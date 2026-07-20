import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to Postgres changes on one or more tables and invalidate matching
 * React Query keys — with overhead controls:
 *   • Stable channel name (survives StrictMode double-mount, no leaks).
 *   • Coalesces bursty INSERT/UPDATE/DELETE events into one invalidation
 *     (default 400ms debounce) so a bulk save fires ONE refetch, not N.
 *   • Only invalidates ACTIVE queries — inactive/cached views don't refetch
 *     until the user opens them.
 *   • Pauses the channel when the tab is hidden and re-subscribes + syncs
 *     once on return, cutting idle websocket traffic to zero.
 */
export function useRealtimeInvalidate(
  tables: string[],
  queryKeyPrefixes: (string | number)[][],
  opts?: { filter?: string; enabled?: boolean; debounceMs?: number },
) {
  const qc = useQueryClient();
  const enabled = opts?.enabled ?? true;
  const debounceMs = opts?.debounceMs ?? 400;
  const key = JSON.stringify({ tables, filter: opts?.filter ?? null });

  // Keep prefixes in a ref so effect deps stay stable across renders.
  const prefixesRef = useRef(queryKeyPrefixes);
  prefixesRef.current = queryKeyPrefixes;

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      timer = null;
      for (const prefix of prefixesRef.current) {
        qc.invalidateQueries({ queryKey: prefix, refetchType: "active" });
      }
    };
    const schedule = () => {
      if (timer) return;
      timer = setTimeout(flush, debounceMs);
    };

    let channel: ReturnType<typeof supabase.channel> | null = null;
    const subscribe = () => {
      if (channel) return;
      // Stable channel name per (tables, filter) — no random suffix.
      channel = supabase.channel(`rt:${key}`);
      for (const table of tables) {
        channel.on(
          "postgres_changes" as never,
          {
            event: "*",
            schema: "public",
            table,
            ...(opts?.filter ? { filter: opts.filter } : {}),
          },
          schedule,
        );
      }
      channel.subscribe();
    };
    const unsubscribe = () => {
      if (!channel) return;
      supabase.removeChannel(channel);
      channel = null;
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        subscribe();
        // Sync once on return in case we missed events while paused.
        schedule();
      } else {
        unsubscribe();
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      }
    };

    if (typeof document === "undefined" || document.visibilityState === "visible") {
      subscribe();
    }
    document.addEventListener?.("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener?.("visibilitychange", onVisibility);
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, debounceMs]);
}
