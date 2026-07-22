import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListQuoteLeads,
  adminUpdateQuoteEstimator,
  adminUpdateQuoteLeadStatus,
  adminDeleteQuoteLead,
  type EstimatorConfig,
} from "@/lib/quote.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/quote-leads")({
  component: QuoteLeadsPage,
});

const DEFAULT: EstimatorConfig = {
  systemTypes: [
    { key: "central_ac", label: "Central AC", basePrice: 3500, perSqft: 1.5 },
  ],
  zipMultipliers: [],
  defaultMultiplier: 1.0,
  rangeSpreadPct: 20,
  disclaimer: "Estimates are non-binding.",
};

type Lead = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  zip: string;
  city: string | null;
  state: string | null;
  square_footage: number;
  system_type_label: string;
  estimate_low: number;
  estimate_high: number;
  notes: string | null;
  status: string;
  created_at: string;
};

function QuoteLeadsPage() {
  const listFn = useServerFn(adminListQuoteLeads);
  const saveCfg = useServerFn(adminUpdateQuoteEstimator);
  const setStatus = useServerFn(adminUpdateQuoteLeadStatus);
  const del = useServerFn(adminDeleteQuoteLead);

  const [enabled, setEnabled] = useState(true);
  const [cfg, setCfg] = useState<EstimatorConfig>(DEFAULT);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCfg, setSavingCfg] = useState(false);
  const [filter, setFilter] = useState({ status: "all", q: "" });

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: settings }, rows] = await Promise.all([
        supabase
          .from("site_settings")
          .select("quote_estimator, quote_estimator_enabled")
          .eq("singleton", true)
          .maybeSingle(),
        listFn({ data: { status: filter.status, q: filter.q } }),
      ]);
      if (settings?.quote_estimator) setCfg({ ...DEFAULT, ...(settings.quote_estimator as any) });
      setEnabled(settings?.quote_estimator_enabled !== false);
      setLeads(rows as Lead[]);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load();  }, [filter.status]);
  useEffect(() => {
    const t = setTimeout(() => { load(); }, 300);
    return () => clearTimeout(t);
     
  }, [filter.q]);

  const saveConfig = async () => {
    setSavingCfg(true);
    try {
      await saveCfg({ data: { enabled, ...cfg } });
      toast.success("Estimator settings saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setSavingCfg(false);
    }
  };

  const updateStatus = async (id: string, status: any) => {
    await setStatus({ data: { id, status } });
    setLeads((l) => l.map((x) => (x.id === id ? { ...x, status } : x)));
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this lead?")) return;
    await del({ data: { id } });
    setLeads((l) => l.filter((x) => x.id !== id));
  };

  const addType = () =>
    setCfg((c) => ({ ...c, systemTypes: [...c.systemTypes, { key: `type_${c.systemTypes.length + 1}`, label: "New system", basePrice: 3000, perSqft: 1 }] }));
  const removeType = (i: number) =>
    setCfg((c) => ({ ...c, systemTypes: c.systemTypes.filter((_, idx) => idx !== i) }));
  const addZip = () =>
    setCfg((c) => ({ ...c, zipMultipliers: [...c.zipMultipliers, { zip: "", multiplier: 1.0 }] }));
  const removeZip = (i: number) =>
    setCfg((c) => ({ ...c, zipMultipliers: c.zipMultipliers.filter((_, idx) => idx !== i) }));

  if (loading) return <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Instant quote estimator</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configure the pricing formula and review incoming leads.</p>
      </div>

      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium">Enable instant estimator</div>
              <p className="text-xs text-muted-foreground">When off, the /quote page shows a "contact us" message.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold">System types & base pricing</h2>
              <Button type="button" size="sm" variant="outline" onClick={addType}><Plus className="mr-1 h-3 w-3" /> Add</Button>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">Formula: (base price + per-sqft × square footage) × ZIP multiplier. Range = ± spread %.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-2">Key</th>
                    <th className="py-2 pr-2">Label</th>
                    <th className="py-2 pr-2">Base $</th>
                    <th className="py-2 pr-2">Per sqft $</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cfg.systemTypes.map((s, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-1 pr-2"><Input value={s.key} onChange={(e) => setCfg((c) => { const a = [...c.systemTypes]; a[i] = { ...a[i], key: e.target.value }; return { ...c, systemTypes: a }; })} /></td>
                      <td className="py-1 pr-2"><Input value={s.label} onChange={(e) => setCfg((c) => { const a = [...c.systemTypes]; a[i] = { ...a[i], label: e.target.value }; return { ...c, systemTypes: a }; })} /></td>
                      <td className="py-1 pr-2"><Input type="number" min={0} value={s.basePrice} onChange={(e) => setCfg((c) => { const a = [...c.systemTypes]; a[i] = { ...a[i], basePrice: Number(e.target.value) || 0 }; return { ...c, systemTypes: a }; })} /></td>
                      <td className="py-1 pr-2"><Input type="number" min={0} step={0.1} value={s.perSqft} onChange={(e) => setCfg((c) => { const a = [...c.systemTypes]; a[i] = { ...a[i], perSqft: Number(e.target.value) || 0 }; return { ...c, systemTypes: a }; })} /></td>
                      <td className="py-1"><Button type="button" size="sm" variant="ghost" onClick={() => removeType(i)}><X className="h-4 w-4" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Default ZIP multiplier</Label>
              <Input type="number" step={0.05} min={0.1} max={5} value={cfg.defaultMultiplier}
                onChange={(e) => setCfg({ ...cfg, defaultMultiplier: Number(e.target.value) || 1 })} />
            </div>
            <div>
              <Label>Range spread (± %)</Label>
              <Input type="number" min={0} max={60} value={cfg.rangeSpreadPct}
                onChange={(e) => setCfg({ ...cfg, rangeSpreadPct: Number(e.target.value) || 0 })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Disclaimer</Label>
              <Input value={cfg.disclaimer} onChange={(e) => setCfg({ ...cfg, disclaimer: e.target.value })} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold">ZIP-specific multipliers</h2>
              <Button type="button" size="sm" variant="outline" onClick={addZip}><Plus className="mr-1 h-3 w-3" /> Add</Button>
            </div>
            {cfg.zipMultipliers.length === 0 ? (
              <p className="text-xs text-muted-foreground">Optional. Use to adjust pricing by region (e.g. NYC = 1.35).</p>
            ) : (
              <div className="space-y-2">
                {cfg.zipMultipliers.map((z, i) => (
                  <div key={i} className="flex gap-2">
                    <Input placeholder="ZIP" maxLength={5} value={z.zip}
                      onChange={(e) => setCfg((c) => { const a = [...c.zipMultipliers]; a[i] = { ...a[i], zip: e.target.value.replace(/\D/g, "").slice(0, 5) }; return { ...c, zipMultipliers: a }; })} />
                    <Input type="number" step={0.05} min={0.1} max={5} value={z.multiplier}
                      onChange={(e) => setCfg((c) => { const a = [...c.zipMultipliers]; a[i] = { ...a[i], multiplier: Number(e.target.value) || 1 }; return { ...c, zipMultipliers: a }; })} />
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeZip(i)}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button type="button" onClick={saveConfig} disabled={savingCfg} className="gradient-cool text-primary-foreground">
            {savingCfg ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save estimator settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-lg font-semibold">Leads ({leads.length})</h2>
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}>
              <option value="all">All statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="converted">Converted</option>
              <option value="closed">Closed</option>
            </select>
            <Input placeholder="Search email / name / ZIP" className="h-9 w-56"
              value={filter.q} onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") load(); }} />
            <Button size="sm" variant="outline" onClick={load}>Refresh</Button>
          </div>
          {leads.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leads yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-2">Received</th>
                    <th className="py-2 pr-2">Customer</th>
                    <th className="py-2 pr-2">Location</th>
                    <th className="py-2 pr-2">System / sqft</th>
                    <th className="py-2 pr-2">Estimate</th>
                    <th className="py-2 pr-2">Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id} className="border-b align-top">
                      <td className="py-2 pr-2 text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</td>
                      <td className="py-2 pr-2">
                        <div className="font-medium">{l.full_name}</div>
                        <div className="text-xs"><a className="text-primary hover:underline" href={`mailto:${l.email}`}>{l.email}</a></div>
                        {l.phone && <div className="text-xs text-muted-foreground">{l.phone}</div>}
                      </td>
                      <td className="py-2 pr-2 text-xs">
                        {l.zip}{l.city ? ` · ${l.city}, ${l.state}` : ""}
                      </td>
                      <td className="py-2 pr-2 text-xs">
                        {l.system_type_label}<br />
                        <span className="text-muted-foreground">{l.square_footage.toLocaleString()} sqft</span>
                      </td>
                      <td className="py-2 pr-2 font-semibold">
                        ${Number(l.estimate_low).toLocaleString()} – ${Number(l.estimate_high).toLocaleString()}
                      </td>
                      <td className="py-2 pr-2">
                        <select className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          value={l.status} onChange={(e) => updateStatus(l.id, e.target.value)}>
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="converted">Converted</option>
                          <option value="closed">Closed</option>
                        </select>
                      </td>
                      <td className="py-2"><Button size="sm" variant="ghost" onClick={() => remove(l.id)}><Trash2 className="h-4 w-4" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
