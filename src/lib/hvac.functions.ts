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
    const { data: rows } = await supabaseAdmin
      .from("bookings")
      .select("scheduled_hour")
      .eq("scheduled_date", data.date)
      .neq("status", "cancelled");
    return { hours: (rows ?? []).map((r) => r.scheduled_hour) };
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

export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof bookingSchema>) => bookingSchema.parse(d))
  .handler(async ({ data, context }) => {
    // verify ZIP is served
    const { data: area } = await context.supabase
      .from("service_areas").select("zip").eq("zip", data.zip).eq("active", true).maybeSingle();
    if (!area) throw new Error("ZIP not in service area");

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
    const { error } = await context.supabase.from("bookings").update({ status: data.status as any }).eq("id", data.id);
    if (error) throw new Error(error.message);
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
