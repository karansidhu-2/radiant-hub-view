import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminListProducts, adminUpsertProduct, adminDeleteProduct } from "@/lib/hvac.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/products")({
  component: AdminProducts,
});

const empty = { slug: "", name: "", brand: "", category: "ac", price: 0, installation_fee: 0, description: "", features: [] as string[], published: true, available: true, stock: 0, seer: null, capacity_btu: null, hspf: null, tag: null };

function AdminProducts() {
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const list = useServerFn(adminListProducts), upsert = useServerFn(adminUpsertProduct), del = useServerFn(adminDeleteProduct);
  const reload = () => list().then(setItems);
  useEffect(() => { reload(); }, []);

  const save = async () => {
    try {
      const payload = { ...editing, features: typeof editing.features === "string" ? editing.features.split("\n").filter(Boolean) : editing.features };
      await upsert({ data: payload });
      toast.success("Saved"); setEditing(null); reload();
    } catch (e: any) { toast.error(e.message); }
  };
  const remove = async (id: string) => { if (!confirm("Delete?")) return; await del({ data: { id } }); toast.success("Deleted"); reload(); };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        <Button onClick={() => setEditing({ ...empty })} className="gradient-cool text-primary-foreground"><Plus className="mr-1 h-4 w-4" /> New</Button>
      </div>

      {editing && (
        <Card className="mt-4"><CardContent className="p-5 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Slug</Label><Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></div>
            <div><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><Label>Brand</Label><Input value={editing.brand} onChange={(e) => setEditing({ ...editing, brand: e.target.value })} /></div>
            <div><Label>Category</Label><Input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></div>
            <div><Label>Price ($)</Label><Input type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></div>
            <div><Label>Installation fee ($)</Label><Input type="number" value={editing.installation_fee} onChange={(e) => setEditing({ ...editing, installation_fee: Number(e.target.value) })} /></div>
            <div><Label>Stock</Label><Input type="number" value={editing.stock} onChange={(e) => setEditing({ ...editing, stock: Number(e.target.value) })} /></div>
            <div><Label>Tag</Label><Input value={editing.tag ?? ""} onChange={(e) => setEditing({ ...editing, tag: e.target.value || null })} /></div>
            <div className="flex items-center gap-2"><Switch checked={editing.published} onCheckedChange={(v) => setEditing({ ...editing, published: v })} /><Label>Published</Label></div>
            <div className="flex items-center gap-2"><Switch checked={editing.available} onCheckedChange={(v) => setEditing({ ...editing, available: v })} /><Label>Available</Label></div>
          </div>
          <div><Label>Description</Label><textarea rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
          <div><Label>Features (one per line)</Label><textarea rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={Array.isArray(editing.features) ? editing.features.join("\n") : editing.features}
            onChange={(e) => setEditing({ ...editing, features: e.target.value })} /></div>
          <div className="flex gap-2"><Button onClick={save} className="gradient-cool text-primary-foreground">Save</Button><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button></div>
        </CardContent></Card>
      )}

      <div className="mt-4 grid gap-2">
        {items.map((p) => (
          <Card key={p.id}><CardContent className="flex items-center justify-between p-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold">{p.brand} — {p.name}</p>
                {!p.published && <Badge variant="secondary">draft</Badge>}
                {!p.available && <Badge variant="destructive">unavailable</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">${p.price} • Stock: {p.stock}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
