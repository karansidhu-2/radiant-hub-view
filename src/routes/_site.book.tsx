import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { checkZip, getBookedSlots, createBooking } from "@/lib/hvac.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_site/book")({
  validateSearch: (s: Record<string, unknown>) => ({
    service: typeof s.service === "string" ? s.service : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Book HVAC Service — HVAC Pro" },
      { name: "description", content: "Schedule an HVAC repair, tune-up, or installation. Pick a time that works — we confirm within an hour." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: BookPage,
});

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8..18
function fmtHour(h: number) {
  const s = h < 12 ? "AM" : "PM";
  const hr = h === 12 ? 12 : h % 12;
  return `${hr}:00 ${s}`;
}
function tomorrowISO() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function BookPage() {
  const { service: serviceSlug } = Route.useSearch();
  const navigate = useNavigate();

  const { data: services = [] } = useQuery({
    queryKey: ["services", "public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services").select("slug,name").eq("published", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const svc = useMemo(
    () => services.find((s) => s.slug === serviceSlug) ?? services[0],
    [services, serviceSlug]
  );

  // Guest-friendly: no auth required. If signed in, we prefill and link the booking.
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


  const [form, setForm] = useState({
    full_name: "", email: "", phone: "",
    street: "", city: "", state: "", zip: "",
    service_slug: "", service_name: "",
    scheduled_date: tomorrowISO(), scheduled_hour: 10,
    notes: "",
  });
  useEffect(() => {
    if (svc && !form.service_slug) {
      setForm((f) => ({ ...f, service_slug: svc.slug, service_name: svc.name }));
    }
  }, [svc, form.service_slug]);
  const [zipState, setZipState] = useState<"idle" | "checking" | "ok" | "bad" | "invalid">("idle");
  const [zipMsg, setZipMsg] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [bookedHours, setBookedHours] = useState<number[]>([]);
  const [capacityConflict, setCapacityConflict] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<{ date: string; hour: number }[]>([]);


  const checkZipFn = useServerFn(checkZip);
  const bookedFn = useServerFn(getBookedSlots);
  const bookFn = useServerFn(createBooking);

  // check zip on blur
  const doCheckZip = async () => {
    if (!/^\d{5}$/.test(form.zip)) { setZipState("invalid"); setZipMsg("Enter a 5-digit ZIP"); return; }
    setZipState("checking");
    const res = await checkZipFn({ data: { zip: form.zip } });
    if (res.available) {
      setZipState("ok"); setZipMsg(`We serve ${res.city}, ${res.state}`);
      setForm((f) => ({ ...f, city: f.city || res.city || "", state: f.state || res.state || "" }));
    } else {
      setZipState("bad");
      setZipMsg(res.reason === "invalid" ? "Enter a valid ZIP" : "Sorry, we don't service this ZIP yet");
    }
  };

  useEffect(() => {
    bookedFn({ data: { date: form.scheduled_date } }).then((r) => setBookedHours(r.hours));
  }, [form.scheduled_date, bookedFn]);

  const setSvc = (slug: string) => {
    const s = services.find((x) => x.slug === slug);
    if (!s) return;
    setForm((f) => ({ ...f, service_slug: s.slug, service_name: s.name }));
  };

  const submittingRef = useRef(false);
  const runBooking = async (override?: { scheduled_date: string; scheduled_hour: number }) => {
    if (submittingRef.current) return; // guard against double-clicks / repeat chip taps
    if (zipState !== "ok") { toast.error("Please verify your ZIP is in our service area"); return; }
    submittingRef.current = true;
    const payload = { ...form, ...(override ?? {}), notes: form.notes || null };
    setBusy(true);
    setCapacityConflict(null);
    setAlternatives([]);
    try {
      const res = await bookFn({ data: payload });
      toast.success("Booking confirmed!");
      navigate({ to: "/confirmation/$kind/$ref", params: { kind: "booking", ref: res.reference } });
    } catch (err: any) {
      const msg = err?.message || "Failed to book";
      if (/fully booked|capacity/i.test(msg)) {
        setCapacityConflict("That time slot just filled up (crew capacity reached). Pick one of the suggested alternatives below, or choose another time.");
        const marker = msg.indexOf("||ALTS||");
        if (marker >= 0) {
          try {
            const alts = JSON.parse(msg.slice(marker + "||ALTS||".length));
            if (Array.isArray(alts)) setAlternatives(alts);
          } catch { /* ignore */ }
        }
        bookedFn({ data: { date: payload.scheduled_date } }).then((r) => setBookedHours(r.hours)).catch(() => {});
        toast.error("Slot is at crew capacity — pick another time");
      } else {
        toast.error(msg);
      }
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };


  const submit = (e: React.FormEvent) => { e.preventDefault(); runBooking(); };




  return (
    <section className="mx-auto max-w-2xl px-4 py-12 md:px-6">
      <h1 className="text-3xl font-bold md:text-4xl">Book your appointment</h1>
      <p className="mt-2 text-muted-foreground">Pick a service, verify your ZIP, and choose a time slot.</p>

      <form onSubmit={submit} className="mt-8 grid gap-4">
        <Card><CardContent className="p-5 grid gap-4">
          <div>
            <Label>Service</Label>
            <Select value={form.service_slug} onValueChange={setSvc}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>{services.map((s) => <SelectItem key={s.slug} value={s.slug}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Full name</Label><Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div><Label>Phone</Label><Input required type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div><Label>Email</Label><Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>

          <div><Label>Street</Label><Input required value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} /></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label>City</Label><Input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><Label>State</Label><Input required value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
            <div>
              <Label>ZIP</Label>
              <Input required value={form.zip} maxLength={5}
                onChange={(e) => { setForm({ ...form, zip: e.target.value }); setZipState("idle"); }}
                onBlur={doCheckZip} />
            </div>
          </div>
          {zipState !== "idle" && (
            <div className={`flex items-center gap-2 text-sm ${zipState === "ok" ? "text-green-600" : zipState === "checking" ? "text-muted-foreground" : "text-destructive"}`}>
              {zipState === "checking" ? <Loader2 className="h-4 w-4 animate-spin" /> : zipState === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {zipMsg}
            </div>
          )}
        </CardContent></Card>

        <Card><CardContent className="p-5 grid gap-4">
          <div>
            <Label>Preferred date</Label>
            <Input type="date" required min={tomorrowISO()} value={form.scheduled_date}
              onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
          </div>
          {capacityConflict && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <div className="flex items-start gap-2">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{capacityConflict}</span>
              </div>
              {alternatives.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-destructive/80">Suggested open slots</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {alternatives.map((a, i) => {
                      const sameDay = a.date === form.scheduled_date;
                      const dt = new Date(`${a.date}T00:00:00`);
                      const label = sameDay
                        ? fmtHour(a.hour)
                        : `${dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${fmtHour(a.hour)}`;
                      return (
                        <button
                          key={`${a.date}-${a.hour}-${i}`}
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setForm((f) => ({ ...f, scheduled_date: a.date, scheduled_hour: a.hour }));
                            setCapacityConflict(null);
                            setAlternatives([]);
                            toast.success(`Selected ${label} — rebooking…`);
                            runBooking({ scheduled_date: a.date, scheduled_hour: a.hour });
                          }}
                          className="rounded-full border border-destructive/40 bg-background px-3 py-1 text-xs font-medium text-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-60"
                        >
                          {label}
                        </button>

                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <Label>Available time slots</Label>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {HOURS.map((h) => {
                const taken = bookedHours.includes(h);
                const sel = form.scheduled_hour === h;
                return (
                  <button key={h} type="button" disabled={taken}
                    onClick={() => setForm({ ...form, scheduled_hour: h })}
                    className={`rounded-md border px-2 py-2 text-xs font-medium transition-colors ${sel ? "border-primary bg-primary text-primary-foreground" : taken ? "border-border bg-muted text-muted-foreground line-through" : "border-border bg-card hover:bg-accent"}`}>
                    {fmtHour(h)}
                  </button>
                );
              })}
            </div>
          </div>
          <div><Label>Notes (optional)</Label>
            <textarea rows={3} className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </CardContent></Card>

        <Button type="submit" size="lg" disabled={busy || zipState !== "ok"} className="gradient-cool text-primary-foreground shadow-soft">
          {busy ? "Booking…" : "Confirm booking"}
        </Button>
      </form>
    </section>
  );
}
