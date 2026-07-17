import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminUpdateSiteSettings } from "@/lib/hvac.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

type S = {
  company_name: string; tagline: string; support_phone: string;
  support_email: string; address: string; business_hours: string; emergency_phone: string;
};

const empty: S = { company_name: "", tagline: "", support_phone: "", support_email: "", address: "", business_hours: "", emergency_phone: "" };

function SettingsPage() {
  const update = useServerFn(adminUpdateSiteSettings);
  const [form, setForm] = useState<S>(empty);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("site_settings")
      .select("company_name,tagline,support_phone,support_email,address,business_hours,emergency_phone")
      .eq("singleton", true).maybeSingle()
      .then(({ data }) => { if (data) setForm(data as S); setLoading(false); });
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
      <Input value={form[k]} placeholder={placeholder} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Site settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Company name, contact numbers, and address shown across the header, footer, and contact page.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            {field("company_name", "Company name")}
            {field("tagline", "Tagline")}
            {field("support_phone", "Support phone", "(800) 555-0199")}
            {field("emergency_phone", "24/7 emergency phone", "(800) 555-0911")}
            {field("support_email", "Support email", "support@hvacpro.com")}
            {field("business_hours", "Business hours", "Mon–Sat 7am–8pm")}
            <div className="sm:col-span-2">{field("address", "Address")}</div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy} className="gradient-cool text-primary-foreground">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
