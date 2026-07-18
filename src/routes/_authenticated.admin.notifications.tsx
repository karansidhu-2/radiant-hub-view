import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminUpdateSiteSettings } from "@/lib/hvac.functions";
import {
  DEFAULT_TEMPLATES, KIND_LABEL, NOTIFICATION_KINDS, SAMPLE_VARS,
  TEMPLATE_VARIABLES, bodyToHtml, mergedTemplate, renderTemplate, wrapEmailHtml,
  type NotificationKind, type NotificationTemplates, type TemplateEntry,
} from "@/lib/notification-templates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RotateCcw, Save, Mail, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  component: NotificationsPage,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

type SettingsRow = {
  company_name: string;
  support_phone: string;
  tagline: string;
  support_email: string;
  address: string;
  business_hours: string;
  emergency_phone: string;
  notify_email_enabled: boolean;
  notify_sms_enabled: boolean;
  notify_on_reschedule: boolean;
  notify_on_status_change: boolean;
  twilio_from_phone: string;
  technicians: string[];
  notification_templates: NotificationTemplates | null;
};

function NotificationsPage() {
  const qc = useQueryClient();
  const save = useServerFn(adminUpdateSiteSettings);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["site-settings-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data as SettingsRow;
    },
  });

  const [kind, setKind] = useState<NotificationKind>("confirmed");
  const [drafts, setDrafts] = useState<Record<NotificationKind, TemplateEntry>>(() => {
    return NOTIFICATION_KINDS.reduce((acc, k) => {
      acc[k] = { ...DEFAULT_TEMPLATES[k] };
      return acc;
    }, {} as Record<NotificationKind, TemplateEntry>);
  });
  const [initialized, setInitialized] = useState(false);

  if (settings && !initialized) {
    const seeded = NOTIFICATION_KINDS.reduce((acc, k) => {
      acc[k] = mergedTemplate(k, settings.notification_templates);
      return acc;
    }, {} as Record<NotificationKind, TemplateEntry>);
    setDrafts(seeded);
    setInitialized(true);
  }

  const current = drafts[kind];
  const setField = (f: keyof TemplateEntry, v: string) =>
    setDrafts((d) => ({ ...d, [kind]: { ...d[kind], [f]: v } }));

  const vars = useMemo(() => ({
    ...SAMPLE_VARS,
    company_name: settings?.company_name || SAMPLE_VARS.company_name,
    support_phone: settings?.support_phone || SAMPLE_VARS.support_phone,
  }), [settings]);

  const previewSubject = renderTemplate(current.email_subject, vars);
  const previewBody = renderTemplate(current.email_body, vars);
  const previewSms = renderTemplate(current.sms_body, vars);
  const previewHtml = wrapEmailHtml(bodyToHtml(previewBody), vars.company_name);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!settings) return;
      await save({
        data: {
          company_name: settings.company_name,
          tagline: settings.tagline,
          support_phone: settings.support_phone,
          support_email: settings.support_email,
          address: settings.address,
          business_hours: settings.business_hours,
          emergency_phone: settings.emergency_phone,
          notify_email_enabled: settings.notify_email_enabled,
          notify_sms_enabled: settings.notify_sms_enabled,
          notify_on_reschedule: settings.notify_on_reschedule,
          notify_on_status_change: settings.notify_on_status_change,
          twilio_from_phone: settings.twilio_from_phone,
          technicians: settings.technicians,
          notification_templates: drafts,
        },
      });
    },
    onSuccess: () => {
      toast.success("Notification templates saved");
      qc.invalidateQueries({ queryKey: ["site-settings-notifications"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save"),
  });

  const resetCurrent = () => {
    setDrafts((d) => ({ ...d, [kind]: { ...DEFAULT_TEMPLATES[kind] } }));
    toast.success(`Reset "${KIND_LABEL[kind]}" to defaults`);
  };

  const isOverridden = (k: NotificationKind) => {
    const stored = settings?.notification_templates?.[k];
    return !!(stored && (stored.email_subject || stored.email_body || stored.sms_body));
  };

  if (isLoading) return <p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Notification templates</h1>
          <p className="text-sm text-muted-foreground">Customize the email and SMS content sent for each booking event.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={resetCurrent}>
            <RotateCcw className="mr-1.5 h-4 w-4" />Reset this event
          </Button>
          <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            <Save className="mr-1.5 h-4 w-4" />{saveMut.isPending ? "Saving…" : "Save all"}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-1.5">
            {NOTIFICATION_KINDS.map((k) => (
              <button key={k} onClick={() => setKind(k)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  kind === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary hover:bg-accent"
                }`}>
                {KIND_LABEL[k]}
                {isOverridden(k) && <Badge variant="secondary" className="h-4 px-1 text-[10px]">custom</Badge>}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4" /> Email
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs font-medium">Subject</label>
                <Input value={current.email_subject} onChange={(e) => setField("email_subject", e.target.value)} maxLength={300} />
              </div>
              <div>
                <label className="text-xs font-medium">Body (plain text — blank lines become paragraphs)</label>
                <Textarea value={current.email_body} onChange={(e) => setField("email_body", e.target.value)}
                  rows={12} maxLength={5000} className="font-mono text-xs" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" /> SMS
                <span className="ml-auto text-xs font-normal text-muted-foreground">{previewSms.length}/480</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={current.sms_body} onChange={(e) => setField("sms_body", e.target.value)}
                rows={4} maxLength={480} className="font-mono text-xs" />
              <p className="text-xs text-muted-foreground">
                SMS is trimmed to 480 characters when sent. Only sent when SMS notifications and Twilio are configured in Site Settings.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Variable helper</CardTitle>
              <p className="text-xs text-muted-foreground">
                Click a placeholder to copy. These are the exact example values used in the previews on the right.
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/60 text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">Placeholder</th>
                      <th className="px-2 py-1.5 text-left font-medium">Example value (used in preview)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TEMPLATE_VARIABLES.map((v) => (
                      <tr key={v} className="border-t border-border/70">
                        <td className="px-2 py-1.5 align-top">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(`{{${v}}}`);
                              toast.success(`Copied {{${v}}}`);
                            }}
                            className="rounded border border-border bg-secondary px-2 py-0.5 font-mono text-[11px] hover:bg-accent"
                            title="Click to copy"
                          >
                            {`{{${v}}}`}
                          </button>
                        </td>
                        <td className="break-all px-2 py-1.5 font-mono text-[11px] text-foreground/90">
                          {(vars as any)[v]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Missing values render as "—" in real messages. <span className="font-medium text-foreground">company_name</span> and{" "}
                <span className="font-medium text-foreground">support_phone</span> come from Site Settings; the rest come from the booking.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Mail className="h-4 w-4" /> Email preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="rounded-md border border-border bg-secondary/40 p-3 text-xs">
                <div className="text-muted-foreground">Subject</div>
                <div className="mt-0.5 font-semibold text-foreground">{previewSubject}</div>
              </div>
              <div className="overflow-hidden rounded-md border border-border bg-white">
                <iframe title="Email preview" srcDoc={previewHtml} className="h-[380px] w-full" sandbox="" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="h-4 w-4" /> SMS preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mx-auto max-w-xs rounded-2xl bg-gradient-to-b from-slate-100 to-slate-200 p-4 shadow-inner dark:from-slate-800 dark:to-slate-900">
                <div className="mb-2 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
                  {vars.company_name}
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-white p-3 text-sm text-slate-900 shadow-sm">
                  {previewSms}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
