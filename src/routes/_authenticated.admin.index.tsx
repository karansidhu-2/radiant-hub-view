import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminAnalytics } from "@/lib/hvac.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DollarSign, ShoppingBag, Calendar, TrendingUp, Users, Star,
  CheckCircle2, XCircle, Repeat, Wrench,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

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

  useEffect(() => {
    setLoading(true);
    analyticsFn({ data: { days } })
      .then((d) => setData(d))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [analyticsFn, days]);

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
        <div className="flex flex-wrap gap-1">
          {RANGES.map((r) => (
            <Button key={r} size="sm" variant={r === days ? "default" : "outline"} onClick={() => setDays(r)}>
              {r}d
            </Button>
          ))}
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
