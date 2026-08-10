import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import KeyRound from "lucide-react/dist/esm/icons/key-round";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";

export const Route = createFileRoute("/_authenticated/admin/security")({
  component: SecurityPage,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{error.message}</div>,
});

type Factor = { id: string; friendly_name?: string | null; factor_type: string; status: string };

function SecurityPage() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enroll, setEnroll] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [aal, setAal] = useState<string>("aal1");

  const refresh = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    const list = [...(data?.totp ?? []), ...(data?.phone ?? [])] as Factor[];
    setFactors(list);
    const { data: lvl } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setAal(lvl?.currentLevel ?? "aal1");
  };

  useEffect(() => { refresh(); }, []);

  const startEnroll = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Admin TOTP ${new Date().toISOString().slice(0, 10)}` });
      if (error) throw error;
      setEnroll({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (e: any) {
      toast.error(e?.message ?? "Enrollment failed");
    } finally { setBusy(false); }
  };

  const verify = async () => {
    if (!enroll) return;
    setBusy(true);
    try {
      const { data: c, error: e1 } = await supabase.auth.mfa.challenge({ factorId: enroll.factorId });
      if (e1) throw e1;
      const { error: e2 } = await supabase.auth.mfa.verify({ factorId: enroll.factorId, challengeId: c.id, code });
      if (e2) throw e2;
      toast.success("Two-factor enabled");
      setEnroll(null); setCode("");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Invalid code");
    } finally { setBusy(false); }
  };

  const unenroll = async (id: string) => {
    if (!confirm("Remove this authenticator?")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) toast.error(error.message); else { toast.success("Removed"); refresh(); }
  };

  const verified = factors.filter((f) => f.status === "verified");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><KeyRound className="h-6 w-6" /> Security</h1>
        <p className="text-sm text-muted-foreground">Add two-factor authentication (TOTP) to protect admin sign-in.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className={`h-5 w-5 ${verified.length ? "text-emerald-600" : "text-muted-foreground"}`} />
            Status: {verified.length ? `2FA enabled (${aal.toUpperCase()})` : "2FA not enabled"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {verified.length === 0 && !enroll && (
            <Button disabled={busy} onClick={startEnroll}>Enable authenticator app</Button>
          )}

          {enroll && (
            <div className="space-y-3 rounded-md border border-border p-4">
              <p className="text-sm">Scan the QR in Google Authenticator, 1Password, Authy, etc. Then enter the 6-digit code below.</p>
              <div className="flex flex-col items-start gap-3 md:flex-row">
                {/* Supabase returns a data:image/svg+xml URL — render as <img> (data URLs cannot execute script in an image element). */}
                <img
                  src={enroll.qr}
                  alt="Scan this QR code with your authenticator app"
                  width={192}
                  height={192}
                  className="rounded bg-white p-2"
                />
                <div className="text-xs text-muted-foreground">
                  <div>Can't scan? Enter this secret manually:</div>
                  <code className="mt-1 block break-all rounded bg-secondary px-2 py-1">{enroll.secret}</code>
                </div>
              </div>
              <div className="flex items-end gap-2">
                <div className="w-40">
                  <Label>6-digit code</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" />
                </div>
                <Button onClick={verify} disabled={busy || code.length !== 6}>Verify & enable</Button>
                <Button variant="outline" onClick={() => { setEnroll(null); setCode(""); }}>Cancel</Button>
              </div>
            </div>
          )}

          {verified.length > 0 && (
            <div className="divide-y divide-border rounded-md border border-border">
              {verified.map((f) => (
                <div key={f.id} className="flex items-center justify-between p-3">
                  <div>
                    <div className="text-sm font-medium">{f.friendly_name || f.factor_type}</div>
                    <div className="text-xs text-muted-foreground">Type: {f.factor_type}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => unenroll(f.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
