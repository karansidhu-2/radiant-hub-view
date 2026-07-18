import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { adminGetCapacityOverflow } from "@/lib/hvac.functions";
import { AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";

type OverflowSlot = { date: string; hour: number; capacity: number; count: number };

export function CapacityAlerts() {
  const getOverflow = useServerFn(adminGetCapacityOverflow);
  const [items, setItems] = useState<OverflowSlot[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let mounted = true;
    let seen = "";
    const load = async () => {
      try {
        const res = await getOverflow({ data: {} });
        if (!mounted) return;
        const list = (res?.overflow ?? []) as OverflowSlot[];
        setItems(list);
        const sig = list.map((o) => `${o.date}#${o.hour}#${o.count}`).sort().join("|");
        if (sig && sig !== seen) {
          seen = sig;
          if (list.length > 0) {
            toast.warning(`${list.length} slot(s) over crew capacity`, {
              description: "Bulk save or booking changes caused conflicts. Review the calendar.",
              action: {
                label: "Open calendar",
                onClick: () => {
                  const first = list[0];
                  window.location.href = `/admin/calendar?date=${first.date}&hour=${first.hour}`;
                },
              },
            });
          }
        }
      } catch {
        /* ignore silent poll errors */
      }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { mounted = false; clearInterval(t); };
  }, [getOverflow]);

  if (dismissed || items.length === 0) return null;

  return (
    <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <div className="font-semibold text-destructive">
              {items.length} time slot{items.length === 1 ? "" : "s"} exceed crew capacity
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {items.slice(0, 8).map((o) => (
                <Link key={`${o.date}-${o.hour}`}
                  to="/admin/calendar" search={{ date: o.date, hour: o.hour } as any}
                  className="rounded-full border border-destructive/40 bg-background px-2 py-0.5 text-[11px] font-medium text-destructive hover:bg-destructive/10">
                  {o.date} · {String(o.hour).padStart(2, "0")}:00 ({o.count}/{o.capacity})
                </Link>
              ))}
              {items.length > 8 && (
                <span className="text-[11px] text-muted-foreground">+{items.length - 8} more</span>
              )}
            </div>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
