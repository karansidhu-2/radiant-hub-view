import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminUpdateSiteSettings, adminGetCapacityOverflow } from "@/lib/hvac.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

type OverflowSlot = {
  date: string; hour: number; capacity: number; count: number;
  bookings: Array<{ id: string; reference: string; service_name: string | null; technician: string | null; full_name: string | null; status: string }>;
};


type S = {
  company_name: string; tagline: string; support_phone: string;
  support_email: string; address: string; business_hours: string; emergency_phone: string;
  notify_email_enabled: boolean; notify_sms_enabled: boolean;
  notify_on_reschedule: boolean; notify_on_status_change: boolean;
  twilio_from_phone: string; technicians: string[];
  crew_capacity_enabled: boolean; crew_capacity: number;
};

const empty: S = {
  company_name: "", tagline: "", support_phone: "", support_email: "", address: "", business_hours: "", emergency_phone: "",
  notify_email_enabled: true, notify_sms_enabled: false, notify_on_reschedule: true, notify_on_status_change: true,
  twilio_from_phone: "", technicians: [],
  crew_capacity_enabled: false, crew_capacity: 1,
};

function SettingsPage() {
  const update = useServerFn(adminUpdateSiteSettings);
  const [form, setForm] = useState<S>(empty);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [techInput, setTechInput] = useState("");

  useEffect(() => {
    supabase.from("site_settings")
      .select("company_name,tagline,support_phone,support_email,address,business_hours,emergency_phone,notify_email_enabled,notify_sms_enabled,notify_on_reschedule,notify_on_status_change,twilio_from_phone,technicians,crew_capacity_enabled,crew_capacity")
      .eq("singleton", true).maybeSingle()
      .then(({ data }) => { if (data) setForm({ ...empty, ...data } as S); setLoading(false); });
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await update({ data: form });
      toast.success("Site settings saved");
    } catch (err: any) { toast.error(err?.message || "Failed to save"); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>;

  const field = (k: keyof S, label: string, placeholder = "") => (
    <div>
      <Label>{label}</Label>
      <Input value={String(form[k] ?? "")} placeholder={placeholder} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
    </div>
  );

  const toggle = (k: keyof S, label: string, hint?: string) => (
    <label className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <Switch checked={Boolean(form[k])} onCheckedChange={(v) => setForm({ ...form, [k]: v as any })} />
    </label>
  );

  const addTech = () => {
    const v = techInput.trim();
    if (!v || form.technicians.includes(v)) return;
    setForm({ ...form, technicians: [...form.technicians, v] });
    setTechInput("");
  };
  const removeTech = (t: string) => setForm({ ...form, technicians: form.technicians.filter((x) => x !== t) });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Site settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Company info, customer notifications, and technician roster.</p>
      </div>

      <form onSubmit={save} className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 text-lg font-semibold">Company</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("company_name", "Company name")}
              {field("tagline", "Tagline")}
              {field("support_phone", "Support phone", "(800) 555-0199")}
              {field("emergency_phone", "24/7 emergency phone", "(800) 555-0911")}
              {field("support_email", "Support email", "support@hvacpro.com")}
              {field("business_hours", "Business hours", "Mon–Sat 7am–8pm")}
              <div className="sm:col-span-2">{field("address", "Address")}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="mb-1 text-lg font-semibold">Customer notifications</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Automatically notify customers when a booking is confirmed, cancelled, completed, or rescheduled.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {toggle("notify_email_enabled", "Email notifications", "Uses your Lovable email domain.")}
              {toggle("notify_sms_enabled", "SMS notifications", "Requires the Twilio connector and a From number.")}
              {toggle("notify_on_status_change", "Notify on status change", "pending / confirmed / completed / cancelled")}
              {toggle("notify_on_reschedule", "Notify on reschedule", "Sent when date, time, or technician changes.")}
              <div className="sm:col-span-2">{field("twilio_from_phone", "Twilio From phone (E.164)", "+15551234567")}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="mb-1 text-lg font-semibold">Technicians</h2>
            <p className="mb-4 text-sm text-muted-foreground">Names available in the calendar assignment dropdown.</p>
            <div className="flex gap-2">
              <Input value={techInput} placeholder="e.g. Miguel R."
                onChange={(e) => setTechInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTech(); } }} />
              <Button type="button" variant="outline" onClick={addTech}>Add</Button>
            </div>
            {form.technicians.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {form.technicians.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs">
                    {t}
                    <button type="button" onClick={() => removeTech(t)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <h2 className="mb-1 text-lg font-semibold">Crew capacity</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              When on, multiple bookings can share the same time slot — up to the number of technicians/crews you have available.
              A slot appears "Booked" only after it hits capacity.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {toggle("crew_capacity_enabled", "Allow multiple bookings per slot", "Turn off to keep the classic 1-booking-per-hour rule.")}
              <div className={`rounded-md border border-border p-3 ${form.crew_capacity_enabled ? "" : "opacity-60"}`}>
                <Label>Technicians / crews available</Label>
                <Input type="number" min={1} max={50} value={form.crew_capacity}
                  disabled={!form.crew_capacity_enabled}
                  onChange={(e) => setForm({ ...form, crew_capacity: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Bookings adjust automatically: up to {form.crew_capacity_enabled ? form.crew_capacity : 1} per hour.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>


        <Button type="submit" disabled={busy} className="gradient-cool text-primary-foreground">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save changes
        </Button>
      </form>
    </div>
  );
}
