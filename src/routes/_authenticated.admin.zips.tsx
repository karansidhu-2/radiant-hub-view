import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminListAreas, adminUpsertArea, adminDeleteArea } from "@/lib/hvac.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/zips")({ component: AdminZips });

function AdminZips() {
  const [rows, setRows] = useState<any[]>([]);
  const [zip, setZip] = useState(""); const [city, setCity] = useState(""); const [state, setState] = useState("");
  const list = useServerFn(adminListAreas), upsert = useServerFn(adminUpsertArea), del = useServerFn(adminDeleteArea);
  const reload = () => list().then(setRows);
  useEffect(() => { reload(); }, []);

  const add = async () => {
    if (!/^\d{5}$/.test(zip)) return toast.error("Enter 5-digit ZIP");
    await upsert({ data: { zip, city, state, active: true } });
    setZip(""); setCity(""); setState(""); toast.success("Added"); reload();
  };
  const toggle = async (row: any) => { await upsert({ data: { ...row, active: !row.active } }); reload(); };
  const remove = async (id: string) => { if (!confirm("Delete?")) return; await del({ data: { id } }); reload(); };

  return (
    <div>
      <h1 className="text-2xl font-bold">Service areas (ZIP codes)</h1>
      <Card className="mt-4"><CardContent className="p-4 grid gap-3 sm:grid-cols-[1fr_2fr_1fr_auto]">
        <Input placeholder="ZIP" maxLength={5} value={zip} onChange={(e) => setZip(e.target.value)} />
        <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <Input placeholder="State" value={state} onChange={(e) => setState(e.target.value)} />
        <Button onClick={add} className="gradient-cool text-primary-foreground"><Plus className="mr-1 h-4 w-4" /> Add</Button>
      </CardContent></Card>

      <div className="mt-4 grid gap-2">
        {rows.map((r) => (
          <Card key={r.id}><CardContent className="p-3 flex items-center justify-between">
            <div>
              <span className="font-mono font-semibold">{r.zip}</span>
              <span className="ml-2 text-sm text-muted-foreground">{r.city}, {r.state}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-xs"><Switch checked={r.active} onCheckedChange={() => toggle(r)} /> Active</div>
              <Button variant="outline" size="sm" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
