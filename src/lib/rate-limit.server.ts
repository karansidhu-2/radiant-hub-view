import { getRequestHeader } from "@tanstack/react-start/server";

/**
 * Per-key sliding-window rate limit backed by the DB.
 * Throws a user-friendly Error when exceeded.
 */
export async function rateLimit(
  bucket: string,
  opts: { max: number; windowSeconds: number; extra?: string; actorUserId?: string | null },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ip =
    getRequestHeader("cf-connecting-ip") ||
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const key = `${bucket}:${ip}${opts.extra ? `:${opts.extra}` : ""}`;
  const { data, error } = await supabaseAdmin.rpc("check_and_hit_rate_limit", {
    _key: key,
    _max: opts.max,
    _window_seconds: opts.windowSeconds,
  });
  if (error) return; // fail-open on infra hiccup rather than blocking real users
  if (data === false) {
    // Structured audit: rate-limit denial (safe metadata only — bucket + limits,
    // never raw IP or client-supplied fields).
    try {
      const { logRpcAudit } = await import("./rpc-audit.server");
      await logRpcAudit({
        event: `rateLimit.denied`,
        outcome: "denied",
        reason: "rate_limit_exceeded",
        entity_type: "rate_limit",
        entity_id: bucket,
        actor_user_id: opts.actorUserId ?? null,
        metadata: { bucket, max: opts.max, window_seconds: opts.windowSeconds },
      });
    } catch { /* never block on audit */ }
    throw new Error("Too many requests. Please wait a moment and try again.");
  }
}

