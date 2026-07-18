import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---------- ZIP / availability ----------
export const checkZip = createServerFn({ method: "POST" })
  .inputValidator((d: { zip: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const zip = (data.zip || "").trim();
    if (!/^\d{5}$/.test(zip)) return { available: false, reason: "invalid" as const };
    const { data: rows } = await supabaseAdmin
      .from("service_areas")
      .select("zip, city, state, active")
      .eq("zip", zip)
      .eq("active", true)
      .maybeSingle();
    if (!rows) return { available: false as const, reason: "not_covered" as const };
    return { available: true as const, city: rows.city, state: rows.state };
  });

// ---------- Booked slots for a date ----------
export const getBookedSlots = createServerFn({ method: "POST" })
  .inputValidator((d: { date: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: rows }, { data: settings }] = await Promise.all([
      supabaseAdmin
        .from("bookings")
        .select("scheduled_hour")
        .eq("scheduled_date", data.date)
        .neq("status", "cancelled"),
      supabaseAdmin
        .from("site_settings")
        .select("crew_capacity_enabled, crew_capacity")
        .eq("singleton", true)
        .maybeSingle(),
    ]);
    const capacity = settings?.crew_capacity_enabled ? Math.max(1, settings.crew_capacity ?? 1) : 1;
    const counts: Record<number, number> = {};
    for (const r of rows ?? []) counts[r.scheduled_hour] = (counts[r.scheduled_hour] ?? 0) + 1;
    const hours = Object.entries(counts)
      .filter(([, c]) => c >= capacity)
      .map(([h]) => Number(h));
    return { hours, counts, capacity };
  });


// ---------- Create booking ----------
const bookingSchema = z.object({
  full_name: z.string().min(2).max(80),
  email: z.string().email().max(120),
  phone: z.string().min(7).max(20),
  street: z.string().min(3).max(120),
  city: z.string().min(2).max(60),
  state: z.string().min(2).max(20),
  zip: z.string().regex(/^\d{5}$/),
  service_slug: z.string().max(80).nullable().optional(),
  service_name: z.string().min(2).max(120),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduled_hour: z.number().int().min(8).max(18),
  notes: z.string().max(1000).optional().nullable(),
});

const BUSINESS_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof bookingSchema>) => bookingSchema.parse(d))
  .handler(async ({ data, context }) => {
    // verify ZIP is served
    const { data: area } = await context.supabase
      .from("service_areas").select("zip").eq("zip", data.zip).eq("active", true).maybeSingle();
    if (!area) throw new Error("ZIP not in service area");

    // enforce crew capacity per slot
    const { data: settings } = await context.supabase
      .from("site_settings").select("crew_capacity_enabled, crew_capacity").eq("singleton", true).maybeSingle();
    const cap = settings?.crew_capacity_enabled ? Math.max(1, settings.crew_capacity ?? 1) : 1;
    const { count } = await context.supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("scheduled_date", data.scheduled_date)
      .eq("scheduled_hour", data.scheduled_hour)
      .neq("status", "cancelled");
    if ((count ?? 0) >= cap) {
      // build alternatives: open hours on requested date + next 2 days
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [y, m, d] = data.scheduled_date.split("-").map(Number);
      const base = new Date(Date.UTC(y, m - 1, d));
      const dates = [0, 1, 2].map((i) => {
        const dt = new Date(base); dt.setUTCDate(base.getUTCDate() + i);
        return dt.toISOString().slice(0, 10);
      });
      const { data: rows } = await supabaseAdmin
        .from("bookings")
        .select("scheduled_date, scheduled_hour")
        .in("scheduled_date", dates)
        .neq("status", "cancelled");
      const counts: Record<string, Record<number, number>> = {};
      for (const r of rows ?? []) {
        counts[r.scheduled_date] ??= {};
        counts[r.scheduled_date][r.scheduled_hour] = (counts[r.scheduled_date][r.scheduled_hour] ?? 0) + 1;
      }
      const suggestions: { date: string; hour: number }[] = [];
      // same-day slots first, sorted by proximity to requested hour
      const sameDayOpen = BUSINESS_HOURS
        .filter((h) => h !== data.scheduled_hour && (counts[data.scheduled_date]?.[h] ?? 0) < cap)
        .sort((a, b) => Math.abs(a - data.scheduled_hour) - Math.abs(b - data.scheduled_hour));
      for (const h of sameDayOpen) suggestions.push({ date: data.scheduled_date, hour: h });
      // then next-day slots
      for (const dt of dates.slice(1)) {
        for (const h of BUSINESS_HOURS) {
          if ((counts[dt]?.[h] ?? 0) < cap) suggestions.push({ date: dt, hour: h });
        }
      }
      const alts = suggestions.slice(0, 6);
      await supabaseAdmin.from("capacity_conflicts").insert({
        scheduled_date: data.scheduled_date,
        scheduled_hour: data.scheduled_hour,
        capacity: cap,
        count: (count ?? 0) + 1,
        source: "booking",
        note: `Customer booking blocked for ${data.service_name} — ${data.full_name}`,
        created_by: context.userId,
      }).then(() => {}, () => {});
      throw new Error(`That time slot is fully booked. Please pick another.||ALTS||${JSON.stringify(alts)}`);

    }

    const { data: row, error } = await context.supabase
      .from("bookings")
      .insert({ ...data, user_id: context.userId, notes: data.notes ?? null })
      .select("id, reference")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ---------- Create order (cart checkout) ----------
const orderItemSchema = z.object({
  product_slug: z.string(),
  product_name: z.string(),
  brand: z.string().nullable().optional(),
  quantity: z.number().int().min(1),
  unit_price: z.number().min(0),
  installation_fee: z.number().min(0),
  include_installation: z.boolean(),
});
const orderSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7),
  street: z.string().min(3),
  city: z.string().min(2),
  state: z.string().min(2),
  zip: z.string().regex(/^\d{5}$/),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  scheduled_hour: z.number().int().min(8).max(18).nullable(),
  notes: z.string().nullable().optional(),
  items: z.array(orderItemSchema).min(1),
});

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof orderSchema>) => orderSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: area } = await context.supabase
      .from("service_areas").select("zip").eq("zip", data.zip).eq("active", true).maybeSingle();
    if (!area) throw new Error("ZIP not in service area");

    const subtotal = data.items.reduce((s, it) => s + it.unit_price * it.quantity, 0);
    const installationTotal = data.items.reduce(
      (s, it) => s + (it.include_installation ? it.installation_fee * it.quantity : 0), 0);
    const total = subtotal + installationTotal;

    const { data: order, error } = await context.supabase
      .from("orders")
      .insert({
        user_id: context.userId,
        full_name: data.full_name, email: data.email, phone: data.phone,
        street: data.street, city: data.city, state: data.state, zip: data.zip,
        scheduled_date: data.scheduled_date, scheduled_hour: data.scheduled_hour,
        notes: data.notes ?? null,
        subtotal, installation_total: installationTotal, total,
      })
      .select("id, reference")
      .single();
    if (error || !order) throw new Error(error?.message || "Failed to create order");

    const { error: itemErr } = await context.supabase.from("order_items").insert(
      data.items.map((it) => ({ ...it, order_id: order.id, brand: it.brand ?? null }))
    );
    if (itemErr) throw new Error(itemErr.message);

    // create installation booking if a slot chosen
    if (data.scheduled_date && data.scheduled_hour) {
      await context.supabase.from("bookings").insert({
        user_id: context.userId,
        full_name: data.full_name, email: data.email, phone: data.phone,
        street: data.street, city: data.city, state: data.state, zip: data.zip,
        service_slug: "new-system-install", service_name: `Installation for order ${order.reference}`,
        scheduled_date: data.scheduled_date, scheduled_hour: data.scheduled_hour,
        notes: `Order ${order.reference}`,
      });
    }
    return order;
  });

// ---------- Get booking / order for confirmation ----------
export const getBookingByRef = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reference: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("bookings").select("*").eq("reference", data.reference).maybeSingle();
    return row;
  });

export const getOrderByRef = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reference: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("orders").select("*").eq("reference", data.reference).maybeSingle();
    if (!row) return null;
    const { data: items } = await context.supabase
      .from("order_items").select("*").eq("order_id", row.id);
    return { ...row, items: items ?? [] };
  });

// ---------- Admin: list & CRUD ----------
async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden: admin only");
}

export const isCurrentUserAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return Boolean(data);
  });

export const adminListServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await context.supabase.from("services").select("*").order("name");
    return data ?? [];
  });

export const adminUpsertService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("services").upsert(data, { onConflict: "slug" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("services").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await context.supabase.from("products").select("*").order("name");
    return data ?? [];
  });

export const adminUpsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("products").upsert(data, { onConflict: "slug" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin allowlist (invite by email) ----------
export const adminListAllowlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: allow } = await supabaseAdmin
      .from("admin_allowlist").select("*").order("created_at", { ascending: false });
    // Try to mark which are actually registered users with admin role
    const { data: users } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const byEmail = new Map((users?.users ?? []).map((u) => [u.email?.toLowerCase(), u]));
    return (allow ?? []).map((r) => ({
      ...r,
      registered: byEmail.has(r.email.toLowerCase()),
    }));
  });

export const adminAddAllowlistEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string }) => ({ email: d.email.trim().toLowerCase() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) throw new Error("Invalid email");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("admin_allowlist")
      .upsert({ email: data.email, added_by: context.userId }, { onConflict: "email" });
    if (error) throw new Error(error.message);
    // If a user with that email already exists, grant admin role now
    const { data: users } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const match = (users?.users ?? []).find((u) => u.email?.toLowerCase() === data.email);
    if (match) {
      await supabaseAdmin.from("user_roles")
        .upsert({ user_id: match.id, role: "admin" }, { onConflict: "user_id,role" });
    }
    return { ok: true, granted: Boolean(match) };
  });

export const adminRemoveAllowlistEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string }) => ({ email: d.email.trim().toLowerCase() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("admin_allowlist").delete().eq("email", data.email);
    // Revoke admin role from that user if registered
    const { data: users } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const match = (users?.users ?? []).find((u) => u.email?.toLowerCase() === data.email);
    if (match) {
      await supabaseAdmin.from("user_roles").delete()
        .eq("user_id", match.id).eq("role", "admin");
    }
    return { ok: true };
  });

export const adminListBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await context.supabase.from("bookings").select("*").order("scheduled_date", { ascending: false });
    return data ?? [];
  });

export const adminUpdateBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase
      .from("bookings")
      .update({ status: data.status as any })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const kinds = ["pending", "confirmed", "completed", "cancelled"] as const;
    if (row && (kinds as readonly string[]).includes(data.status)) {
      const { notifyBookingEvent } = await import("./booking-email.server");
      await notifyBookingEvent(row as any, data.status as any).catch((e) =>
        console.error("booking notification failed", e),
      );
    }
    return { ok: true };
  });

export const adminSetBookingCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; service_charge: number }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!(data.service_charge >= 0) || data.service_charge > 1_000_000) {
      throw new Error("Invalid amount");
    }
    const { error } = await context.supabase
      .from("bookings")
      .update({ service_charge: data.service_charge })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetBookingTechnician = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; technician: string | null }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const tech = data.technician == null ? null : String(data.technician).slice(0, 120);
    const { error } = await context.supabase
      .from("bookings")
      .update({ technician: tech })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRescheduleBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; scheduled_date: string; scheduled_hour: number; technician?: string | null }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.scheduled_date)) throw new Error("Invalid date");
    if (!Number.isInteger(data.scheduled_hour) || data.scheduled_hour < 8 || data.scheduled_hour > 18) {
      throw new Error("Hour must be between 8 and 18");
    }
    // enforce crew capacity (excluding the booking itself)
    const { data: settings } = await context.supabase
      .from("site_settings").select("crew_capacity_enabled, crew_capacity").eq("singleton", true).maybeSingle();
    const cap = settings?.crew_capacity_enabled ? Math.max(1, settings.crew_capacity ?? 1) : 1;
    const { count } = await context.supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("scheduled_date", data.scheduled_date)
      .eq("scheduled_hour", data.scheduled_hour)
      .neq("status", "cancelled")
      .neq("id", data.id);
    if ((count ?? 0) >= cap) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [y, m, d] = data.scheduled_date.split("-").map(Number);
      const base = new Date(Date.UTC(y, m - 1, d));
      const dates = [0, 1, 2].map((i) => {
        const dt = new Date(base); dt.setUTCDate(base.getUTCDate() + i);
        return dt.toISOString().slice(0, 10);
      });
      const { data: rows } = await supabaseAdmin
        .from("bookings")
        .select("scheduled_date, scheduled_hour, id")
        .in("scheduled_date", dates)
        .neq("status", "cancelled");
      const counts: Record<string, Record<number, number>> = {};
      for (const r of rows ?? []) {
        if (r.id === data.id) continue;
        counts[r.scheduled_date] ??= {};
        counts[r.scheduled_date][r.scheduled_hour] = (counts[r.scheduled_date][r.scheduled_hour] ?? 0) + 1;
      }
      const suggestions: { date: string; hour: number }[] = [];
      const sameDayOpen = BUSINESS_HOURS
        .filter((h) => h !== data.scheduled_hour && (counts[data.scheduled_date]?.[h] ?? 0) < cap)
        .sort((a, b) => Math.abs(a - data.scheduled_hour) - Math.abs(b - data.scheduled_hour));
      for (const h of sameDayOpen) suggestions.push({ date: data.scheduled_date, hour: h });
      for (const dt of dates.slice(1)) {
        for (const h of BUSINESS_HOURS) {
          if ((counts[dt]?.[h] ?? 0) < cap) suggestions.push({ date: dt, hour: h });
        }
      }
      const alts = suggestions.slice(0, 6);
      await supabaseAdmin.from("capacity_conflicts").insert({
        scheduled_date: data.scheduled_date,
        scheduled_hour: data.scheduled_hour,
        capacity: cap,
        count: (count ?? 0) + 1,
        source: "reschedule",
        note: `Reschedule blocked for booking ${data.id.slice(0, 8)}`,
        booking_id: data.id,
        created_by: context.userId,
      }).then(() => {}, () => {});
      throw new Error(`That time slot is fully booked (crew capacity reached). Pick another.||ALTS||${JSON.stringify(alts)}`);

    }
    const patch: any = { scheduled_date: data.scheduled_date, scheduled_hour: data.scheduled_hour };
    if (data.technician !== undefined) patch.technician = data.technician == null ? null : String(data.technician).slice(0, 120);
    const { data: row, error } = await context.supabase
      .from("bookings")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    if (row) {
      const { notifyBookingEvent } = await import("./booking-email.server");
      await notifyBookingEvent(row as any, "rescheduled").catch((e) =>
        console.error("booking notification failed", e),
      );
    }
    return { ok: true };
  });





export const adminListOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await context.supabase.from("orders").select("*").order("created_at", { ascending: false });
    return data ?? [];
  });

export const adminUpdateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("orders").update({ status: data.status as any }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListAreas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await context.supabase.from("service_areas").select("*").order("zip");
    return data ?? [];
  });

export const adminUpsertArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("service_areas").upsert(data, { onConflict: "zip" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("service_areas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Site settings ----------
export const adminUpdateSiteSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    company_name: string; tagline: string; support_phone: string;
    support_email: string; address: string; business_hours: string; emergency_phone: string;
    notify_email_enabled?: boolean; notify_sms_enabled?: boolean;
    notify_on_reschedule?: boolean; notify_on_status_change?: boolean;
    twilio_from_phone?: string; technicians?: string[];
    crew_capacity_enabled?: boolean; crew_capacity?: number;
    notification_templates?: Record<string, { email_subject?: string; email_body?: string; sms_body?: string }>;
  }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const patch: any = { ...data };
    if (Array.isArray(patch.technicians)) {
      patch.technicians = patch.technicians.map((t: string) => String(t).trim()).filter(Boolean).slice(0, 100);
    }
    if (patch.crew_capacity != null) {
      const n = Math.floor(Number(patch.crew_capacity));
      patch.crew_capacity = Math.min(50, Math.max(1, Number.isFinite(n) ? n : 1));
    }
    if (patch.notification_templates && typeof patch.notification_templates === "object") {
      const allowed = ["pending", "confirmed", "completed", "cancelled", "rescheduled"];
      const clean: any = {};
      for (const k of allowed) {
        const v = patch.notification_templates[k];
        if (!v) continue;
        clean[k] = {
          email_subject: String(v.email_subject ?? "").slice(0, 300),
          email_body: String(v.email_body ?? "").slice(0, 5000),
          sms_body: String(v.sms_body ?? "").slice(0, 480),
        };
      }
      patch.notification_templates = clean;
    }
    const { error } = await context.supabase
      .from("site_settings")
      .update(patch)
      .eq("singleton", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Capacity overflow (admin) ----------
export const adminGetCapacityOverflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { capacity?: number; enabled?: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let cap = 1;
    let enabled = false;
    if (data.enabled !== undefined || data.capacity !== undefined) {
      enabled = !!data.enabled;
      cap = enabled ? Math.max(1, Math.min(50, Math.floor(Number(data.capacity ?? 1)) || 1)) : 1;
    } else {
      const { data: s } = await context.supabase
        .from("site_settings").select("crew_capacity_enabled, crew_capacity")
        .eq("singleton", true).maybeSingle();
      enabled = !!s?.crew_capacity_enabled;
      cap = enabled ? Math.max(1, s?.crew_capacity ?? 1) : 1;
    }
    const today = new Date().toISOString().slice(0, 10);
    const { data: rows } = await context.supabase
      .from("bookings")
      .select("id, reference, scheduled_date, scheduled_hour, service_name, technician, status, full_name")
      .gte("scheduled_date", today)
      .neq("status", "cancelled")
      .order("scheduled_date", { ascending: true })
      .order("scheduled_hour", { ascending: true });
    const grouped: Record<string, typeof rows> = {};
    for (const r of rows ?? []) {
      const k = `${r.scheduled_date}#${r.scheduled_hour}`;
      (grouped[k] ??= [] as any).push(r);
    }
    const overflow = Object.entries(grouped)
      .filter(([, list]) => (list?.length ?? 0) > cap)
      .map(([key, list]) => {
        const [date, hour] = key.split("#");
        return { date, hour: Number(hour), capacity: cap, count: list!.length, bookings: list! };
      });
    return { capacity: cap, enabled, overflow };
  });





// ---------- Reviews ----------
const reviewSchema = z.object({
  booking_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().nullable(),
});

export const createReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof reviewSchema>) => reviewSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: b, error: bErr } = await context.supabase
      .from("bookings")
      .select("id, user_id, status, service_slug, service_name")
      .eq("id", data.booking_id)
      .maybeSingle();
    if (bErr || !b) throw new Error("Booking not found");
    if (b.user_id !== context.userId) throw new Error("Not your booking");
    if (b.status !== "completed") throw new Error("Booking not completed yet");
    const { error } = await context.supabase.from("reviews").upsert({
      user_id: context.userId,
      booking_id: b.id,
      service_slug: b.service_slug,
      service_name: b.service_name,
      rating: data.rating,
      comment: data.comment ?? null,
    }, { onConflict: "booking_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyReviewableBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: bookings } = await context.supabase
      .from("bookings")
      .select("id, service_slug, service_name, scheduled_date, status")
      .eq("user_id", context.userId)
      .eq("status", "completed")
      .order("scheduled_date", { ascending: false });
    const { data: reviews } = await context.supabase
      .from("reviews")
      .select("id, booking_id, rating, comment, created_at")
      .eq("user_id", context.userId);
    const byBooking = new Map((reviews ?? []).map((r: any) => [r.booking_id, r]));
    return (bookings ?? []).map((b: any) => ({ ...b, review: byBooking.get(b.id) ?? null }));
  });

export const listServiceReviews = createServerFn({ method: "POST" })
  .inputValidator((d: { service_slug: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("reviews")
      .select("id, rating, comment, created_at, user_id, admin_reply, admin_reply_at")
      .eq("service_slug", data.service_slug)
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(50);
    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    let names = new Map<string, string>();
    if (ids.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles").select("id, full_name, email").in("id", ids);
      names = new Map((profs ?? []).map((p: any) => [p.id, p.full_name || (p.email || "").split("@")[0] || "Customer"]));
    }
    const list = (rows ?? []).map((r: any) => ({
      id: r.id, rating: r.rating, comment: r.comment, created_at: r.created_at,
      author: names.get(r.user_id) ?? "Customer",
      admin_reply: r.admin_reply, admin_reply_at: r.admin_reply_at,
    }));
    const count = list.length;
    const avg = count ? list.reduce((s, r) => s + r.rating, 0) / count : 0;
    return { list, count, avg };
  });

// ---------- Admin: reviews moderation ----------
export const adminListReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: "all" | "published" | "hidden"; q?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let query = context.supabase
      .from("reviews")
      .select("id, rating, comment, published, admin_reply, admin_reply_at, admin_note, service_slug, service_name, booking_id, user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status === "published") query = query.eq("published", true);
    else if (data.status === "hidden") query = query.eq("published", false);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    let profiles = new Map<string, { name: string; email: string }>();
    if (ids.length) {
      const { data: profs } = await context.supabase
        .from("profiles").select("id, full_name, email").in("id", ids);
      profiles = new Map((profs ?? []).map((p: any) => [p.id, {
        name: p.full_name || (p.email || "").split("@")[0] || "Customer",
        email: p.email || "",
      }]));
    }
    const q = (data.q || "").trim().toLowerCase();
    let list = (rows ?? []).map((r: any) => ({
      ...r,
      author: profiles.get(r.user_id)?.name ?? "Customer",
      author_email: profiles.get(r.user_id)?.email ?? "",
    }));
    if (q) list = list.filter((r) =>
      (r.comment || "").toLowerCase().includes(q) ||
      (r.service_name || "").toLowerCase().includes(q) ||
      (r.author || "").toLowerCase().includes(q) ||
      (r.author_email || "").toLowerCase().includes(q));
    return list;
  });

async function logReviewAudit(
  ctx: { supabase: any; userId: string; claims: any },
  entry: { action: string; review_id?: string | null; service_name?: string | null; target_user_id?: string | null; details?: any },
) {
  try {
    const email = ctx.claims?.email ?? null;
    await ctx.supabase.from("review_audit_log").insert({
      admin_id: ctx.userId,
      admin_email: email,
      action: entry.action,
      review_id: entry.review_id ?? null,
      service_name: entry.service_name ?? null,
      target_user_id: entry.target_user_id ?? null,
      details: entry.details ?? {},
    });
  } catch {
    // audit failure must not block moderation
  }
}

export const adminSetReviewPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; published: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: before } = await context.supabase
      .from("reviews").select("service_name, user_id, published").eq("id", data.id).maybeSingle();
    const { error } = await context.supabase
      .from("reviews").update({ published: data.published }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logReviewAudit(context, {
      action: data.published ? "approve" : "hide",
      review_id: data.id,
      service_name: (before as any)?.service_name ?? null,
      target_user_id: (before as any)?.user_id ?? null,
      details: { from: (before as any)?.published, to: data.published },
    });
    return { ok: true };
  });

export const adminDeleteReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: before } = await context.supabase
      .from("reviews").select("service_name, user_id, rating, comment").eq("id", data.id).maybeSingle();
    const { error } = await context.supabase.from("reviews").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logReviewAudit(context, {
      action: "delete",
      review_id: data.id,
      service_name: (before as any)?.service_name ?? null,
      target_user_id: (before as any)?.user_id ?? null,
      details: { rating: (before as any)?.rating, comment: (before as any)?.comment },
    });
    return { ok: true };
  });

export const adminReplyReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; reply: string | null; note?: string | null }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const reply = data.reply == null ? null : String(data.reply).slice(0, 2000);
    const note = data.note == null ? null : String(data.note).slice(0, 2000);
    const patch: any = { admin_reply: reply, admin_reply_at: reply ? new Date().toISOString() : null };
    if (data.note !== undefined) patch.admin_note = note;
    const { data: before } = await context.supabase
      .from("reviews").select("service_name, user_id, admin_reply, admin_note").eq("id", data.id).maybeSingle();
    const { error } = await context.supabase.from("reviews").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    const b: any = before;
    const actions: string[] = [];
    if ((b?.admin_reply ?? null) !== reply) actions.push(reply ? (b?.admin_reply ? "reply_edit" : "reply_add") : "reply_remove");
    if (data.note !== undefined && (b?.admin_note ?? null) !== note) actions.push(note ? "note_set" : "note_clear");
    for (const a of actions) {
      await logReviewAudit(context, {
        action: a,
        review_id: data.id,
        service_name: b?.service_name ?? null,
        target_user_id: b?.user_id ?? null,
        details: a.startsWith("reply") ? { reply } : { note },
      });
    }
    return { ok: true };
  });

export const adminBulkModerateReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[]; action: "approve" | "hide" | "delete" | "clear_reply" }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const ids = Array.from(new Set((data.ids || []).filter(Boolean))).slice(0, 500);
    if (!ids.length) return { ok: true, count: 0 };
    const { data: before } = await context.supabase
      .from("reviews").select("id, service_name, user_id, published, admin_reply").in("id", ids);
    const map = new Map((before ?? []).map((r: any) => [r.id, r]));

    if (data.action === "delete") {
      const { error } = await context.supabase.from("reviews").delete().in("id", ids);
      if (error) throw new Error(error.message);
    } else if (data.action === "approve" || data.action === "hide") {
      const { error } = await context.supabase
        .from("reviews").update({ published: data.action === "approve" }).in("id", ids);
      if (error) throw new Error(error.message);
    } else if (data.action === "clear_reply") {
      const { error } = await context.supabase
        .from("reviews").update({ admin_reply: null, admin_reply_at: null }).in("id", ids);
      if (error) throw new Error(error.message);
    }

    for (const id of ids) {
      const b: any = map.get(id);
      await logReviewAudit(context, {
        action: `bulk_${data.action}`,
        review_id: id,
        service_name: b?.service_name ?? null,
        target_user_id: b?.user_id ?? null,
        details: { bulk_size: ids.length },
      });
    }
    return { ok: true, count: ids.length };
  });

export const adminListReviewAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { days?: number; action?: string; q?: string; limit?: number }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const days = Math.min(Math.max(data.days ?? 30, 1), 365);
    const since = new Date(); since.setDate(since.getDate() - days);
    let q = context.supabase
      .from("review_audit_log")
      .select("id, admin_id, admin_email, action, review_id, service_name, target_user_id, details, created_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(data.limit ?? 500, 1), 5000));
    if (data.action && data.action !== "all") q = q.eq("action", data.action);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const term = (data.q || "").trim().toLowerCase();
    let list = rows ?? [];
    if (term) list = list.filter((r: any) =>
      (r.admin_email || "").toLowerCase().includes(term) ||
      (r.service_name || "").toLowerCase().includes(term) ||
      (r.action || "").toLowerCase().includes(term) ||
      (r.review_id || "").toLowerCase().includes(term));
    return list;
  });


// ---------- Admin analytics ----------
export const adminAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { days?: number }) => ({ days: Math.min(Math.max(d.days ?? 30, 7), 180) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const since = new Date();
    since.setDate(since.getDate() - data.days);
    const sinceIso = since.toISOString();

    const [ordersRes, bookingsRes, reviewsRes, servicesRes] = await Promise.all([
      context.supabase.from("orders")
        .select("id, total, status, created_at, user_id")
        .gte("created_at", sinceIso),
      context.supabase.from("bookings")
        .select("id, status, service_slug, service_name, service_charge, scheduled_date, created_at, user_id")
        .gte("created_at", sinceIso),
      context.supabase.from("reviews")
        .select("id, rating, service_slug, created_at").gte("created_at", sinceIso),
      context.supabase.from("services").select("slug, name"),
    ]);

    const orders = ordersRes.data ?? [];
    const bookings = bookingsRes.data ?? [];
    const reviews = reviewsRes.data ?? [];
    const services = servicesRes.data ?? [];

    // Daily buckets
    const days: { date: string; orderRevenue: number; serviceRevenue: number; orders: number; bookings: number }[] = [];
    for (let i = data.days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ date: d.toISOString().slice(0, 10), orderRevenue: 0, serviceRevenue: 0, orders: 0, bookings: 0 });
    }
    const idx = new Map(days.map((d, i) => [d.date, i]));
    for (const o of orders) {
      const k = String(o.created_at).slice(0, 10);
      const i = idx.get(k); if (i == null) continue;
      days[i].orders++; days[i].orderRevenue += Number(o.total || 0);
    }
    for (const b of bookings) {
      const k = String(b.created_at).slice(0, 10);
      const i = idx.get(k); if (i == null) continue;
      days[i].bookings++; days[i].serviceRevenue += Number(b.service_charge || 0);
    }

    const orderRevenue = orders.reduce((s, o) => s + Number(o.total || 0), 0);
    const serviceRevenue = bookings.reduce((s, b) => s + Number(b.service_charge || 0), 0);
    const totalRevenue = orderRevenue + serviceRevenue;

    // Booking funnel / conversion
    const statusCounts: Record<string, number> = {};
    for (const b of bookings) statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
    const completed = statusCounts["completed"] || 0;
    const cancelled = statusCounts["cancelled"] || 0;
    const conversion = bookings.length ? (completed / bookings.length) * 100 : 0;

    // Top services (by bookings & revenue)
    const svcMap = new Map<string, { slug: string | null; name: string; bookings: number; revenue: number }>();
    for (const b of bookings) {
      const key = b.service_slug || b.service_name;
      const cur = svcMap.get(key) || { slug: b.service_slug, name: b.service_name, bookings: 0, revenue: 0 };
      cur.bookings++;
      cur.revenue += Number(b.service_charge || 0);
      svcMap.set(key, cur);
    }
    const topServices = Array.from(svcMap.values()).sort((a, b) => b.bookings - a.bookings).slice(0, 8);

    // AOV
    const aov = orders.length ? orderRevenue / orders.length : 0;
    const avgTicket = completed ? serviceRevenue / completed : 0;

    // Repeat customers
    const customerBookings = new Map<string, number>();
    for (const b of bookings) if (b.user_id) customerBookings.set(b.user_id, (customerBookings.get(b.user_id) || 0) + 1);
    const uniqueCustomers = customerBookings.size;
    const repeatCustomers = Array.from(customerBookings.values()).filter((n) => n > 1).length;

    // Reviews
    const reviewCount = reviews.length;
    const avgRating = reviewCount ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviewCount : 0;

    return {
      range: { days: data.days, since: sinceIso },
      totals: {
        totalRevenue, orderRevenue, serviceRevenue,
        orderCount: orders.length, bookingCount: bookings.length,
        completed, cancelled, conversion, aov, avgTicket,
        uniqueCustomers, repeatCustomers,
        reviewCount, avgRating,
        serviceCatalog: services.length,
      },
      daily: days,
      statusCounts,
      topServices,
    };
  });
