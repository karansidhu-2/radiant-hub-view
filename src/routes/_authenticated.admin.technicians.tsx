import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListTechnicians, adminUpsertTechnician, adminDeleteTechnician } from "@/lib/hvac.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Plus, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/technicians")({
  component: TechniciansPage,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{error.message}</div>,
});

type Tech = { id: string; name: string; email: string | null; phone: string | null; skills: string[] | null; active: boolean };

function TechniciansPage() {
  const qc = useQueryClient();
  const list = useServerFn(adminListTechnicians);
  const upsert = useServerFn(adminUpsertTechnician);
  const del = useServerFn(adminDeleteTechnician);
  const q = useQuery({ queryKey: ["admin-technicians"], queryFn: () => list() });

  const [draft, setDraft] = useState<{ id?: string; name: string; email: string; phone: string; skills: string; active: boolean }>({
    name: "", email: "", phone: "", skills: "", active: true,
  });

  const save = useMutation({
    mutationFn: async () =>
      upsert({
        data: {
          id: draft.id ?? null,
          name: draft.name,
          email: draft.email || null,
          phone: draft.phone || null,
          skills: draft.skills.split(",").map((s) => s.trim()).filter(Boolean),
          active: draft.active,
        },
      }),
    onSuccess: () => {
      toast.success(draft.id ? "Technician updated" : "Technician added");
      setDraft({ name: "", email: "", phone: "", skills: "", active: true });
      qc.invalidateQueries({ queryKey: ["admin-technicians"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Technician removed");
      qc.invalidateQueries({ queryKey: ["admin-technicians"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  const rows = (q.data ?? []) as Tech[];
  const activeCount = useMemo(() => rows.filter((r) => r.active).length, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Users className="h-6 w-6" /> Technicians</h1>
          <p className="text-sm text-muted-foreground">
            Active technicians define per-slot capacity. Services with a required skill only consume qualified crew.
          </p>
        </div>
        <Badge variant="secondary">{activeCount} active</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle>{draft.id ? "Edit technician" : "Add technician"}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div><Label>Name</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Alex Kim" /></div>
          <div><Label>Email</Label><Input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="alex@company.com" /></div>
          <div><Label>Phone</Label><Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="(555) 123-4567" /></div>
          <div>
            <Label>Skills (comma separated)</Label>
            <Input value={draft.skills} onChange={(e) => setDraft({ ...draft, skills: e.target.value })} placeholder="hvac_install, furnace, mini_split" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v })} />
            <span className="text-sm">Active (counts toward capacity)</span>
          </div>
          <div className="flex items-end justify-end gap-2 md:col-span-2">
            {draft.id && (
              <Button variant="outline" onClick={() => setDraft({ name: "", email: "", phone: "", skills: "", active: true })}>Cancel</Button>
            )}
            <Button disabled={!draft.name || save.isPending} onClick={() => save.mutate()}>
              <Plus className="mr-1 h-4 w-4" /> {draft.id ? "Update" : "Add technician"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Crew</CardTitle></CardHeader>
        <CardContent>
          {q.isLoading ? <div className="text-sm text-muted-foreground">Loading…</div> : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No technicians yet. Add one above; slot capacity falls back to Site Settings until you do.</div>
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              {rows.map((t) => (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t.name}</span>
                      {!t.active && <Badge variant="outline">Inactive</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{[t.email, t.phone].filter(Boolean).join(" • ") || "—"}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(t.skills ?? []).map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDraft({
                      id: t.id, name: t.name, email: t.email ?? "", phone: t.phone ?? "",
                      skills: (t.skills ?? []).join(", "), active: t.active,
                    })}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Remove ${t.name}?`)) remove.mutate(t.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
