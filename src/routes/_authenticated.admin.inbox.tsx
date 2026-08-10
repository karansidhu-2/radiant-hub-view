import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  adminListConflicts, adminResolveConflict, adminResolveAllConflicts, adminDeleteConflict,
} from "@/lib/hvac.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import CalendarDays from "lucide-react/dist/esm/icons/calendar-days";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Inbox from "lucide-react/dist/esm/icons/inbox";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/inbox")({
  component: InboxPage,
});

const SOURCE_LABEL: Record<string, string> = {
  booking: "Customer booking",
  reschedule: "Reschedule",
  capacity_change: "Capacity change",
  bulk: "Bulk save",
};

function fmtHour(h: number) {
  const s = h < 12 ? "AM" : "PM";
  const hr = h === 12 ? 12 : h % 12;
  return `${hr}:00 ${s}`;
}

function InboxPage() {
  const qc = useQueryClient();
  const list = useServerFn(adminListConflicts);
  const resolve = useServerFn(adminResolveConflict);
  const resolveAll = useServerFn(adminResolveAllConflicts);
  const del = useServerFn(adminDeleteConflict);

  const [includeResolved, setIncludeResolved] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin", "conflicts", includeResolved],
    queryFn: () => list({ data: { includeResolved } }),
    refetchInterval: 60_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "conflicts"] });

  const toggle = useMutation({
    mutationFn: (v: { id: string; resolved: boolean }) => resolve({ data: v }),
    onSuccess: (_, v) => { toast.success(v.resolved ? "Marked resolved" : "Reopened"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const resolveAllMut = useMutation({
    mutationFn: () => resolveAll(),
    onSuccess: () => { toast.success("All conflicts marked resolved"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const unresolved = items.filter((i: any) => !i.resolved).length;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Inbox className="h-6 w-6 text-primary" /> Notifications Inbox
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every crew capacity conflict from bookings, reschedules, and bulk saves.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={includeResolved} onCheckedChange={setIncludeResolved} />
            <span>Show resolved</span>
          </label>
          <Button size="sm" variant="outline" disabled={!unresolved || resolveAllMut.isPending}
            onClick={() => resolveAllMut.mutate()}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" /> Resolve all
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <Card className="mt-6"><CardContent className="p-10 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-2 font-semibold">Inbox zero</p>
          <p className="text-sm text-muted-foreground">
            No {includeResolved ? "" : "unresolved "}capacity conflicts.
          </p>
        </CardContent></Card>
      ) : (
        <div className="mt-4 grid gap-2">
          {items.map((c: any) => (
            <Card key={c.id} className={c.resolved ? "opacity-70" : ""}>
              <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <AlertTriangle className={`h-4 w-4 ${c.resolved ? "text-muted-foreground" : "text-destructive"}`} />
                    <span className="font-semibold">
                      {c.scheduled_date} · {fmtHour(c.scheduled_hour)}
                    </span>
                    <Badge variant={c.resolved ? "secondary" : "destructive"}>
                      {c.count}/{c.capacity}
                    </Badge>
                    <Badge variant="outline">{SOURCE_LABEL[c.source] ?? c.source}</Badge>
                    {c.resolved && <Badge variant="secondary">resolved</Badge>}
                  </div>
                  {c.note && <p className="mt-1 text-sm text-muted-foreground">{c.note}</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Logged {new Date(c.created_at).toLocaleString()}
                    {c.resolved_at && ` • Resolved ${new Date(c.resolved_at).toLocaleString()}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to="/admin/calendar"
                    search={{ date: c.scheduled_date, hour: c.scheduled_hour } as any}
                  >
                    <Button size="sm" variant="outline">
                      <CalendarDays className="mr-1.5 h-4 w-4" /> Open calendar
                    </Button>
                  </Link>
                  {c.resolved ? (
                    <Button size="sm" variant="outline"
                      onClick={() => toggle.mutate({ id: c.id, resolved: false })}>
                      <RotateCcw className="mr-1.5 h-4 w-4" /> Reopen
                    </Button>
                  ) : (
                    <Button size="sm"
                      onClick={() => toggle.mutate({ id: c.id, resolved: true })}>
                      <CheckCircle2 className="mr-1.5 h-4 w-4" /> Mark resolved
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => {
                    if (confirm("Delete this entry?")) removeMut.mutate(c.id);
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
