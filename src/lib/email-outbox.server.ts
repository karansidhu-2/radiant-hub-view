// Persistent email outbox with retry + exponential backoff.
// Enqueue always succeeds (best-effort insert), then we try to send immediately.
// Failures leave the row pending for the cron drainer to retry.

const LOVABLE_EMAIL_URL = "https://api.lovable.dev/v1/email/send";
const BATCH_SIZE = 25;
// Exponential backoff (minutes): 1, 2, 4, 8, 16, 32, 60, 60...
function backoffMinutes(attempts: number) {
  return Math.min(60, Math.pow(2, Math.max(0, attempts - 1)));
}

type EnqueueInput = {
  to: string;
  subject: string;
  html: string;
  idempotencyKey?: string;
  context?: Record<string, unknown>;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function tryDeliver(row: {
  id: string;
  to_email: string;
  subject: string;
  html: string;
  attempts: number;
  max_attempts: number;
}) {
  const apiKey = process.env.LOVABLE_API_KEY;
  const sb = await admin();
  if (!apiKey) {
    await sb
      .from("email_outbox" as any)
      .update({ last_error: "LOVABLE_API_KEY missing", next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString() })
      .eq("id", row.id);
    return { sent: false, reason: "no_api_key" as const };
  }
  const nextAttempts = row.attempts + 1;
  try {
    const res = await fetch(LOVABLE_EMAIL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ to: row.to_email, subject: row.subject, html: row.html }),
    });
    if (res.ok) {
      await sb
        .from("email_outbox" as any)
        .update({ status: "sent", attempts: nextAttempts, sent_at: new Date().toISOString(), last_error: null })
        .eq("id", row.id);
      return { sent: true as const };
    }
    const text = await res.text().catch(() => "");
    const err = `HTTP ${res.status}: ${text.slice(0, 500)}`;
    const failed = nextAttempts >= row.max_attempts;
    await sb
      .from("email_outbox" as any)
      .update({
        status: failed ? "failed" : "pending",
        attempts: nextAttempts,
        last_error: err,
        next_attempt_at: new Date(Date.now() + backoffMinutes(nextAttempts) * 60_000).toISOString(),
      })
      .eq("id", row.id);
    return { sent: false as const, reason: "api_error", err };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    const failed = nextAttempts >= row.max_attempts;
    await sb
      .from("email_outbox" as any)
      .update({
        status: failed ? "failed" : "pending",
        attempts: nextAttempts,
        last_error: err,
        next_attempt_at: new Date(Date.now() + backoffMinutes(nextAttempts) * 60_000).toISOString(),
      })
      .eq("id", row.id);
    return { sent: false as const, reason: "exception", err };
  }
}

/**
 * Enqueue an email and attempt an immediate send.
 * Never throws — provider failures leave the row pending for retry.
 */
export async function enqueueEmail(input: EnqueueInput): Promise<{ sent: boolean; id?: string; reason?: string }> {
  const sb = await admin();
  const payload = {
    to_email: input.to,
    subject: input.subject,
    html: input.html,
    idempotency_key: input.idempotencyKey ?? null,
    context: input.context ?? null,
  };
  // Upsert on idempotency_key to avoid duplicate rows for the same event
  const { data, error } = await sb
    .from("email_outbox" as any)
    .upsert(payload, { onConflict: "idempotency_key", ignoreDuplicates: false })
    .select("id, to_email, subject, html, attempts, max_attempts, status")
    .single();
  if (error || !data) {
    console.warn("[email-outbox] enqueue failed:", error?.message);
    return { sent: false, reason: "enqueue_failed" };
  }
  const row = data as any;
  if (row.status === "sent") return { sent: true, id: row.id };
  const result = await tryDeliver(row);
  return { sent: result.sent, id: row.id, reason: result.sent ? undefined : (result as any).reason };
}

/** Drain a batch of due pending emails. Called by pg_cron. */
export async function processDueEmails(): Promise<{ processed: number; sent: number; failed: number }> {
  const sb = await admin();
  const { data, error } = await sb
    .from("email_outbox" as any)
    .select("id, to_email, subject, html, attempts, max_attempts")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (error || !data) return { processed: 0, sent: 0, failed: 0 };
  let sent = 0;
  let failed = 0;
  for (const row of data as any[]) {
    const r = await tryDeliver(row);
    if (r.sent) sent++;
    else failed++;
  }
  return { processed: data.length, sent, failed };
}
