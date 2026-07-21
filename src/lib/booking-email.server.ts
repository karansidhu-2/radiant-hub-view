// Server-only helpers to notify customers about booking changes via email + SMS.
// Silently no-ops when the corresponding channel/provider is not configured.

import {
  DEFAULT_TEMPLATES,
  bodyToHtml,
  mergedTemplate,
  renderTemplate,
  wrapEmailHtml,
  type NotificationKind,
  type NotificationTemplates,
  type TemplateVars,
} from "@/lib/notification-templates";

type BookingRow = {
  id: string;
  reference: string;
  email: string;
  phone?: string | null;
  customer_phone_notify?: string | null;
  full_name: string;
  service_name: string;
  scheduled_date: string;
  scheduled_hour: number;
  street: string;
  city: string;
  state: string;
  zip: string;
  service_charge?: number | null;
  technician?: string | null;
};

export type BookingEventKind = NotificationKind;

type Settings = {
  company_name: string;
  support_phone: string;
  notify_email_enabled: boolean;
  notify_sms_enabled: boolean;
  notify_on_reschedule: boolean;
  notify_on_status_change: boolean;
  twilio_from_phone: string;
  notification_templates: NotificationTemplates;
  origin: string;
};

async function loadSettings(): Promise<Settings> {
  const fallback: Settings = {
    company_name: "HVAC Pro",
    support_phone: "",
    notify_email_enabled: true,
    notify_sms_enabled: false,
    notify_on_reschedule: true,
    notify_on_status_change: true,
    twilio_from_phone: "",
    notification_templates: {},
    origin: process.env.PUBLIC_APP_URL || "",
  };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("site_settings")
      .select(
        "company_name, support_phone, notify_email_enabled, notify_sms_enabled, notify_on_reschedule, notify_on_status_change, twilio_from_phone, notification_templates",
      )
      .limit(1)
      .maybeSingle();
    if (data) return { ...fallback, ...(data as any) } as Settings;
  } catch {}
  return fallback;
}

function timeLabel(hour: number) {
  return `${((hour + 11) % 12) + 1}:00 ${hour < 12 ? "AM" : "PM"}`;
}

function buildVars(b: BookingRow, s: Settings): TemplateVars {
  return {
    customer_name: b.full_name,
    service_name: b.service_name,
    reference: b.reference,
    date: b.scheduled_date,
    time: timeLabel(b.scheduled_hour),
    address: `${b.street}, ${b.city}, ${b.state} ${b.zip}`,
    technician: b.technician || "To be assigned",
    service_charge: b.service_charge != null ? `$${Number(b.service_charge).toFixed(2)}` : "—",
    company_name: s.company_name,
    support_phone: s.support_phone,
    track_url: `${s.origin || ""}/confirmation/booking/${b.reference}`,
  };
}

async function sendEmail(b: BookingRow, kind: BookingEventKind, _s: Settings) {
  const tpl = mergedTemplate(kind, _s.notification_templates);
  const vars = buildVars(b, _s);
  const subject = renderTemplate(tpl.email_subject, vars);
  const bodyText = renderTemplate(tpl.email_body, vars);
  const html = wrapEmailHtml(bodyToHtml(bodyText), _s.company_name);
  try {
    const { enqueueEmail } = await import("@/lib/email-outbox.server");
    const r = await enqueueEmail({
      to: b.email,
      subject,
      html,
      idempotencyKey: `booking:${b.id}:${kind}`,
      context: { booking_id: b.id, reference: b.reference, kind },
    });
    return r.sent
      ? { sent: true as const }
      : { sent: false as const, reason: "queued_retry" as const };
  } catch (err) {
    console.warn("email enqueue threw:", err);
    return { sent: false, reason: "exception" as const };
  }
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits.length >= 8 ? `+${digits}` : null;
}

async function sendSms(b: BookingRow, kind: BookingEventKind, s: Settings) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const twilioKey = process.env.TWILIO_API_KEY;
  if (!lovableKey || !twilioKey) return { sent: false, reason: "not_configured" as const };
  if (!s.twilio_from_phone) return { sent: false, reason: "no_from_phone" as const };
  const to = normalizePhone(b.customer_phone_notify || b.phone);
  if (!to) return { sent: false, reason: "no_recipient" as const };
  const tpl = mergedTemplate(kind, s.notification_templates);
  const vars = buildVars(b, s);
  const body = renderTemplate(tpl.sms_body, vars);
  try {
    const res = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": twilioKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: s.twilio_from_phone, Body: body.slice(0, 480) }),
    });
    if (!res.ok) {
      console.warn("sms send failed:", res.status, await res.text());
      return { sent: false, reason: "api_error" as const };
    }
    return { sent: true as const };
  } catch (err) {
    console.warn("sms send threw:", err);
    return { sent: false, reason: "exception" as const };
  }
}

export async function notifyBookingEvent(booking: BookingRow, kind: BookingEventKind) {
  const s = await loadSettings();
  const isReschedule = kind === "rescheduled";
  if (isReschedule && !s.notify_on_reschedule) return { skipped: true as const };
  if (!isReschedule && !s.notify_on_status_change) return { skipped: true as const };
  const results: Record<string, unknown> = {};
  if (s.notify_email_enabled) results.email = await sendEmail(booking, kind, s);
  if (s.notify_sms_enabled) results.sms = await sendSms(booking, kind, s);
  return results;
}

export async function sendBookingStatusEmail(
  booking: BookingRow,
  status: "confirmed" | "completed",
) {
  return notifyBookingEvent(booking, status);
}

// Kept as an export to make tree-shaking obvious across imports.
export { DEFAULT_TEMPLATES };
