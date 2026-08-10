import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { adminListReviewAudit } from "@/lib/hvac.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Download from "lucide-react/dist/esm/icons/download";
import Search from "lucide-react/dist/esm/icons/search";

export const Route = createFileRoute("/_authenticated/admin/reviews/audit")({
  component: AuditPage,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

type Row = {
  id: string; admin_id: string; admin_email: string | null; action: string;
  review_id: string | null; service_name: string | null; target_user_id: string | null;
  details: any; created_at: string;
};

const ACTIONS = [
  "all", "approve", "hide", "delete",
  "reply_add", "reply_edit", "reply_remove", "note_set", "note_clear",
  "bulk_approve", "bulk_hide", "bulk_delete", "bulk_clear_reply",
];

function csvEscape(v: unknown) {
  const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function AuditPage() {
  const list = useServerFn(adminListReviewAudit);
  const [days, setDays] = useState(30);
  const [action, setAction] = useState("all");
  const [q, setQ] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["review-audit", days, action, q],
    queryFn: () => list({ data: { days, action, q, limit: 5000 } }) as Promise<Row[]>,
  });

  const exportCsv = () => {
    const header = ["timestamp", "admin_email", "admin_id", "action", "service", "review_id", "target_user_id", "details"];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push([
        new Date(r.created_at).toISOString(),
        r.admin_email, r.admin_id, r.action,
        r.service_name, r.review_id, r.target_user_id,
        r.details,
      ].map(csvEscape).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `review-audit-${days}d-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Review audit log</h1>
          <p className="text-sm text-muted-foreground">Every moderation action taken by an admin.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/reviews"><ArrowLeft className="mr-1.5 h-4 w-4" />Back</Link>
          </Button>
          <Button size="sm" onClick={exportCsv} disabled={!rows.length}>
            <Download className="mr-1.5 h-4 w-4" />Export CSV
          </Button>
        </div>
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
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative ml-auto w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search admin, service, action…" className="h-9 pl-8" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Loading audit log…</p>
          ) : rows.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No entries in this range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">When</th>
                    <th className="p-3">Admin</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Service</th>
                    <th className="p-3">Review</th>
                    <th className="p-3">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="p-3 text-xs">{r.admin_email || r.admin_id.slice(0, 8)}</td>
                      <td className="p-3"><Badge variant="outline">{r.action}</Badge></td>
                      <td className="p-3 text-xs">{r.service_name || "—"}</td>
                      <td className="p-3 font-mono text-[10px] text-muted-foreground">{r.review_id?.slice(0, 8) || "—"}</td>
                      <td className="p-3 font-mono text-[10px] text-muted-foreground">
                        {r.details && Object.keys(r.details).length ? JSON.stringify(r.details).slice(0, 120) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Showing up to 5000 most-recent entries.</p>
    </div>
  );
}
