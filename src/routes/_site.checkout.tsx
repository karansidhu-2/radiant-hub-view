import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { checkZip, getBookedSlots, createOrder } from "@/lib/hvac.functions";
import { useCart } from "@/context/CartContext";
import { formatMoney } from "@/data/products";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_site/checkout")({
  head: () => ({ meta: [{ title: "Checkout — HVAC Pro" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: CheckoutPage,
});

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8);
const fmtHour = (h: number) => `${h === 12 ? 12 : h % 12}:00 ${h < 12 ? "AM" : "PM"}`;
const tomorrowISO = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };

function CheckoutPage() {
  const { detailed, subtotal, installationTotal, total, clear } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "",
    street: "", city: "", state: "", zip: "",
    scheduled_date: tomorrowISO(), scheduled_hour: 10, notes: "",
  });
  // Guest-friendly: prefill if signed in, otherwise proceed as guest.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (u) setForm((f) => ({
        ...f,
        email: f.email || u.email || "",
        full_name: f.full_name || (u.user_metadata?.full_name as string) || "",
      }));
    });
  }, []);

  const [zipState, setZipState] = useState<"idle" | "checking" | "ok" | "bad">("idle");
  const [zipMsg, setZipMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [bookedHours, setBookedHours] = useState<number[]>([]);

  const checkZipFn = useServerFn(checkZip);
  const bookedFn = useServerFn(getBookedSlots);
  const orderFn = useServerFn(createOrder);

  useEffect(() => { bookedFn({ data: { date: form.scheduled_date } }).then((r) => setBookedHours(r.hours)); }, [form.scheduled_date, bookedFn]);

  const doCheckZip = async () => {
    if (!/^\d{5}$/.test(form.zip)) { setZipState("bad"); setZipMsg("Enter a 5-digit ZIP"); return; }
    setZipState("checking");
    const res = await checkZipFn({ data: { zip: form.zip } });
    if (res.available) {
      setZipState("ok"); setZipMsg(`We serve ${res.city}, ${res.state}`);
      setForm((f) => ({ ...f, city: f.city || res.city || "", state: f.state || res.state || "" }));
    } else { setZipState("bad"); setZipMsg("Sorry, we don't service this ZIP yet"); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (zipState !== "ok") { toast.error("Verify your ZIP first"); return; }
    if (detailed.length === 0) { toast.error("Cart is empty"); return; }
    setBusy(true);
    try {
      const items = detailed.map(({ item, product }) => ({
        product_slug: product.slug, product_name: product.name, brand: product.brand,
        quantity: item.quantity, unit_price: product.price,
        installation_fee: product.installationFee, include_installation: item.includeInstallation,
      }));
      const res = await orderFn({ data: { ...form, items, notes: form.notes || null } });
      clear();
      toast.success("Order placed!");
      navigate({ to: "/confirmation/$kind/$ref", params: { kind: "order", ref: res.reference } });
    } catch (err: any) {
      toast.error(err?.message || "Checkout failed");
    } finally { setBusy(false); }
  };



  if (detailed.length === 0) {
    return <div className="mx-auto max-w-md px-4 py-16 text-center">
      <p>Your cart is empty.</p>
      <Link to="/shop"><Button className="mt-4 gradient-cool text-primary-foreground">Shop systems</Button></Link>
    </div>;
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 md:px-6">
      <h1 className="text-3xl font-bold md:text-4xl">Checkout</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <form onSubmit={submit} className="grid gap-4">
          <Card><CardContent className="p-5 grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Full name</Label><Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div><Label>Phone</Label><Input required type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><Label>Email</Label><Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Installation address</Label><Input required placeholder="Street" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} /></div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input required placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              <Input required placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              <Input required placeholder="ZIP" maxLength={5} value={form.zip}
                onChange={(e) => { setForm({ ...form, zip: e.target.value }); setZipState("idle"); }}
                onBlur={doCheckZip} />
            </div>
            {zipState !== "idle" && (
              <div className={`flex items-center gap-2 text-sm ${zipState === "ok" ? "text-green-600" : zipState === "checking" ? "text-muted-foreground" : "text-destructive"}`}>
                {zipState === "checking" ? <Loader2 className="h-4 w-4 animate-spin" /> : zipState === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {zipMsg}
              </div>
            )}
          </CardContent></Card>

          <Card><CardContent className="p-5 grid gap-4">
            <h2 className="font-semibold">Installation appointment</h2>
            <div><Label>Preferred date</Label>
              <Input type="date" required min={tomorrowISO()} value={form.scheduled_date}
                onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
            </div>
            <div><Label>Time slot</Label>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {HOURS.map((h) => {
                  const taken = bookedHours.includes(h);
                  const sel = form.scheduled_hour === h;
                  return (
                    <button key={h} type="button" disabled={taken}
                      onClick={() => setForm({ ...form, scheduled_hour: h })}
                      className={`rounded-md border px-2 py-2 text-xs font-medium ${sel ? "border-primary bg-primary text-primary-foreground" : taken ? "border-border bg-muted text-muted-foreground line-through" : "border-border bg-card hover:bg-accent"}`}>
                      {fmtHour(h)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div><Label>Notes</Label>
              <textarea rows={3} className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </CardContent></Card>

          <Button type="submit" size="lg" disabled={busy || zipState !== "ok"} className="gradient-cool text-primary-foreground shadow-soft">
            {busy ? "Placing order…" : `Place order — ${formatMoney(total)}`}
          </Button>
        </form>

        <Card className="h-fit sticky top-24"><CardContent className="p-6">
          <h2 className="text-lg font-bold">Summary</h2>
          <div className="mt-4 space-y-3 text-sm">
            {detailed.map(({ item, product }) => (
              <div key={product.slug} className="flex justify-between gap-3">
                <span>{product.name} × {item.quantity}{item.includeInstallation ? " + install" : ""}</span>
                <span className="font-semibold">{formatMoney((product.price + (item.includeInstallation ? product.installationFee : 0)) * item.quantity)}</span>
              </div>
            ))}
          </div>
          <Separator className="my-4" />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatMoney(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Installation</span><span>{formatMoney(installationTotal)}</span></div>
          </div>
          <Separator className="my-4" />
          <div className="flex items-baseline justify-between"><span className="font-semibold">Total</span><span className="text-2xl font-bold">{formatMoney(total)}</span></div>
        </CardContent></Card>
      </div>
    </section>
  );
}
