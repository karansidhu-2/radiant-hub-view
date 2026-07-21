/**
 * Review request queue — schedules a delayed SMS after job completion asking
 * the customer to leave a Google review, then drains the queue via a cron
 * endpoint that sends through the Twilio connector gateway.
 *
 * Server-only. Never import from client code.
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

type Settings = {
  company_name: string | null;
  review_request_enabled: boolean;
  review_request_delay_hours: number;
  google_review_url: string | null;
  review_request_sms_template: string;
  notify_sms_enabled: boolean;
  twilio_from_phone: string | null;
};

function renderTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

/**
 * Enqueue a review-request SMS for a completed booking.
 * Idempotent — the unique (booking_id) constraint prevents duplicates.
 */
export async function enqueueReviewRequest(
  supabaseAdmin: any,
  booking: {
    id: string;
    reference: string;
    full_name: string;
    phone: string;
    customer_phone_notify?: string | null;
  },
): Promise<{ ok: boolean; reason?: string }> {
  const { data: s } = await supabaseAdmin
    .from("site_settings")
    .select(
      "company_name, review_request_enabled, review_request_delay_hours, google_review_url, review_request_sms_template",
    )
    .eq("singleton", true)
    .maybeSingle();
  const settings = (s ?? {}) as Partial<Settings>;

  if (!settings.review_request_enabled) return { ok: false, reason: "disabled" };
  if (!settings.google_review_url) return { ok: false, reason: "no_review_url" };

  const phone = (booking.customer_phone_notify || booking.phone || "").trim();
  if (!phone) return { ok: false, reason: "no_phone" };

  const tpl =
    settings.review_request_sms_template ||
    "Hi {{name}}, thanks for choosing {{company}}! Leave us a Google review: {{review_url}}";
  const message = renderTemplate(tpl, {
    name: booking.full_name?.split(" ")[0] || "there",
    company: settings.company_name || "our team",
    review_url: settings.google_review_url,
    reference: booking.reference,
  }).slice(0, 480);

  const delayHours = Math.max(0, Math.min(168, Number(settings.review_request_delay_hours ?? 2)));
  const sendAfter = new Date(Date.now() + delayHours * 3600_000).toISOString();

  const { error } = await supabaseAdmin.from("review_request_queue").upsert(
    {
      booking_id: booking.id,
      reference: booking.reference,
      phone,
      message,
      send_after: sendAfter,
      status: "pending",
      attempts: 0,
      last_error: null,
    },
    { onConflict: "booking_id", ignoreDuplicates: false },
  );
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

function toE164(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits.length >= 8 ? digits : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

async function sendTwilioSms(to: string, from: string, body: string): Promise<{ sid: string }> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const TWILIO_API_KEY = process.env.TWILIO_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
  if (!TWILIO_API_KEY) throw new Error("Twilio connector not linked (TWILIO_API_KEY missing)");

  const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TWILIO_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Twilio ${res.status}: ${txt.slice(0, 400)}`);
  }
  const json: any = await res.json();
  return { sid: json.sid };
}

/**
 * Process pending review requests whose send_after has passed.
 * Called by the cron endpoint.
 */
export async function processReviewRequestQueue(
  supabaseAdmin: any,
  limit = 25,
): Promise<{ processed: number; sent: number; failed: number; skipped: number }> {
  const { data: settings } = await supabaseAdmin
    .from("site_settings")
    .select("notify_sms_enabled, twilio_from_phone")
    .eq("singleton", true)
    .maybeSingle();

  if (!settings?.notify_sms_enabled || !settings?.twilio_from_phone) {
    return { processed: 0, sent: 0, failed: 0, skipped: 0 };
  }
  const from = toE164(String(settings.twilio_from_phone));
  if (!from) return { processed: 0, sent: 0, failed: 0, skipped: 0 };

  const { data: rows } = await supabaseAdmin
    .from("review_request_queue")
    .select("id, phone, message, attempts")
    .eq("status", "pending")
    .lte("send_after", new Date().toISOString())
    .order("send_after", { ascending: true })
    .limit(limit);

  const items = (rows ?? []) as Array<{ id: string; phone: string; message: string; attempts: number }>;
  let sent = 0, failed = 0, skipped = 0;

  for (const r of items) {
    const to = toE164(r.phone);
    if (!to) {
      skipped++;
      await supabaseAdmin
        .from("review_request_queue")
        .update({ status: "failed", last_error: "invalid phone" })
        .eq("id", r.id);
      continue;
    }
    try {
      const { sid } = await sendTwilioSms(to, from, r.message);
      sent++;
      await supabaseAdmin
        .from("review_request_queue")
        .update({ status: "sent", sent_at: new Date().toISOString(), provider_sid: sid, last_error: null })
        .eq("id", r.id);
    } catch (e: any) {
      failed++;
      const attempts = (r.attempts ?? 0) + 1;
      // Give up after 5 attempts to avoid infinite retries; otherwise stay pending.
      const status = attempts >= 5 ? "failed" : "pending";
      await supabaseAdmin
        .from("review_request_queue")
        .update({ attempts, last_error: String(e?.message ?? e).slice(0, 500), status })
        .eq("id", r.id);
    }
  }
  return { processed: items.length, sent, failed, skipped };
}
