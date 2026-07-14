import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminListBookings, adminListOrders, adminListProducts, adminListServices } from "@/lib/hvac.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Wrench, Package, Calendar, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const [stats, setStats] = useState({ services: 0, products: 0, bookings: 0, orders: 0, revenue: 0 });
  const svcs = useServerFn(adminListServices), prods = useServerFn(adminListProducts);
  const bks = useServerFn(adminListBookings), ords = useServerFn(adminListOrders);

  useEffect(() => {
    Promise.all([svcs(), prods(), bks(), ords()]).then(([s, p, b, o]) => {
      setStats({
        services: s.length, products: p.length, bookings: b.length, orders: o.length,
        revenue: o.reduce((sum: number, x: any) => sum + Number(x.total), 0),
      });
    });
  }, [svcs, prods, bks, ords]);

  const cards = [
    { icon: Wrench, label: "Services", value: stats.services },
    { icon: Package, label: "Products", value: stats.products },
    { icon: Calendar, label: "Bookings", value: stats.bookings },
    { icon: ShoppingBag, label: "Orders", value: stats.orders },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}><CardContent className="p-5">
            <c.icon className="h-6 w-6 text-primary" />
            <p className="mt-2 text-xs uppercase text-muted-foreground">{c.label}</p>
            <p className="text-2xl font-bold">{c.value}</p>
          </CardContent></Card>
        ))}
      </div>
      <Card className="mt-6"><CardContent className="p-5">
        <p className="text-xs uppercase text-muted-foreground">Total Revenue</p>
        <p className="text-3xl font-bold">${stats.revenue.toLocaleString()}</p>
      </CardContent></Card>
    </div>
  );
}
