// Server-only helper for recording admin actions to admin_actions.
// Never imported by browser code (filename ends in .server.ts).

type Ctx = {
  userId?: string | null;
  claims?: { email?: string | null } | null;
};

export async function logAdminAction(
  context: Ctx,
  entry: {
    action: string;
    entity_type: string;
    entity_id?: string | null;
    before?: unknown;
    after?: unknown;
    details?: Record<string, unknown>;
  },
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("admin_actions").insert({
      admin_id: context.userId ?? null,
      admin_email: context.claims?.email ?? null,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id ? String(entry.entity_id).slice(0, 120) : null,
      before: entry.before ?? null,
      after: entry.after ?? null,
      details: entry.details ?? null,
    });
  } catch (e) {
    console.error("[audit] failed to log admin action", e);
  }
}

/** Shallow diff — returns only changed keys' before/after values. */
export function diffShallow<T extends Record<string, any>>(
  before: T | null | undefined,
  after: T | null | undefined,
): { before: Partial<T>; after: Partial<T> } {
  const b: any = {}, a: any = {};
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);
  for (const k of keys) {
    const bv = (before as any)?.[k];
    const av = (after as any)?.[k];
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      b[k] = bv ?? null;
      a[k] = av ?? null;
    }
  }
  return { before: b, after: a };
}
