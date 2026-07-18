import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to Postgres changes on one or more tables and invalidate matching
 * React Query keys so the UI reflects new data instantly — no manual refresh.
 */
export function useRealtimeInvalidate(
  tables: string[],
  queryKeyPrefixes: (string | number)[][],
  opts?: { filter?: string; enabled?: boolean },
) {
  const qc = useQueryClient();
  const enabled = opts?.enabled ?? true;
  const key = JSON.stringify({ tables, filter: opts?.filter ?? null });
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase.channel(`rt:${key}:${Math.random().toString(36).slice(2, 8)}`);
    for (const table of tables) {
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table, ...(opts?.filter ? { filter: opts.filter } : {}) },
        () => {
          for (const prefix of queryKeyPrefixes) {
            qc.invalidateQueries({ queryKey: prefix });
          }
        },
      );
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
}
