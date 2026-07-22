// Server-only helper to derive invoice status from the email_outbox queue.
// Invoice rows are enqueued with context = { reference, kind: "invoice", ... }.
// "generated" = an invoice email was enqueued for that reference.
// "sent"      = at least one enqueued invoice email has status === "sent".

import type { SupabaseClient } from "@supabase/supabase-js";

export type InvoiceStatus = { generated: boolean; sent: boolean };

const EMPTY: InvoiceStatus = { generated: false, sent: false };

export async function fetchInvoiceStatuses(
  admin: SupabaseClient<any>,
  references: string[],
): Promise<Record<string, InvoiceStatus>> {
  const refs = Array.from(new Set(references.filter((r): r is string => !!r)));
  if (refs.length === 0) return {};
  const { data, error } = await admin
    .from("email_outbox")
    .select("status, context")
    .contains("context", { kind: "invoice" })
    .in("context->>reference", refs);
  if (error || !data) return {};
  const map: Record<string, InvoiceStatus> = {};
  for (const row of data as Array<{ status: string; context: any }>) {
    const ref = row?.context?.reference;
    if (!ref || !refs.includes(ref)) continue;
    const cur = map[ref] ?? { generated: false, sent: false };
    cur.generated = true;
    if (row.status === "sent") cur.sent = true;
    map[ref] = cur;
  }
  for (const r of refs) if (!map[r]) map[r] = { ...EMPTY };
  return map;
}

export async function fetchInvoiceStatus(
  admin: SupabaseClient<any>,
  reference: string | null | undefined,
): Promise<InvoiceStatus> {
  if (!reference) return { ...EMPTY };
  const m = await fetchInvoiceStatuses(admin, [reference]);
  return m[reference] ?? { ...EMPTY };
}
