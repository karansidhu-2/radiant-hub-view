import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListBookings,
  adminUpdateBookingStatus,
  adminSetBookingCharge,
} from "@/lib/hvac.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/bookings")({
  component: AdminBookings,
});

const STATUSES = ["pending", "confirmed", "in_progress", "completed", "cancelled"];

function AdminBookings() {
  const [rows, setRows] = useState<any[]>([]);
  const [charges, setCharges] = useState<Record<string, string>>({});
  const list = useServerFn(adminListBookings);
  const upd = useServerFn(adminUpdateBookingStatus);
  const setCharge = useServerFn(adminSetBookingCharge);

  const reload = () =>
    list().then((r) => {
      setRows(r);
      setCharges(
        Object.fromEntries(
          r.map((b: any) => [b.id, b.service_charge != null ? String(b.service_charge) : ""]),
        ),
      );
    });
  useEffect(() => {
    reload();
  }, []);

  const setStatus = async (id: string, status: string) => {
    await upd({ data: { id, status } });
    toast.success(
      status === "confirmed" || status === "completed"
        ? "Updated — confirmation email sent to customer"
        : "Updated",
    );
    reload();
  };

  const saveCharge = async (id: string) => {
    const raw = charges[id];
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    await setCharge({ data: { id, service_charge: amount } });
    toast.success("Service charge saved");
    reload();
  };

  const totalRevenue = rows
    .filter((b) => b.status === "completed" && b.service_charge != null)
    .reduce((s, b) => s + Number(b.service_charge), 0);

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Bookings</h1>
        <div className="text-sm">
          <span className="text-muted-foreground">Completed revenue: </span>
          <span className="font-semibold">${totalRevenue.toFixed(2)}</span>
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        {rows.map((b) => (
          <Card key={b.id}>
            <CardContent className="p-4 flex flex-col gap-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{b.service_name}</p>
                    <Badge variant="secondary">{b.reference}</Badge>
                    <Badge>{String(b.status).replace("_", " ")}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {b.full_name} • {b.phone} • {b.scheduled_date} @ {b.scheduled_hour}:00
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {b.street}, {b.city}, {b.state} {b.zip}
                  </p>
                </div>
                <Select value={b.status} onValueChange={(v) => setStatus(b.id, v)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 border-t pt-3">
                <label className="text-xs text-muted-foreground whitespace-nowrap">
                  Service charge ($)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 249.00"
                  className="max-w-[160px]"
                  value={charges[b.id] ?? ""}
                  onChange={(e) =>
                    setCharges((c) => ({ ...c, [b.id]: e.target.value }))
                  }
                />
                <Button size="sm" variant="outline" onClick={() => saveCharge(b.id)}>
                  Save
                </Button>
                {b.service_charge != null && (
                  <span className="text-xs text-muted-foreground">
                    Recorded: ${Number(b.service_charge).toFixed(2)}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <p className="text-muted-foreground text-sm">No bookings yet.</p>
        )}
      </div>
    </div>
  );
}
