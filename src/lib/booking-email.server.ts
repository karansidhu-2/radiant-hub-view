// Server-only helper to send booking status emails via Lovable's email API.
// Silently no-ops when email is not yet configured (missing domain/API key or 4xx from API).

type BookingRow = {
  id: string;
  reference: string;
  email: string;
  full_name: string;
  service_name: string;
  scheduled_date: string;
  scheduled_hour: number;
  street: string;
  city: string;
  state: string;
  zip: string;
  service_charge?: number | null;
};

export async function sendBookingStatusEmail(
  booking: BookingRow,
  status: "confirmed" | "completed",
) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { sent: false, reason: "no_api_key" as const };

  // Pull site settings for branding + support contact
  let siteName = "HVAC Pro";
  let supportPhone = "";
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("site_settings")
      .select("company_name, support_phone")
      .limit(1)
      .maybeSingle();
    if (data) {
      siteName = data.company_name ?? siteName;
      supportPhone = data.support_phone ?? "";
    }
  } catch {}

  const hour = booking.scheduled_hour;
  const timeLabel = `${((hour + 11) % 12) + 1}:00 ${hour < 12 ? "AM" : "PM"}`;
  const address = `${booking.street}, ${booking.city}, ${booking.state} ${booking.zip}`;
  const trackUrl = `/confirmation/booking/${booking.reference}`;

  const isConfirmed = status === "confirmed";
  const subject = isConfirmed
    ? `Booking confirmed — ${booking.reference}`
    : `Service completed — ${booking.reference}`;

  const chargeLine =
    !isConfirmed && booking.service_charge != null
      ? `<tr><td style="padding:6px 0;color:#64748b">Service charge</td><td style="padding:6px 0;text-align:right;font-weight:600">$${Number(booking.service_charge).toFixed(2)}</td></tr>`
      : "";

  const intro = isConfirmed
    ? `Good news — your ${booking.service_name} appointment is confirmed. Our technician is scheduled to arrive at the time below.`
    : `Your ${booking.service_name} service has been completed. Thank you for choosing ${siteName}!`;

  const html = `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Inter,Arial,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:22px;margin:0 0 8px">${subject}</h1>
    <p style="color:#475569;margin:0 0 20px">Hi ${booking.full_name}, ${intro}</p>
    <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;padding:16px" cellpadding="12">
      <tr><td style="color:#64748b">Reference</td><td style="text-align:right;font-weight:600">${booking.reference}</td></tr>
      <tr><td style="color:#64748b">Service</td><td style="text-align:right;font-weight:600">${booking.service_name}</td></tr>
      <tr><td style="color:#64748b">When</td><td style="text-align:right;font-weight:600">${booking.scheduled_date} • ${timeLabel}</td></tr>
      <tr><td style="color:#64748b">Address</td><td style="text-align:right">${address}</td></tr>
      ${chargeLine}
    </table>
    <p style="margin:24px 0 8px">Track status: <a href="${trackUrl}">${trackUrl}</a></p>
    ${supportPhone ? `<p style="color:#475569">Questions? Call us at ${supportPhone}.</p>` : ""}
    <p style="color:#94a3b8;font-size:12px;margin-top:32px">— ${siteName}</p>
  </div></body></html>`;

  try {
    const res = await fetch("https://api.lovable.dev/v1/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        to: booking.email,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn("Lovable email send failed:", res.status, text);
      return { sent: false, reason: "api_error" as const };
    }
    return { sent: true as const };
  } catch (err) {
    console.warn("Lovable email send threw:", err);
    return { sent: false, reason: "exception" as const };
  }
}
