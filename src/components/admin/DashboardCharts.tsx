import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

const PIE = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#8b5cf6", "#0891b2"];

function fmt$(n: number) {
  return `$${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export type DailyPoint = { label: string; orderRevenue: number; serviceRevenue: number };
export type NamedValue = { name: string; value: number };
export type TopService = { name: string; bookings: number };

export function RevenueTrendChart({ daily }: { daily: DailyPoint[] }) {
  return (
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
  );
}

export function TopServicesChart({ data }: { data: TopService[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
          <Tooltip />
          <Bar dataKey="bookings" fill="#2563eb" name="Bookings" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BookingStatusChart({ data }: { data: NamedValue[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
            {data.map((_, i) => (
              <Cell key={i} fill={PIE[i % PIE.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function DashboardCharts(props: {
  daily: DailyPoint[];
  topServices: TopService[];
  statusData: NamedValue[];
}) {
  return (
    <>
      <RevenueTrendChart daily={props.daily} />
      <TopServicesChart data={props.topServices} />
      <BookingStatusChart data={props.statusData} />
    </>
  );
}
