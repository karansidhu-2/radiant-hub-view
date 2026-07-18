// Server-only helpers to notify customers about booking changes via email + SMS.
// Silently no-ops when the corresponding channel/provider is not configured.

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

export type BookingEventKind =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "rescheduled";

type Settings = {
  company_name: string;
  support_phone: string;
  notify_email_enabled: boolean;
  notify_sms_enabled: boolean;
  notify_on_reschedule: boolean;
  notify_on_status_change: boolean;
  twilio_from_phone: string;
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
  };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("site_settings")
      .select(
        "company_name, support_phone, notify_email_enabled, notify_sms_enabled, notify_on_reschedule, notify_on_status_change, twilio_from_phone",
      )
      .limit(1)
      .maybeSingle();
    if (data) return { ...fallback, ...data } as Settings;
  } catch {}
  return fallback;
}

function timeLabel(hour: number) {
  return `${((hour + 11) % 12) + 1}:00 ${hour < 12 ? "AM" : "PM"}`;
}

function copyFor(kind: BookingEventKind, b: BookingRow, siteName: string) {
  const when = `${b.scheduled_date} at ${timeLabel(b.scheduled_hour)}`;
  switch (kind) {
    case "pending":
      return {
        subject: `Booking received — ${b.reference}`,
        intro: `Thanks ${b.full_name}, we've received your request for ${b.service_name}. We'll confirm your appointment shortly.`,
      };
    case "confirmed":
      return {
        subject: `Booking confirmed — ${b.reference}`,
        intro: `Good news — your ${b.service_name} appointment is confirmed for ${when}.`,
      };
    case "completed":
      return {
        subject: `Service completed — ${b.reference}`,
        intro: `Your ${b.service_name} service has been completed. Thank you for choosing ${siteName}!`,
      };
    case "cancelled":
      return {
        subject: `Booking cancelled — ${b.reference}`,
        intro: `Your ${b.service_name} appointment scheduled for ${when} has been cancelled. Please reach out if this was unexpected.`,
      };
    case "rescheduled":
      return {
        subject: `Appointment rescheduled — ${b.reference}`,
        intro: `Your ${b.service_name} appointment has been rescheduled to ${when}.`,
      };
  }
}

async function sendEmail(b: BookingRow, kind: BookingEventKind, s: Settings) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { sent: false, reason: "no_api_key" as const };
  const { subject, intro } = copyFor(kind, b, s.company_name);
  const address = `${b.street}, ${b.city}, ${b.state} ${b.zip}`;
  const trackUrl = `/confirmation/booking/${b.reference}`;
  const chargeLine =
    kind === "completed" && b.service_charge != null
      ? `<tr><td style="padding:6px 0;color:#64748b">Service charge</td><td style="padding:6px 0;text-align:right;font-weight:600">$${Number(b.service_charge).toFixed(2)}</td></tr>`
      : "";
  const techLine = b.technician
    ? `<tr><td style="color:#64748b">Technician</td><td style="text-align:right;font-weight:600">${b.technician}</td></tr>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Inter,Arial,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:22px;margin:0 0 8px">${subject}</h1>
    <p style="color:#475569;margin:0 0 20px">Hi ${b.full_name}, ${intro}</p>
    <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;padding:16px" cellpadding="12">
      <tr><td style="color:#64748b">Reference</td><td style="text-align:right;font-weight:600">${b.reference}</td></tr>
      <tr><td style="color:#64748b">Service</td><td style="text-align:right;font-weight:600">${b.service_name}</td></tr>
      <tr><td style="color:#64748b">When</td><td style="text-align:right;font-weight:600">${b.scheduled_date} • ${timeLabel(b.scheduled_hour)}</td></tr>
      <tr><td style="color:#64748b">Address</td><td style="text-align:right">${address}</td></tr>
      ${techLine}
      ${chargeLine}
    </table>
    <p style="margin:24px 0 8px">Track status: <a href="${trackUrl}">${trackUrl}</a></p>
    ${s.support_phone ? `<p style="color:#475569">Questions? Call us at ${s.support_phone}.</p>` : ""}
    <p style="color:#94a3b8;font-size:12px;margin-top:32px">— ${s.company_name}</p>
  </div></body></html>`;
  try {
    const res = await fetch("https://api.lovable.dev/v1/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ to: b.email, subject, html }),
    });
    if (!res.ok) {
      console.warn("email send failed:", res.status, await res.text());
      return { sent: false, reason: "api_error" as const };
    }
    return { sent: true as const };
  } catch (err) {
    console.warn("email send threw:", err);
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
  const { subject, intro } = copyFor(kind, b, s.company_name);
  const body = `${s.company_name}: ${subject}. ${intro} Track: /confirmation/booking/${b.reference}`;
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

// Back-compat wrapper used by earlier code paths.
export async function sendBookingStatusEmail(
  booking: BookingRow,
  status: "confirmed" | "completed",
) {
  return notifyBookingEvent(booking, status);
}
