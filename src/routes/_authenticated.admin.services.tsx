import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminListServices, adminUpsertService, adminDeleteService } from "@/lib/hvac.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus } from "lucide-react";
import { DynamicIcon, ICON_NAMES } from "@/components/DynamicIcon";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/services")({
  component: AdminServices,
});

const empty = { slug: "", name: "", category: "cooling", short: "", description: "", starting_at: 0, icon: "Wrench", published: true, bullets: [] as string[], required_skill: "" };

function AdminServices() {
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const list = useServerFn(adminListServices), upsert = useServerFn(adminUpsertService), del = useServerFn(adminDeleteService);

  const reload = () => list().then(setItems);
  useEffect(() => { reload(); }, []);

  const save = async () => {
    try {
      const payload = { ...editing, bullets: typeof editing.bullets === "string" ? editing.bullets.split("\n").filter(Boolean) : editing.bullets };
      await upsert({ data: payload });
      toast.success("Saved"); setEditing(null); reload();
    } catch (e: any) { toast.error(e.message); }
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this service?")) return;
    await del({ data: { id } }); toast.success("Deleted"); reload();
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Services</h1>
        <Button onClick={() => setEditing({ ...empty })} className="gradient-cool text-primary-foreground"><Plus className="mr-1 h-4 w-4" /> New</Button>
      </div>

      {editing && (
        <Card className="mt-4"><CardContent className="p-5 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Slug</Label><Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></div>
            <div><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><Label>Category</Label><Input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></div>
            <div>
              <Label>Icon</Label>
              <div className="flex items-center gap-2">
                <select
                  value={editing.icon}
                  onChange={(e) => setEditing({ ...editing, icon: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {ICON_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border">
                  <DynamicIcon name={editing.icon} className="h-5 w-5" />
                </span>
              </div>
            </div>
            <div><Label>Starting at ($)</Label><Input type="number" value={editing.starting_at} onChange={(e) => setEditing({ ...editing, starting_at: Number(e.target.value) })} /></div>
            <div className="flex items-center gap-2 mt-6"><Switch checked={editing.published} onCheckedChange={(v) => setEditing({ ...editing, published: v })} /><Label>Published</Label></div>
          </div>
          <div><Label>Short</Label><Input value={editing.short} onChange={(e) => setEditing({ ...editing, short: e.target.value })} /></div>
          <div>
            <Label>Required skill (optional)</Label>
            <Input
              value={editing.required_skill ?? ""}
              onChange={(e) => setEditing({ ...editing, required_skill: e.target.value })}
              placeholder="e.g. hvac_install, furnace, mini_split"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Only active technicians whose skills include this value count toward slot capacity for this service.
              Leave blank to use total active crew.
            </p>
          </div>

          <div><Label>Description</Label><textarea rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
          <div><Label>Bullets (one per line)</Label>
            <textarea rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={Array.isArray(editing.bullets) ? editing.bullets.join("\n") : editing.bullets}
              onChange={(e) => setEditing({ ...editing, bullets: e.target.value })} />
          </div>
          <div className="flex gap-2"><Button onClick={save} className="gradient-cool text-primary-foreground">Save</Button><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button></div>
        </CardContent></Card>
      )}

      <div className="mt-4 grid gap-2">
        {items.map((s) => (
          <Card key={s.id}><CardContent className="flex items-center justify-between gap-3 p-3 sm:p-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5"><p className="min-w-0 truncate font-semibold">{s.name}</p>{!s.published && <Badge variant="secondary">draft</Badge>}</div>
              <p className="truncate text-xs text-muted-foreground">{s.slug} • ${s.starting_at}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
