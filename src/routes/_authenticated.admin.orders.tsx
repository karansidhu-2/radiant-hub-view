import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminListOrders, adminUpdateOrderStatus } from "@/lib/hvac.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatMoney } from "@/data/products";
import { InvoiceBadge } from "@/components/InvoiceBadge";

export const Route = createFileRoute("/_authenticated/admin/orders")({ component: AdminOrders });

const STATUSES = ["pending", "confirmed", "scheduled", "installed", "cancelled"];

function AdminOrders() {
  const [rows, setRows] = useState<any[]>([]);
  const list = useServerFn(adminListOrders), upd = useServerFn(adminUpdateOrderStatus);
  const reload = () => list().then(setRows);
  useEffect(() => { reload(); }, []);

  const setStatus = async (id: string, status: string) => { await upd({ data: { id, status } }); toast.success("Updated"); reload(); };

  return (
    <div>
      <h1 className="text-2xl font-bold">Orders</h1>
      <div className="mt-4 grid gap-2">
        {rows.map((o) => (
          <Card key={o.id}><CardContent className="p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{formatMoney(Number(o.total))}</p>
                <Badge variant="secondary">{o.reference}</Badge>
                <InvoiceBadge invoice={o.invoice} />
              </div>
              <p className="text-xs text-muted-foreground">{o.full_name} • {o.email} • {o.phone}</p>
              <p className="text-xs text-muted-foreground">{o.street}, {o.city}, {o.state} {o.zip}{o.scheduled_date && ` • Install ${o.scheduled_date} @ ${o.scheduled_hour}:00`}</p>
            </div>
            <Select value={o.status} onValueChange={(v) => setStatus(o.id, v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </CardContent></Card>
        ))}
        {rows.length === 0 && <p className="text-muted-foreground text-sm">No orders yet.</p>}
      </div>
    </div>
  );
}
