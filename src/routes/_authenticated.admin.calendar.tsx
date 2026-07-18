import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { adminListBookings, adminRescheduleBooking, adminUpdateBookingStatus } from "@/lib/hvac.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Clock, MapPin, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/calendar")({
  component: CalendarPage,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

type Booking = {
  id: string; reference: string; full_name: string; service_name: string;
  scheduled_date: string; scheduled_hour: number; status: string;
  street: string; city: string; state: string; zip: string;
  service_charge: number | null;
};

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8..18
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300",
  confirmed: "bg-primary/15 text-primary border-primary/30",
  completed: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  cancelled: "bg-muted text-muted-foreground border-border line-through",
};

function startOfWeek(d: Date) {
  const x = new Date(d); const day = x.getDay(); x.setDate(x.getDate() - day); x.setHours(0,0,0,0); return x;
}
function fmtDate(d: Date) { return d.toISOString().slice(0, 10); }
function fmtHour(h: number) { const p = h >= 12 ? "PM" : "AM"; const hh = ((h + 11) % 12) + 1; return `${hh} ${p}`; }

function CalendarPage() {
  const list = useServerFn(adminListBookings);
  const reschedule = useServerFn(adminRescheduleBooking);
  const setStatus = useServerFn(adminUpdateBookingStatus);
  const qc = useQueryClient();

  const { data: bookings = [] } = useQuery({ queryKey: ["admin-bookings-all"], queryFn: () => list() as Promise<Booking[]> });

  const [view, setView] = useState<"week" | "day">("week");
  const [anchor, setAnchor] = useState<Date>(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [selected, setSelected] = useState<Booking | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editHour, setEditHour] = useState<number>(9);

  const weekStart = useMemo(() => startOfWeek(anchor), [anchor]);
  const days = useMemo(() => {
    if (view === "day") return [anchor];
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
  }, [view, anchor, weekStart]);

  const byCell = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      const k = `${b.scheduled_date}|${b.scheduled_hour}`;
      const arr = map.get(k) ?? []; arr.push(b); map.set(k, arr);
    }
    return map;
  }, [bookings]);

  const dayBookings = useMemo(() => {
    const key = fmtDate(anchor);
    return bookings.filter((b) => b.scheduled_date === key).sort((a, b) => a.scheduled_hour - b.scheduled_hour);
  }, [bookings, anchor]);

  const shift = (n: number) => { const d = new Date(anchor); d.setDate(d.getDate() + (view === "week" ? 7 * n : n)); setAnchor(d); };

  const openEdit = (b: Booking) => { setSelected(b); setEditDate(b.scheduled_date); setEditHour(b.scheduled_hour); };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      await reschedule({ data: { id: selected.id, scheduled_date: editDate, scheduled_hour: editHour } });
    },
    onSuccess: () => { toast.success("Booking rescheduled"); qc.invalidateQueries({ queryKey: ["admin-bookings-all"] }); setSelected(null); },
    onError: (e: any) => toast.error(e?.message || "Failed to reschedule"),
  });

  const statusMut = useMutation({
    mutationFn: async (p: { id: string; status: string }) => setStatus({ data: p }),
    onSuccess: () => { toast.success("Status updated"); qc.invalidateQueries({ queryKey: ["admin-bookings-all"] }); },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const todayKey = fmtDate(new Date());
  const rangeLabel = view === "week"
    ? `${days[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
    : anchor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Scheduling Calendar</h1>
          <p className="text-sm text-muted-foreground">Visibility per day/week. Click any booking to reschedule.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border p-0.5">
            <button onClick={() => setView("day")} className={`px-3 py-1 text-sm rounded ${view === "day" ? "bg-primary text-primary-foreground" : ""}`}>Day</button>
            <button onClick={() => setView("week")} className={`px-3 py-1 text-sm rounded ${view === "week" ? "bg-primary text-primary-foreground" : ""}`}>Week</button>
          </div>
          <Button variant="outline" size="sm" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(() => { const d = new Date(); d.setHours(0,0,0,0); return d; })}>Today</Button>
          <Button variant="outline" size="sm" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="text-sm font-medium text-muted-foreground">{rangeLabel}</div>

      {view === "week" ? (
        <Card className="overflow-x-auto p-0">
          <div className="min-w-[820px]">
            <div className="grid grid-cols-[70px_repeat(7,1fr)] border-b border-border bg-secondary/40 text-xs font-medium">
              <div className="p-2" />
              {days.map((d) => {
                const isToday = fmtDate(d) === todayKey;
                return (
                  <div key={d.toISOString()} className={`p-2 text-center ${isToday ? "text-primary" : ""}`}>
                    <div>{d.toLocaleDateString(undefined, { weekday: "short" })}</div>
                    <div className="text-sm font-semibold">{d.getDate()}</div>
                  </div>
                );
              })}
            </div>
            {HOURS.map((h) => (
              <div key={h} className="grid grid-cols-[70px_repeat(7,1fr)] border-b border-border last:border-0">
                <div className="border-r border-border p-2 text-xs text-muted-foreground">{fmtHour(h)}</div>
                {days.map((d) => {
                  const items = byCell.get(`${fmtDate(d)}|${h}`) ?? [];
                  return (
                    <div key={d.toISOString() + h} className="min-h-[64px] space-y-1 border-r border-border p-1 last:border-0">
                      {items.map((b) => (
                        <button key={b.id} onClick={() => openEdit(b)}
                          className={`w-full rounded-md border px-2 py-1 text-left text-[11px] leading-tight transition-transform hover:-translate-y-0.5 ${STATUS_COLORS[b.status] || ""}`}>
                          <div className="truncate font-semibold">{b.service_name}</div>
                          <div className="truncate opacity-80">{b.full_name}</div>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="p-4">
          {dayBookings.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No bookings scheduled for this day.</p>
          ) : (
            <ul className="divide-y divide-border">
              {dayBookings.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Clock className="h-3.5 w-3.5" /> {fmtHour(b.scheduled_hour)} · {b.service_name}
                      <Badge variant="outline" className={STATUS_COLORS[b.status]}>{b.status}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{b.full_name}</span>
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{b.street}, {b.city} {b.zip}</span>
                      <span className="font-mono">#{b.reference}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={b.status} onValueChange={(v) => statusMut.mutate({ id: b.id, status: v })}>
                      <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["pending","confirmed","completed","cancelled"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" onClick={() => openEdit(b)}>Edit time</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(STATUS_COLORS).map(([k, cls]) => (
          <span key={k} className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 ${cls}`}>{k}</span>
        ))}
        <Link to="/admin/bookings" className="ml-auto text-primary hover:underline">Manage all bookings →</Link>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reschedule booking</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border border-border p-3">
                <div className="font-semibold">{selected.service_name}</div>
                <div className="text-xs text-muted-foreground">{selected.full_name} · #{selected.reference}</div>
                <div className="text-xs text-muted-foreground">{selected.street}, {selected.city} {selected.zip}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">Date</label>
                  <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium">Time slot</label>
                  <Select value={String(editHour)} onValueChange={(v) => setEditHour(Number(v))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {HOURS.map((h) => <SelectItem key={h} value={String(h)}>{fmtHour(h)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>{saveMut.isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
