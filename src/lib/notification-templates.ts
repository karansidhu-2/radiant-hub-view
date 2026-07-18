// Shared client + server helpers for booking notification templates.
// Admins can override the defaults from /admin/notifications.

export type NotificationKind =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "rescheduled";

export const NOTIFICATION_KINDS: NotificationKind[] = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "rescheduled",
];

export const KIND_LABEL: Record<NotificationKind, string> = {
  pending: "Pending (new booking)",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
};

export type TemplateEntry = {
  email_subject: string;
  email_body: string; // plain text with {{vars}}, newlines become <br/> in email
  sms_body: string;
};

export type NotificationTemplates = Partial<Record<NotificationKind, Partial<TemplateEntry>>>;

export const DEFAULT_TEMPLATES: Record<NotificationKind, TemplateEntry> = {
  pending: {
    email_subject: "Booking received — {{reference}}",
    email_body:
      "Hi {{customer_name}},\n\nThanks for booking {{service_name}} with {{company_name}}. We've received your request and will confirm the appointment shortly.\n\nReference: {{reference}}\nRequested: {{date}} at {{time}}\nAddress: {{address}}\n\nTrack status: {{track_url}}",
    sms_body:
      "{{company_name}}: booking {{reference}} received for {{service_name}} on {{date}} {{time}}. We'll confirm soon.",
  },
  confirmed: {
    email_subject: "Booking confirmed — {{reference}}",
    email_body:
      "Hi {{customer_name}},\n\nGood news — your {{service_name}} appointment is confirmed for {{date}} at {{time}}.\n\nReference: {{reference}}\nAddress: {{address}}\nTechnician: {{technician}}\n\nTrack status: {{track_url}}",
    sms_body:
      "{{company_name}}: {{service_name}} confirmed for {{date}} {{time}}. Ref {{reference}}. Track: {{track_url}}",
  },
  completed: {
    email_subject: "Service completed — {{reference}}",
    email_body:
      "Hi {{customer_name}},\n\nYour {{service_name}} service has been completed. Thank you for choosing {{company_name}}!\n\nReference: {{reference}}\nService charge: {{service_charge}}\n\nWe'd love your feedback — leave a review at {{track_url}}",
    sms_body:
      "{{company_name}}: {{service_name}} completed. Ref {{reference}}. Total {{service_charge}}. Thanks!",
  },
  cancelled: {
    email_subject: "Booking cancelled — {{reference}}",
    email_body:
      "Hi {{customer_name}},\n\nYour {{service_name}} appointment scheduled for {{date}} at {{time}} has been cancelled.\n\nReference: {{reference}}\n\nIf this was unexpected, call us at {{support_phone}}.",
    sms_body:
      "{{company_name}}: booking {{reference}} for {{date}} {{time}} was cancelled. Call {{support_phone}} with questions.",
  },
  rescheduled: {
    email_subject: "Appointment rescheduled — {{reference}}",
    email_body:
      "Hi {{customer_name}},\n\nYour {{service_name}} appointment has been rescheduled to {{date}} at {{time}}.\n\nReference: {{reference}}\nAddress: {{address}}\nTechnician: {{technician}}\n\nTrack status: {{track_url}}",
    sms_body:
      "{{company_name}}: {{service_name}} rescheduled to {{date}} {{time}}. Ref {{reference}}. Track: {{track_url}}",
  },
};

export const TEMPLATE_VARIABLES = [
  "customer_name", "service_name", "reference", "date", "time",
  "address", "technician", "service_charge", "company_name",
  "support_phone", "track_url",
] as const;

export type TemplateVars = Record<(typeof TEMPLATE_VARIABLES)[number], string>;

export function renderTemplate(tpl: string, vars: Partial<TemplateVars>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key) => {
    const v = (vars as any)[key];
    return v == null || v === "" ? "—" : String(v);
  });
}

export function mergedTemplate(
  kind: NotificationKind,
  overrides: NotificationTemplates | null | undefined,
): TemplateEntry {
  const base = DEFAULT_TEMPLATES[kind];
  const o = overrides?.[kind] ?? {};
  return {
    email_subject: (o.email_subject?.trim() || base.email_subject),
    email_body: (o.email_body?.trim() || base.email_body),
    sms_body: (o.sms_body?.trim() || base.sms_body),
  };
}

export function bodyToHtml(text: string): string {
  const esc = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return esc
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.55">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

export function wrapEmailHtml(bodyHtml: string, companyName: string): string {
  return `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Inter,Arial,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    ${bodyHtml}
    <p style="color:#94a3b8;font-size:12px;margin-top:32px">— ${companyName}</p>
  </div></body></html>`;
}

export const SAMPLE_VARS: TemplateVars = {
  customer_name: "Jamie Rivera",
  service_name: "AC Tune-Up",
  reference: "HVAC-8F3D2A",
  date: "2026-08-05",
  time: "10:00 AM",
  address: "742 Evergreen Terrace, Dallas, TX 75201",
  technician: "Alex Morgan",
  service_charge: "$185.00",
  company_name: "HVAC Pro",
  support_phone: "(800) 555-0199",
  track_url: "https://example.com/confirmation/booking/HVAC-8F3D2A",
};
