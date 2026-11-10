import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { adminListActions, adminActionOptions } from "@/lib/hvac.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import Download from "lucide-react/dist/esm/icons/download";
import ScrollText from "lucide-react/dist/esm/icons/scroll-text";
import Search from "lucide-react/dist/esm/icons/search";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  component: AuditPage,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{error instanceof Error ? error.message : String(error)}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

type Row = {
  id: string; admin_id: string | null; admin_email: string | null;
  action: string; entity_type: string; entity_id: string | null;
  before: any; after: any; details: any; created_at: string;
};

function csvEscape(v: unknown) {
  const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function AuditPage() {
  const list = useServerFn(adminListActions);
  const opts = useServerFn(adminActionOptions);

  const [days, setDays] = useState(30);
  const [action, setAction] = useState("all");
  const [entity, setEntity] = useState("all");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-audit", days, action, entity, q],
    queryFn: () => list({ data: { days, action, entity_type: entity, q, limit: 5000 } }) as Promise<Row[]>,
  });

  const { data: options } = useQuery({
    queryKey: ["admin-audit-options"],
    queryFn: () => opts(),
  });

  const exportCsv = () => {
    const header = ["timestamp","admin_email","admin_id","action","entity_type","entity_id","before","after","details"];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push([
        new Date(r.created_at).toISOString(),
        r.admin_email, r.admin_id, r.action, r.entity_type, r.entity_id,
        r.before, r.after, r.details,
      ].map(csvEscape).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `admin-audit-${days}d-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const grouped = useMemo(() => {
    const byAdmin: Record<string, number> = {};
    for (const r of rows) {
      const k = r.admin_email || r.admin_id || "unknown";
      byAdmin[k] = (byAdmin[k] ?? 0) + 1;
    }
    return byAdmin;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ScrollText className="h-6 w-6 text-primary" /> Admin audit log
          </h1>
          <p className="text-sm text-muted-foreground">
            Every change made by an admin — who, what, and before/after.
          </p>
        </div>
        <Button size="sm" onClick={exportCsv} disabled={!rows.length}>
          <Download className="mr-1.5 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[7, 14, 30, 60, 90, 180, 365].map((d) => (
                <SelectItem key={d} value={String(d)}>Last {d} days</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Entity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              {(options?.entities ?? []).map((e) => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="h-9 w-56"><SelectValue placeholder="Action" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {(options?.actions ?? []).map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative ml-auto w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search admin, entity, id…" className="h-9 pl-8" />
          </div>
        </CardContent>
      </Card>

      {Object.keys(grouped).length > 0 && (
        <Card>
          <CardContent className="flex flex-wrap gap-2 p-3">
            <span className="text-xs uppercase text-muted-foreground">By admin:</span>
            {Object.entries(grouped).sort((a,b) => b[1]-a[1]).map(([k,v]) => (
              <Badge key={k} variant="secondary">{k} · {v}</Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Loading audit log…</p>
          ) : rows.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No entries in this range.</p>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((r) => {
                const open = !!expanded[r.id];
                const hasDetail = r.before || r.after || (r.details && Object.keys(r.details).length);
                return (
                  <div key={r.id} className="p-3">
                    <button
                      className="flex w-full items-start justify-between gap-3 text-left"
                      onClick={() => hasDetail && setExpanded((s) => ({ ...s, [r.id]: !s[r.id] }))}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {hasDetail ? (open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : <span className="w-3.5" />}
                          <Badge variant="outline" className="font-mono text-[10px]">{r.action}</Badge>
                          <Badge variant="secondary" className="text-[10px]">{r.entity_type}</Badge>
                          {r.entity_id && (
                            <span className="truncate font-mono text-[11px] text-muted-foreground">{r.entity_id}</span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {r.admin_email || r.admin_id?.slice(0, 8) || "unknown"} · {new Date(r.created_at).toLocaleString()}
                        </p>
                      </div>
                    </button>
                    {open && hasDetail && (
                      <div className="mt-2 grid gap-2 pl-6 md:grid-cols-2">
                        {r.before && Object.keys(r.before).length > 0 && (
                          <div className="rounded-md border border-border bg-secondary/30 p-2">
                            <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Before</p>
                            <pre className="whitespace-pre-wrap break-words text-[11px] leading-snug">{JSON.stringify(r.before, null, 2)}</pre>
                          </div>
                        )}
                        {r.after && Object.keys(r.after).length > 0 && (
                          <div className="rounded-md border border-border bg-primary/5 p-2">
                            <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">After</p>
                            <pre className="whitespace-pre-wrap break-words text-[11px] leading-snug">{JSON.stringify(r.after, null, 2)}</pre>
                          </div>
                        )}
                        {r.details && Object.keys(r.details).length > 0 && (
                          <div className="rounded-md border border-border p-2 md:col-span-2">
                            <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Details</p>
                            <pre className="whitespace-pre-wrap break-words text-[11px] leading-snug">{JSON.stringify(r.details, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Showing up to 5000 most-recent entries.</p>
    </div>
  );
}
