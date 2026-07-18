import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminAnalytics,
  adminListCheckpoints,
  adminCreateCheckpoint,
  adminSetCheckpointActive,
  adminDeleteCheckpoint,
} from "@/lib/hvac.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  DollarSign, ShoppingBag, Calendar, TrendingUp, Users, Star,
  CheckCircle2, XCircle, Repeat, Wrench, Download, RotateCcw, Trash2, Play,
} from "lucide-react";

import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

function csvEscape(v: any) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows: (string | number)[][]) {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}
function downloadCsv(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

const RANGES = [7, 14, 30, 60, 90] as const;
const PIE = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#8b5cf6", "#0891b2"];

function fmt$(n: number) {
  return `$${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function AdminDashboard() {
  const analyticsFn = useServerFn(adminAnalytics);
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const listCheckpoints = useServerFn(adminListCheckpoints);
  const createCheckpoint = useServerFn(adminCreateCheckpoint);
  const setActive = useServerFn(adminSetCheckpointActive);
  const delCheckpoint = useServerFn(adminDeleteCheckpoint);
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [customDate, setCustomDate] = useState("");
  const active = checkpoints.find((c) => c.active) ?? null;
  const sinceOverride = active ? active.started_at : null;

  const reloadCheckpoints = () => listCheckpoints().then(setCheckpoints).catch(() => {});
  useEffect(() => { reloadCheckpoints(); /* eslint-disable-next-line */ }, []);

  useEffect(() => {
    setLoading(true);
    analyticsFn({ data: { days, sinceOverride } })
      .then((d) => setData(d))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [analyticsFn, days, sinceOverride]);

  const startPeriod = async (period_type: "week" | "month" | "year" | "custom", started_at?: string) => {
    try {
      await createCheckpoint({ data: { period_type, started_at, label: period_type === "custom" ? `From ${started_at?.slice(0,10)}` : `New ${period_type}` } });
      toast.success(`Revenue reset — tracking from new ${period_type}. History preserved.`);
      await reloadCheckpoints();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  if (loading || !data) {
    return <div className="py-16 text-center text-muted-foreground">Loading analytics…</div>;
  }


  const t = data.totals;
  const daily = data.daily.map((d: any) => ({
    ...d, label: d.date.slice(5), total: d.orderRevenue + d.serviceRevenue,
  }));
  const statusData = Object.entries(data.statusCounts).map(([name, value]) => ({ name, value }));

  const kpis = [
    { icon: DollarSign, label: "Total Revenue", value: fmt$(t.totalRevenue), sub: `${fmt$(t.orderRevenue)} orders · ${fmt$(t.serviceRevenue)} services` },
    { icon: ShoppingBag, label: "Orders", value: t.orderCount, sub: `Avg ${fmt$(t.aov)}` },
    { icon: Calendar, label: "Bookings", value: t.bookingCount, sub: `Avg charge ${fmt$(t.avgTicket)}` },
    { icon: TrendingUp, label: "Completion Rate", value: `${t.conversion.toFixed(1)}%`, sub: `${t.completed} done` },
    { icon: CheckCircle2, label: "Completed", value: t.completed, sub: "Successful jobs" },
    { icon: XCircle, label: "Cancelled", value: t.cancelled, sub: "Lost bookings" },
    { icon: Users, label: "Customers", value: t.uniqueCustomers, sub: `${t.repeatCustomers} repeat` },
    { icon: Star, label: "Avg Rating", value: t.avgRating ? t.avgRating.toFixed(2) : "—", sub: `${t.reviewCount} reviews` },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of the last {days} days.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {RANGES.map((r) => (
              <Button key={r} size="sm" variant={r === days ? "default" : "outline"} onClick={() => setDays(r)}>
                {r}d
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 border-l border-border pl-2">
            <Button size="sm" variant="outline" onClick={() => {
              const rows: (string | number)[][] = [["Metric", "Value"]];
              const map: [string, any][] = [
                ["Range (days)", days],
                ["Total revenue", t.totalRevenue],
                ["Order revenue", t.orderRevenue],
                ["Service revenue", t.serviceRevenue],
                ["Orders", t.orderCount],
                ["Bookings", t.bookingCount],
                ["Completed", t.completed],
                ["Cancelled", t.cancelled],
                ["Completion rate (%)", Number(t.conversion.toFixed(2))],
                ["Average order value", Number(t.aov.toFixed(2))],
                ["Average service charge", Number(t.avgTicket.toFixed(2))],
                ["Unique customers", t.uniqueCustomers],
                ["Repeat customers", t.repeatCustomers],
                ["Reviews", t.reviewCount],
                ["Avg rating", Number((t.avgRating || 0).toFixed(2))],
              ];
              for (const [k, v] of map) rows.push([k, v]);
              downloadCsv(`kpis_${days}d_${new Date().toISOString().slice(0,10)}.csv`, toCsv(rows));
            }}><Download className="mr-1 h-3.5 w-3.5" />KPIs</Button>
            <Button size="sm" variant="outline" onClick={() => {
              const rows: (string | number)[][] = [["date","orders","order_revenue","bookings","service_revenue","total_revenue"]];
              for (const d of data.daily) rows.push([d.date, d.orders, d.orderRevenue, d.bookings, d.serviceRevenue, d.orderRevenue + d.serviceRevenue]);
              downloadCsv(`revenue_trend_${days}d_${new Date().toISOString().slice(0,10)}.csv`, toCsv(rows));
            }}><Download className="mr-1 h-3.5 w-3.5" />Revenue</Button>
            <Button size="sm" variant="outline" onClick={() => {
              const rows: (string | number)[][] = [["service","slug","bookings","revenue"]];
              for (const s of data.topServices) rows.push([s.name, s.slug ?? "", s.bookings, s.revenue]);
              downloadCsv(`top_services_${days}d_${new Date().toISOString().slice(0,10)}.csv`, toCsv(rows));
            }}><Download className="mr-1 h-3.5 w-3.5" />Top services</Button>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="card-pop">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase text-muted-foreground">{k.label}</p>
                <k.icon className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-1 text-2xl font-bold">{k.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6 border-primary/30">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold uppercase text-muted-foreground">Revenue Reset</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Start a new tracking period from $0. Previous records are preserved in history and remain in the database.
              </p>
              {active ? (
                <p className="mt-2 text-sm">
                  <span className="font-medium">Active checkpoint:</span>{" "}
                  {active.label ?? active.period_type} — since{" "}
                  {new Date(active.started_at).toLocaleString()}
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No active checkpoint — showing last {days} days.</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => startPeriod("week")}>Start new week</Button>
              <Button size="sm" variant="outline" onClick={() => startPeriod("month")}>Start new month</Button>
              <Button size="sm" variant="outline" onClick={() => startPeriod("year")}>Start new year</Button>
              {active && (
                <Button size="sm" variant="ghost" onClick={async () => {
                  await setActive({ data: { id: null } });
                  toast.success("Reverted to rolling range");
                  reloadCheckpoints();
                }}>Clear</Button>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3">
            <div>
              <label className="text-xs text-muted-foreground">Custom start date</label>
              <Input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="h-9 w-44" />
            </div>
            <Button size="sm" variant="outline" disabled={!customDate}
              onClick={() => startPeriod("custom", new Date(customDate + "T00:00:00").toISOString())}>
              Start from date
            </Button>
          </div>
          {checkpoints.length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">History</p>
              <div className="max-h-52 overflow-y-auto divide-y rounded border">
                {checkpoints.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 p-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {c.label ?? c.period_type}
                        {c.active && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">Active</span>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.period_type} · started {new Date(c.started_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {!c.active && (
                        <Button size="icon" variant="ghost" title="Activate"
                          onClick={async () => { await setActive({ data: { id: c.id } }); toast.success("Checkpoint activated"); reloadCheckpoints(); }}>
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" title="Delete"
                        onClick={async () => { await delCheckpoint({ data: { id: c.id } }); toast.success("Deleted"); reloadCheckpoints(); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>



      <Card className="mt-6">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">Revenue Trend</h2>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <AreaChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="rev2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v: any) => fmt$(Number(v))} />
                <Legend />
                <Area type="monotone" name="Orders" dataKey="orderRevenue" stroke="#2563eb" fill="url(#rev1)" />
                <Area type="monotone" name="Services" dataKey="serviceRevenue" stroke="#f59e0b" fill="url(#rev2)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase text-muted-foreground">Top Services</h2>
            </div>
            {data.topServices.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No bookings in this range.</p>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer>
                  <BarChart data={data.topServices} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                    <Tooltip />
                    <Bar dataKey="bookings" fill="#2563eb" name="Bookings" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Repeat className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase text-muted-foreground">Booking Status</h2>
            </div>
            {statusData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No bookings in this range.</p>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                      {statusData.map((_, i) => (
                        <Cell key={i} fill={PIE[i % PIE.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">Service Revenue Breakdown</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2">Service</th>
                  <th className="py-2 text-right">Bookings</th>
                  <th className="py-2 text-right">Revenue</th>
                  <th className="py-2 text-right">Avg</th>
                </tr>
              </thead>
              <tbody>
                {data.topServices.map((s: any) => (
                  <tr key={s.name} className="border-b last:border-0">
                    <td className="py-2 font-medium">{s.name}</td>
                    <td className="py-2 text-right">{s.bookings}</td>
                    <td className="py-2 text-right">{fmt$(s.revenue)}</td>
                    <td className="py-2 text-right">{fmt$(s.bookings ? s.revenue / s.bookings : 0)}</td>
                  </tr>
                ))}
                {data.topServices.length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No data yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
