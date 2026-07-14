import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminListBookings, adminUpdateBookingStatus } from "@/lib/hvac.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/bookings")({ component: AdminBookings });

const STATUSES = ["pending", "confirmed", "in_progress", "completed", "cancelled"];

function AdminBookings() {
  const [rows, setRows] = useState<any[]>([]);
  const list = useServerFn(adminListBookings), upd = useServerFn(adminUpdateBookingStatus);
  const reload = () => list().then(setRows);
  useEffect(() => { reload(); }, []);

  const setStatus = async (id: string, status: string) => {
    await upd({ data: { id, status } }); toast.success("Updated"); reload();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Bookings</h1>
      <div className="mt-4 grid gap-2">
        {rows.map((b) => (
          <Card key={b.id}><CardContent className="p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold">{b.service_name}</p>
                <Badge variant="secondary">{b.reference}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{b.full_name} • {b.phone} • {b.scheduled_date} @ {b.scheduled_hour}:00</p>
              <p className="text-xs text-muted-foreground">{b.street}, {b.city}, {b.state} {b.zip}</p>
            </div>
            <Select value={b.status} onValueChange={(v) => setStatus(b.id, v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
          </CardContent></Card>
        ))}
        {rows.length === 0 && <p className="text-muted-foreground text-sm">No bookings yet.</p>}
      </div>
    </div>
  );
}
