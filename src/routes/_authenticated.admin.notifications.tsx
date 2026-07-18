import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminUpdateSiteSettings } from "@/lib/hvac.functions";
import {
  KIND_LABEL, NOTIFICATION_KINDS, SAMPLE_VARS,
  bodyToHtml, compileComposer, defaultComposer, mergedTemplate,
  renderTemplate, wrapEmailHtml,
  type ComposerState, type NotificationKind, type NotificationTemplates,
} from "@/lib/notification-templates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { RotateCcw, Save, Mail, MessageSquare, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  component: NotificationsPage,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

type SettingsRow = {
  company_name: string; support_phone: string; tagline: string; support_email: string;
  address: string; business_hours: string; emergency_phone: string;
  notify_email_enabled: boolean; notify_sms_enabled: boolean;
  notify_on_reschedule: boolean; notify_on_status_change: boolean;
  twilio_from_phone: string; technicians: string[];
  notification_templates: NotificationTemplates | null;
};

type DetailKey = keyof ComposerState["include"];
const DETAIL_OPTIONS: { key: DetailKey; label: string; hint: string }[] = [
  { key: "reference", label: "Booking reference number", hint: "e.g. HVAC-8F3D2A" },
  { key: "dateTime", label: "Appointment date & time", hint: "Auto-filled from the booking" },
  { key: "address", label: "Service address", hint: "The customer's saved address" },
  { key: "technician", label: "Assigned technician", hint: "The crew member on the job" },
  { key: "serviceCharge", label: "Service charge / total", hint: "Only useful for completed jobs" },
  { key: "trackLink", label: "Live tracking link", hint: "Deep link to the booking page" },
  { key: "supportPhone", label: "Support phone number", hint: "From site settings" },
];

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
  const [drafts, setDrafts] = useState<Record<NotificationKind, ComposerState>>(() =>
    NOTIFICATION_KINDS.reduce((acc, k) => { acc[k] = defaultComposer(k); return acc; }, {} as Record<NotificationKind, ComposerState>),
  );
  const [initialized, setInitialized] = useState(false);

  if (settings && !initialized) {
    const seeded = NOTIFICATION_KINDS.reduce((acc, k) => {
      const stored = settings.notification_templates?.[k]?.composer as ComposerState | undefined;
      acc[k] = stored ? { ...defaultComposer(k), ...stored, include: { ...defaultComposer(k).include, ...(stored.include || {}) }, sms: { ...defaultComposer(k).sms, ...(stored.sms || {}) } } : defaultComposer(k);
      return acc;
    }, {} as Record<NotificationKind, ComposerState>);
    setDrafts(seeded);
    setInitialized(true);
  }

  const current = drafts[kind];
  const patch = (u: Partial<ComposerState>) =>
    setDrafts((d) => ({ ...d, [kind]: { ...d[kind], ...u } }));
  const patchInclude = (key: DetailKey, v: boolean) =>
    setDrafts((d) => ({ ...d, [kind]: { ...d[kind], include: { ...d[kind].include, [key]: v } } }));
  const patchSms = (u: Partial<ComposerState["sms"]>) =>
    setDrafts((d) => ({ ...d, [kind]: { ...d[kind], sms: { ...d[kind].sms, ...u } } }));

  // Compile all drafts so previews and save use the same output.
  const compiled = useMemo(() =>
    NOTIFICATION_KINDS.reduce((acc, k) => { acc[k] = compileComposer(k, drafts[k]); return acc; }, {} as Record<NotificationKind, ReturnType<typeof compileComposer>>),
    [drafts]);

  const vars = useMemo(() => ({
    ...SAMPLE_VARS,
    company_name: settings?.company_name || SAMPLE_VARS.company_name,
    support_phone: settings?.support_phone || SAMPLE_VARS.support_phone,
  }), [settings]);

  const previewSubject = renderTemplate(compiled[kind].email_subject, vars);
  const previewBody = renderTemplate(compiled[kind].email_body, vars);
  const previewSms = renderTemplate(compiled[kind].sms_body, vars);
  const previewHtml = wrapEmailHtml(bodyToHtml(previewBody), vars.company_name);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!settings) return;
      const nt: NotificationTemplates = NOTIFICATION_KINDS.reduce((acc, k) => {
        acc[k] = { ...compiled[k], composer: drafts[k] };
        return acc;
      }, {} as NotificationTemplates);
      await save({
        data: {
          company_name: settings.company_name, tagline: settings.tagline,
          support_phone: settings.support_phone, support_email: settings.support_email,
          address: settings.address, business_hours: settings.business_hours,
          emergency_phone: settings.emergency_phone,
          notify_email_enabled: settings.notify_email_enabled,
          notify_sms_enabled: settings.notify_sms_enabled,
          notify_on_reschedule: settings.notify_on_reschedule,
          notify_on_status_change: settings.notify_on_status_change,
          twilio_from_phone: settings.twilio_from_phone,
          technicians: settings.technicians,
          notification_templates: nt,
        },
      });
    },
    onSuccess: () => {
      toast.success("Templates saved — new bookings will use these messages");
      qc.invalidateQueries({ queryKey: ["site-settings-notifications"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save"),
  });

  const resetCurrent = () => {
    setDrafts((d) => ({ ...d, [kind]: defaultComposer(kind) }));
    toast.success(`Reset "${KIND_LABEL[kind]}" to defaults`);
  };

  const isOverridden = (k: NotificationKind) => !!settings?.notification_templates?.[k]?.composer;

  if (isLoading) return <p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Notification templates</h1>
          <p className="text-sm text-muted-foreground">
            Write your message like a normal email. Customer name, appointment time and other details are auto-filled — just tick what you want included.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={resetCurrent}>
            <RotateCcw className="mr-1.5 h-4 w-4" />Reset this event
          </Button>
          <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            <Save className="mr-1.5 h-4 w-4" />{saveMut.isPending ? "Saving…" : "Approve & save"}
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
        {/* -------- Editor -------- */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4" /> Email message
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium">Subject line</label>
                <div className="mt-1 flex items-center gap-2">
                  <Switch checked={current.subjectMode === "custom"}
                    onCheckedChange={(v) => patch({ subjectMode: v ? "custom" : "auto" })} />
                  <span className="text-xs text-muted-foreground">
                    {current.subjectMode === "custom" ? "Custom subject" : "Use the default subject"}
                  </span>
                </div>
                {current.subjectMode === "custom" && (
                  <Input className="mt-2" value={current.subject}
                    onChange={(e) => patch({ subject: e.target.value })}
                    placeholder="e.g. Your appointment is confirmed" maxLength={200} />
                )}
              </div>

              <div>
                <label className="text-xs font-medium">Greeting</label>
                <Input className="mt-1" value={current.greeting}
                  onChange={(e) => patch({ greeting: e.target.value })}
                  placeholder="Hi {name}," maxLength={120} />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Tip: type <code className="rounded bg-secondary px-1">{"{name}"}</code> to auto-fill the customer's name.
                </p>
              </div>

              <div>
                <label className="text-xs font-medium">Your message</label>
                <Textarea className="mt-1" rows={5} value={current.message}
                  onChange={(e) => patch({ message: e.target.value })}
                  placeholder="Write a short, friendly message…" maxLength={1500} />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Optional shortcuts: <code className="rounded bg-secondary px-1">{"{service}"}</code>,{" "}
                  <code className="rounded bg-secondary px-1">{"{company}"}</code>. Leave them out to keep it plain text.
                </p>
              </div>

              <div>
                <label className="text-xs font-medium">Signature</label>
                <Input className="mt-1" value={current.signature}
                  onChange={(e) => patch({ signature: e.target.value })}
                  placeholder="— {company}" maxLength={200} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4" /> Auto-fill booking details
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                We add these to the email automatically — just tick what to include. Nothing to copy or code to write.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {DETAIL_OPTIONS.map((opt) => (
                  <label key={opt.key} className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-background p-2 hover:bg-accent/40">
                    <Checkbox checked={!!current.include[opt.key]}
                      onCheckedChange={(v) => patchInclude(opt.key, v === true)} />
                    <span className="text-xs">
                      <span className="font-medium text-foreground">{opt.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{opt.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" /> SMS message
                <span className="ml-auto text-xs font-normal text-muted-foreground">{previewSms.length}/480</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea rows={3} value={current.sms.message}
                onChange={(e) => patchSms({ message: e.target.value })}
                placeholder="Short text message…" maxLength={300} />
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox checked={!!current.sms.includeDateTime}
                    onCheckedChange={(v) => patchSms({ includeDateTime: v === true })} />
                  Add date &amp; time
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox checked={!!current.sms.includeReference}
                    onCheckedChange={(v) => patchSms({ includeReference: v === true })} />
                  Add reference
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox checked={!!current.sms.includeTrackLink}
                    onCheckedChange={(v) => patchSms({ includeTrackLink: v === true })} />
                  Add tracking link
                </label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Only sent when SMS notifications and Twilio are configured in Site Settings. Trimmed to 480 characters.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* -------- Preview -------- */}
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4" /> Email preview
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Preview uses sample customer details. Real emails auto-fill with the actual booking.
              </p>
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
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" /> SMS preview
              </CardTitle>
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

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Auto-filled sample values</CardTitle>
              <p className="text-xs text-muted-foreground">
                What the placeholders in the preview stand for. Real messages use the customer's own info.
              </p>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Customer name</dt><dd>{vars.customer_name}</dd>
                <dt className="text-muted-foreground">Service</dt><dd>{vars.service_name}</dd>
                <dt className="text-muted-foreground">Reference</dt><dd>{vars.reference}</dd>
                <dt className="text-muted-foreground">Date &amp; time</dt><dd>{vars.date} at {vars.time}</dd>
                <dt className="text-muted-foreground">Address</dt><dd>{vars.address}</dd>
                <dt className="text-muted-foreground">Technician</dt><dd>{vars.technician}</dd>
                <dt className="text-muted-foreground">Company</dt><dd>{vars.company_name}</dd>
                <dt className="text-muted-foreground">Support phone</dt><dd>{vars.support_phone}</dd>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
