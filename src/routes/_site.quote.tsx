import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitQuoteEstimate, type EstimatorConfig } from "@/lib/quote.functions";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Calculator, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_site/quote")({
  head: () => ({
    meta: [
      { title: "Instant HVAC Installation Quote — Free Price Estimate" },
      {
        name: "description",
        content:
          "Get an instant price range for your HVAC installation. Enter your ZIP, square footage, and system type — no phone call required.",
      },
      { property: "og:title", content: "Instant HVAC Installation Quote" },
      { property: "og:description", content: "Free instant price range in seconds." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: QuotePage,
});

const DEFAULT_TYPES = [
  { key: "central_ac", label: "Central AC", basePrice: 3500, perSqft: 1.5 },
  { key: "heat_pump", label: "Heat Pump", basePrice: 5000, perSqft: 2.0 },
  { key: "furnace", label: "Gas Furnace", basePrice: 3000, perSqft: 1.2 },
  { key: "mini_split", label: "Ductless Mini-Split", basePrice: 4000, perSqft: 1.8 },
  { key: "tankless", label: "Tankless Water Heater", basePrice: 2200, perSqft: 0 },
];

function QuotePage() {
  const settings = useSiteSettings();
  const submit = useServerFn(submitQuoteEstimate);
  const cfg = (settings.quote_estimator ?? {}) as Partial<EstimatorConfig>;
  const enabled = settings.quote_estimator_enabled !== false;
  const systemTypes = useMemo(
    () => (Array.isArray(cfg.systemTypes) && cfg.systemTypes.length ? cfg.systemTypes : DEFAULT_TYPES),
    [cfg.systemTypes],
  );

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    zip: "",
    square_footage: 1500,
    system_type_key: systemTypes[0]?.key ?? "central_ac",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<null | {
    low: number;
    high: number;
    systemLabel: string;
    disclaimer: string;
  }>(null);

  useEffect(() => {
    // Keep selected type valid if config changes
    if (!systemTypes.some((s) => s.key === form.system_type_key) && systemTypes[0]) {
      setForm((f) => ({ ...f, system_type_key: systemTypes[0].key }));
    }
  }, [systemTypes, form.system_type_key]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Live client-side estimate (mirrors server computeRange in quote.functions.ts).
  const livePreview = useMemo(() => {
    const sys: any = systemTypes.find((s: any) => s.key === form.system_type_key);
    if (!sys) return null;
    const zipMults: any[] = Array.isArray(cfg.zipMultipliers) ? cfg.zipMultipliers : [];
    const defaultMult = Number(cfg.defaultMultiplier) > 0 ? Number(cfg.defaultMultiplier) : 1;
    const mult = zipMults.find((z) => z?.zip === form.zip)?.multiplier ?? defaultMult;
    const spreadPct = Math.max(0, Math.min(60, Number(cfg.rangeSpreadPct) || 20));
    const sqft = Math.max(0, Number(form.square_footage) || 0);
    const base = (Number(sys.basePrice || 0) + Number(sys.perSqft || 0) * sqft) * mult;
    const spread = spreadPct / 100;
    const low = Math.max(0, Math.round((base * (1 - spread)) / 25) * 25);
    const high = Math.max(low, Math.round((base * (1 + spread)) / 25) * 25);
    const mid = Math.round(((low + high) / 2) / 25) * 25;
    const hasZipMatch = /^\d{5}$/.test(form.zip) && !!zipMults.find((z) => z?.zip === form.zip);
    return { low, high, mid, mult, spreadPct, systemLabel: sys.label, hasZipMatch };
  }, [systemTypes, form.system_type_key, form.zip, form.square_footage, cfg.zipMultipliers, cfg.defaultMultiplier, cfg.rangeSpreadPct]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await submit({ data: form });
      setResult(res);
      toast.success("Estimate ready");
    } catch (err: any) {
      toast.error(err?.message || "Could not generate estimate");
    } finally {
      setBusy(false);
    }
  };

  if (!enabled) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 md:px-6">
        <h1 className="text-3xl font-bold">Instant quote</h1>
        <p className="mt-3 text-muted-foreground">
          The instant estimator is currently disabled. Please <Link to="/contact" className="text-primary underline">contact us</Link> for a personalized quote.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-16">
      <div className="mb-8 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl gradient-cool text-primary-foreground shadow-soft">
          <Calculator className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Instant installation quote</h1>
          <p className="text-sm text-muted-foreground">Get a price range in seconds — no phone call required.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-5 md:p-6">
          {result ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
              <h2 className="mt-3 text-lg font-semibold">Your {result.systemLabel} estimate</h2>
              <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-6">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Estimated installed range</div>
                <div className="mt-1 text-3xl font-bold md:text-4xl">
                  ${result.low.toLocaleString()} – ${result.high.toLocaleString()}
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">{result.disclaimer}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Link to="/book" search={{ service: "" }}>
                  <Button className="gradient-cool text-primary-foreground">
                    <Sparkles className="mr-2 h-4 w-4" /> Book installation
                  </Button>
                </Link>
                <Button variant="outline" onClick={() => setResult(null)}>New estimate</Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                We saved your details and will follow up at <b>{form.email}</b>.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Full name</Label>
                  <Input required minLength={2} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                </div>
                <div>
                  <Label>Phone (optional)</Label>
                  <Input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                </div>
                <div>
                  <Label>ZIP code</Label>
                  <Input required inputMode="numeric" pattern="\d{5}" maxLength={5}
                    value={form.zip} onChange={(e) => set("zip", e.target.value.replace(/\D/g, "").slice(0, 5))} />
                </div>
                <div>
                  <Label>Square footage</Label>
                  <Input required type="number" min={100} max={20000} step={50}
                    value={form.square_footage}
                    onChange={(e) => set("square_footage", Math.max(100, Math.min(20000, Number(e.target.value) || 0)))} />
                </div>
                <div>
                  <Label>System type</Label>
                  <select
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.system_type_key}
                    onChange={(e) => set("system_type_key", e.target.value)}
                  >
                    {systemTypes.map((s: any) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Input placeholder="Any details about your home or system"
                  value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </div>

              {livePreview && (
                <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                      <Sparkles className="h-3.5 w-3.5" /> Live estimate
                    </div>
                    <span className="text-xs text-muted-foreground">Updates as you type</span>
                  </div>
                  <div className="mt-2 text-2xl font-bold md:text-3xl">
                    ${livePreview.low.toLocaleString()} – ${livePreview.high.toLocaleString()}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {livePreview.systemLabel} · ~{form.square_footage.toLocaleString()} sq ft
                    {livePreview.hasZipMatch ? ` · ZIP-adjusted ×${livePreview.mult}` : " · using default regional rate"}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-md bg-background/60 p-2">
                      <div className="text-muted-foreground">Low</div>
                      <div className="font-semibold">${livePreview.low.toLocaleString()}</div>
                    </div>
                    <div className="rounded-md border border-primary/30 bg-background/80 p-2">
                      <div className="text-muted-foreground">Typical</div>
                      <div className="font-semibold">${livePreview.mid.toLocaleString()}</div>
                    </div>
                    <div className="rounded-md bg-background/60 p-2">
                      <div className="text-muted-foreground">High</div>
                      <div className="font-semibold">${livePreview.high.toLocaleString()}</div>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Preview only — submit to save your estimate and get email confirmation.
                  </p>
                </div>
              )}

              <Button type="submit" disabled={busy} className="w-full gradient-cool text-primary-foreground">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                {livePreview ? `Confirm my estimate (~$${livePreview.mid.toLocaleString()})` : "Get my instant estimate"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                By submitting you agree to be contacted about your quote.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
