import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const rangeSchema = z.object({
  hours: z.number().int().min(1).max(24 * 90).default(24),
  funnel: z.array(z.string()).optional(),
});

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden: admin only");
}

export const getObservability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rangeSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.hours * 3600_000).toISOString();

    const { data: rows, error } = await (supabaseAdmin as any)
      .from("observability_events")
      .select("id, kind, name, path, session_id, user_id, duration_ms, value, message, stack, created_at, meta, user_agent")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10000);
    if (error) throw new Error(error.message);

    const events: any[] = rows ?? [];
    const buckets = Math.min(48, Math.max(12, Math.round(data.hours <= 24 ? data.hours : 24)));
    const bucketMs = (data.hours * 3600_000) / buckets;
    const start = Date.now() - data.hours * 3600_000;

    const seriesMap: Record<string, number[]> = {
      error: Array(buckets).fill(0),
      pageview: Array(buckets).fill(0),
      event: Array(buckets).fill(0),
      vital: Array(buckets).fill(0),
    };
    const errorNameCount: Record<string, number> = {};
    const pagePathCount: Record<string, number> = {};
    const eventNameCount: Record<string, number> = {};
    const vitalAgg: Record<string, { sum: number; n: number; max: number }> = {};
    const sessions = new Set<string>();
    const users = new Set<string>();
    let latestErrors: any[] = [];

    for (const r of events) {
      const ts = new Date(r.created_at as string).getTime();
      const idx = Math.max(0, Math.min(buckets - 1, Math.floor((ts - start) / bucketMs)));
      if (seriesMap[r.kind as string]) seriesMap[r.kind as string][idx]++;
      if (r.session_id) sessions.add(r.session_id as string);
      if (r.user_id) users.add(r.user_id as string);
      if (r.kind === "error") {
        errorNameCount[r.name as string] = (errorNameCount[r.name as string] ?? 0) + 1;
        if (latestErrors.length < 25) latestErrors.push(r);
      } else if (r.kind === "pageview" && r.path) {
        pagePathCount[r.path as string] = (pagePathCount[r.path as string] ?? 0) + 1;
      } else if (r.kind === "event") {
        eventNameCount[r.name as string] = (eventNameCount[r.name as string] ?? 0) + 1;
      } else if (r.kind === "vital" && typeof r.value === "number") {
        const agg = (vitalAgg[r.name as string] ??= { sum: 0, n: 0, max: 0 });
        agg.sum += r.value; agg.n++; if (r.value > agg.max) agg.max = r.value;
      }
    }

    const series = Array.from({ length: buckets }, (_, i) => ({
      t: new Date(start + i * bucketMs).toISOString(),
      errors: seriesMap.error[i],
      pageviews: seriesMap.pageview[i],
      events: seriesMap.event[i],
    }));

    const topErrors = Object.entries(errorNameCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count).slice(0, 10);
    const topPages = Object.entries(pagePathCount)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count).slice(0, 10);
    const topEvents = Object.entries(eventNameCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count).slice(0, 15);

    const vitals = Object.entries(vitalAgg).map(([name, v]) => ({
      name, avg: v.n ? v.sum / v.n : 0, max: v.max, samples: v.n,
    }));

    // Funnel: default HVAC purchase funnel
    const funnelSteps = data.funnel && data.funnel.length
      ? data.funnel
      : ["view_product", "add_to_cart", "begin_checkout", "order_placed"];
    // Compute per-session ordered progression
    const bySession: Record<string, Set<string>> = {};
    for (const r of events) {
      if (r.kind !== "event" || !r.session_id) continue;
      if (!funnelSteps.includes(r.name as string)) continue;
      (bySession[r.session_id as string] ??= new Set()).add(r.name as string);
    }
    const funnel = funnelSteps.map((step, i) => {
      let count = 0;
      for (const s of Object.values(bySession)) {
        // require all prior steps present
        if (funnelSteps.slice(0, i + 1).every((n) => s.has(n))) count++;
      }
      return { step, count };
    });

    return {
      hours: data.hours,
      totals: {
        events: events.length,
        errors: seriesMap.error.reduce((a, b) => a + b, 0),
        pageviews: seriesMap.pageview.reduce((a, b) => a + b, 0),
        sessions: sessions.size,
        users: users.size,
      },
      series,
      topErrors,
      topPages,
      topEvents,
      vitals,
      funnel,
      latestErrors,
    };
  });
