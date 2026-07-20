// Server-only audit logger for RPC / server-function events (orders, bookings,
// rate limiting). Records the caller's role & user id and safe non-sensitive
// metadata only. Never store: emails, phones, addresses, full names, raw IPs,
// or any client-supplied prices.

import { getRequestHeader } from "@tanstack/react-start/server";
import { createHash } from "node:crypto";

export type ActorRole = "anon" | "authenticated" | "admin" | "service_role";
export type AuditOutcome = "success" | "denied" | "error";

export interface AuditEntry {
  event: string;                          // e.g. "createOrder.success"
  outcome?: AuditOutcome;
  reason?: string | null;
  entity_type?: "order" | "booking" | "rate_limit" | string | null;
  entity_id?: string | null;
  actor_user_id?: string | null;
  actor_role?: ActorRole;
  metadata?: Record<string, unknown>;
}

/** SHA-256(ip + rotating daily salt). Prevents raw-IP storage while keeping
 * one-day correlation for abuse investigations. */
function hashIp(): string | null {
  const ip =
    getRequestHeader("cf-connecting-ip") ||
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
    null;
  if (!ip) return null;
  const daySalt = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(`${ip}|${daySalt}`).digest("hex").slice(0, 32);
}

/** Strip anything that looks sensitive from metadata before storage. */
const SENSITIVE_KEYS = new Set([
  "email", "phone", "phone_number", "street", "address", "address_line",
  "city", "state", "zip", "postal_code", "full_name", "name",
  "unit_price", "price", "installation_fee", "subtotal", "notes",
  "ip", "authorization", "cookie", "token", "password", "session",
]);
function sanitize(input: unknown, depth = 0): unknown {
  if (input == null || depth > 4) return input;
  if (Array.isArray(input)) return input.slice(0, 50).map((v) => sanitize(v, depth + 1));
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) continue;
      out[k] = sanitize(v, depth + 1);
    }
    return out;
  }
  if (typeof input === "string" && input.length > 200) return input.slice(0, 200) + "…";
  return input;
}

/**
 * Fire-and-forget audit write. Never throws — auditing must not block the
 * user-facing request or leak infra hiccups.
 */
export async function logRpcAudit(entry: AuditEntry): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("rpc_audit_log").insert({
      event: entry.event.slice(0, 80),
      outcome: entry.outcome ?? "success",
      reason: entry.reason ? String(entry.reason).slice(0, 200) : null,
      actor_role: entry.actor_role ?? (entry.actor_user_id ? "authenticated" : "anon"),
      actor_user_id: entry.actor_user_id ?? null,
      ip_hash: hashIp(),
      entity_type: entry.entity_type ?? null,
      entity_id: entry.entity_id ? String(entry.entity_id).slice(0, 120) : null,
      metadata: sanitize(entry.metadata ?? {}) as any,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[rpc-audit] insert failed", e);
  }
}
