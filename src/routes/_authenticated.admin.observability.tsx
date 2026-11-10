import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getObservability } from "@/lib/observability.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Activity from "lucide-react/dist/esm/icons/activity";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Gauge from "lucide-react/dist/esm/icons/gauge";
import Users from "lucide-react/dist/esm/icons/users";
import Eye from "lucide-react/dist/esm/icons/eye";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/admin/observability")({
  component: ObservabilityPage,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{error instanceof Error ? error.message : String(error)}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

const RANGES = [
  { label: "Last 1 hour", value: 1 },
  { label: "Last 6 hours", value: 6 },
  { label: "Last 24 hours", value: 24 },
  { label: "Last 7 days", value: 24 * 7 },
  { label: "Last 30 days", value: 24 * 30 },
];

function fmtTime(iso: string, hours: number) {
  const d = new Date(iso);
  return hours <= 24
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function Kpi({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4" /> {label}</div>
        <div className="mt-1 text-2xl font-bold">{value}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function ObservabilityPage() {
  const fn = useServerFn(getObservability);
  const [hours, setHours] = useState(24);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["observability", hours],
    queryFn: () => fn({ data: { hours } }),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Activity className="h-6 w-6 text-primary" /> Observability</h1>
          <p className="text-sm text-muted-foreground">Errors, performance, and product funnels — live from in-app telemetry.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="p-10 text-center text-sm text-muted-foreground">Loading telemetry…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Kpi icon={Eye} label="Pageviews" value={data.totals.pageviews.toLocaleString()} />
            <Kpi icon={Users} label="Sessions" value={data.totals.sessions.toLocaleString()} />
            <Kpi icon={Users} label="Signed-in users" value={data.totals.users.toLocaleString()} />
            <Kpi icon={AlertTriangle} label="Errors" value={data.totals.errors.toLocaleString()} hint={data.totals.pageviews ? `${((data.totals.errors / Math.max(1, data.totals.pageviews)) * 100).toFixed(2)}% error rate` : undefined} />
            <Kpi icon={Activity} label="Total events" value={data.totals.events.toLocaleString()} />
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="mb-2 text-sm font-semibold">Activity over time</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.series.map((p) => ({ ...p, t: fmtTime(p.t, hours) }))}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="t" fontSize={11} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="pageviews" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" />
                    <Area type="monotone" dataKey="events" stackId="1" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground) / 0.2)" />
                    <Area type="monotone" dataKey="errors" stackId="2" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive) / 0.35)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Gauge className="h-4 w-4" /> Conversion funnel</div>
                {data.funnel.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No funnel events yet. Call <code>track("view_product")</code> etc. from your pages.</div>
                ) : (
                  <div className="space-y-2">
                    {data.funnel.map((s, i) => {
                      const first = data.funnel[0].count || 1;
                      const pct = (s.count / first) * 100;
                      const dropFromPrev = i > 0 && data.funnel[i - 1].count > 0
                        ? ((data.funnel[i - 1].count - s.count) / data.funnel[i - 1].count) * 100
                        : 0;
                      return (
                        <div key={s.step}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{s.step}</span>
                            <span className="tabular-nums text-muted-foreground">
                              {s.count.toLocaleString()} · {pct.toFixed(1)}%
                              {i > 0 && dropFromPrev > 0 && <span className="ml-1 text-destructive">(−{dropFromPrev.toFixed(0)}%)</span>}
                            </span>
                          </div>
                          <div className="mt-1 h-2 rounded bg-muted">
                            <div className="h-2 rounded bg-primary" style={{ width: `${Math.max(2, pct)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="mb-2 text-sm font-semibold">Web vitals</div>
                {data.vitals.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No vital samples yet.</div>
                ) : (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.vitals}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="name" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip />
                        <Bar dataKey="avg" fill="hsl(var(--primary))" name="avg" />
                        <Bar dataKey="max" fill="hsl(var(--destructive))" name="max" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-destructive" /> Top errors</div>
                {data.topErrors.length === 0 ? <div className="text-sm text-muted-foreground">No errors 🎉</div> : (
                  <ul className="space-y-1 text-sm">
                    {data.topErrors.map((e) => (
                      <li key={e.name} className="flex items-center justify-between">
                        <span className="truncate">{e.name}</span>
                        <Badge variant="destructive">{e.count}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="mb-2 text-sm font-semibold">Top pages</div>
                {data.topPages.length === 0 ? <div className="text-sm text-muted-foreground">No pageviews.</div> : (
                  <ul className="space-y-1 text-sm">
                    {data.topPages.map((p) => (
                      <li key={p.path} className="flex items-center justify-between">
                        <span className="truncate font-mono text-xs">{p.path}</span>
                        <Badge variant="secondary">{p.count}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="mb-2 text-sm font-semibold">Top custom events</div>
              {data.topEvents.length === 0 ? (
                <div className="text-sm text-muted-foreground">No custom events tracked in this range.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.topEvents.map((e) => (
                    <Badge key={e.name} variant="outline" className="gap-1">
                      <span className="font-mono">{e.name}</span>
                      <span className="text-muted-foreground">· {e.count}</span>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="mb-2 text-sm font-semibold">Recent errors</div>
              {data.latestErrors.length === 0 ? <div className="text-sm text-muted-foreground">Nothing to show.</div> : (
                <div className="space-y-2">
                  {data.latestErrors.map((e: any) => (
                    <details key={e.id} className="rounded border border-border bg-muted/30 p-2 text-xs">
                      <summary className="cursor-pointer">
                        <span className="font-semibold text-destructive">{e.name}</span>
                        <span className="ml-2">{e.message}</span>
                        <span className="ml-2 text-muted-foreground">· {e.path} · {new Date(e.created_at).toLocaleString()}</span>
                      </summary>
                      {e.stack && <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">{e.stack}</pre>}
                    </details>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
