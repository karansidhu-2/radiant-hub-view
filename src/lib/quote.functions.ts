import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden: admin only");
}

export type SystemType = { key: string; label: string; basePrice: number; perSqft: number };
export type ZipMultiplier = { zip: string; multiplier: number };
export type EstimatorConfig = {
  systemTypes: SystemType[];
  zipMultipliers: ZipMultiplier[];
  defaultMultiplier: number;
  rangeSpreadPct: number;
  disclaimer: string;
};

const DEFAULT_CONFIG: EstimatorConfig = {
  systemTypes: [
    { key: "central_ac", label: "Central AC", basePrice: 3500, perSqft: 1.5 },
    { key: "heat_pump", label: "Heat Pump", basePrice: 5000, perSqft: 2.0 },
    { key: "furnace", label: "Gas Furnace", basePrice: 3000, perSqft: 1.2 },
    { key: "mini_split", label: "Ductless Mini-Split", basePrice: 4000, perSqft: 1.8 },
    { key: "tankless", label: "Tankless Water Heater", basePrice: 2200, perSqft: 0 },
  ],
  zipMultipliers: [],
  defaultMultiplier: 1.0,
  rangeSpreadPct: 20,
  disclaimer:
    "Estimates are non-binding and based on typical installations. Final pricing depends on on-site assessment.",
};

function normalizeConfig(raw: any): EstimatorConfig {
  const c = raw && typeof raw === "object" ? raw : {};
  const systemTypes: SystemType[] = Array.isArray(c.systemTypes)
    ? c.systemTypes
        .map((s: any) => ({
          key: String(s?.key ?? "").trim().slice(0, 40),
          label: String(s?.label ?? "").trim().slice(0, 80),
          basePrice: Math.max(0, Number(s?.basePrice) || 0),
          perSqft: Math.max(0, Number(s?.perSqft) || 0),
        }))
        .filter((s: SystemType) => s.key && s.label)
        .slice(0, 20)
    : DEFAULT_CONFIG.systemTypes;
  const zipMultipliers: ZipMultiplier[] = Array.isArray(c.zipMultipliers)
    ? c.zipMultipliers
        .map((z: any) => ({
          zip: String(z?.zip ?? "").trim(),
          multiplier: Number(z?.multiplier) || 1,
        }))
        .filter((z: ZipMultiplier) => /^\d{5}$/.test(z.zip) && z.multiplier > 0 && z.multiplier < 5)
        .slice(0, 500)
    : [];
  return {
    systemTypes: systemTypes.length ? systemTypes : DEFAULT_CONFIG.systemTypes,
    zipMultipliers,
    defaultMultiplier: Math.max(0.1, Math.min(5, Number(c.defaultMultiplier) || 1)),
    rangeSpreadPct: Math.max(0, Math.min(60, Number(c.rangeSpreadPct) || 20)),
    disclaimer: String(c.disclaimer ?? DEFAULT_CONFIG.disclaimer).slice(0, 500),
  };
}

function computeRange(cfg: EstimatorConfig, systemKey: string, sqft: number, zip: string) {
  const sys = cfg.systemTypes.find((s) => s.key === systemKey);
  if (!sys) throw new Error("Unknown system type");
  const mult = cfg.zipMultipliers.find((z) => z.zip === zip)?.multiplier ?? cfg.defaultMultiplier;
  const base = (sys.basePrice + sys.perSqft * Math.max(0, sqft)) * mult;
  const spread = cfg.rangeSpreadPct / 100;
  const low = Math.round((base * (1 - spread)) / 25) * 25;
  const high = Math.round((base * (1 + spread)) / 25) * 25;
  return { low: Math.max(0, low), high: Math.max(low, high), multiplier: mult, systemLabel: sys.label };
}

// ---------- Public: submit an estimate ----------
export const submitQuoteEstimate = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      full_name: string;
      email: string;
      phone?: string;
      zip: string;
      square_footage: number;
      system_type_key: string;
      notes?: string;
    }) =>
      z
        .object({
          full_name: z.string().trim().min(2).max(80),
          email: z.string().trim().email().max(120),
          phone: z.string().trim().max(20).optional().or(z.literal("")),
          zip: z.string().regex(/^\d{5}$/),
          square_footage: z.number().int().min(100).max(20000),
          system_type_key: z.string().min(1).max(40),
          notes: z.string().max(1000).optional().or(z.literal("")),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const { rateLimit } = await import("./rate-limit.server");
    await rateLimit(`quote:${data.email}`, { max: 8, windowSeconds: 300 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: settings } = await supabaseAdmin
      .from("site_settings")
      .select("quote_estimator, quote_estimator_enabled")
      .eq("singleton", true)
      .maybeSingle();
    if (settings && settings.quote_estimator_enabled === false) {
      throw new Error("The instant quote estimator is currently disabled.");
    }
    const cfg = normalizeConfig(settings?.quote_estimator);
    const { low, high, multiplier, systemLabel } = computeRange(
      cfg,
      data.system_type_key,
      data.square_footage,
      data.zip,
    );

    // Best-effort city/state lookup from covered areas
    const { data: area } = await supabaseAdmin
      .from("service_areas")
      .select("city, state")
      .eq("zip", data.zip)
      .maybeSingle();

    const row = {
      full_name: data.full_name.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone?.trim() || null,
      zip: data.zip,
      city: area?.city ?? null,
      state: area?.state ?? null,
      square_footage: data.square_footage,
      system_type_key: data.system_type_key,
      system_type_label: systemLabel,
      estimate_low: low,
      estimate_high: high,
      multiplier,
      notes: data.notes?.trim() || null,
    };
    const { data: inserted, error } = await supabaseAdmin
      .from("quote_leads")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return { id: inserted.id, low, high, multiplier, systemLabel, disclaimer: cfg.disclaimer };
  });

// ---------- Admin: update estimator config ----------
const configSchema = z.object({
  enabled: z.boolean(),
  systemTypes: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(40),
        label: z.string().trim().min(1).max(80),
        basePrice: z.number().min(0).max(1_000_000),
        perSqft: z.number().min(0).max(1000),
      }),
    )
    .max(20),
  zipMultipliers: z
    .array(
      z.object({
        zip: z.string().regex(/^\d{5}$/),
        multiplier: z.number().min(0.1).max(5),
      }),
    )
    .max(500),
  defaultMultiplier: z.number().min(0.1).max(5),
  rangeSpreadPct: z.number().min(0).max(60),
  disclaimer: z.string().max(500),
});

export const adminUpdateQuoteEstimator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof configSchema>) => configSchema.parse(d))
  .handler(async ({ data, context }) => {
    
    await assertAdmin(context);
    const { logAdminAction } = await import("./audit.server");
    const { data: prev } = await context.supabase
      .from("site_settings")
      .select("quote_estimator, quote_estimator_enabled")
      .eq("singleton", true)
      .maybeSingle();
    const { enabled, ...rest } = data;
    const { error } = await context.supabase
      .from("site_settings")
      .update({ quote_estimator: rest, quote_estimator_enabled: enabled })
      .eq("singleton", true);
    if (error) throw new Error(error.message);
    await logAdminAction(context, {
      action: "settings.quote_estimator.update",
      entity_type: "site_settings",
      entity_id: "singleton",
      before: prev,
      after: { quote_estimator: rest, quote_estimator_enabled: enabled },
    });
    return { ok: true };
  });

// ---------- Admin: list leads ----------
export const adminListQuoteLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; days?: number; q?: string; limit?: number }) => d)
  .handler(async ({ data, context }) => {
    
    await assertAdmin(context);
    const days = Math.min(Math.max(data.days ?? 90, 1), 365);
    const since = new Date();
    since.setDate(since.getDate() - days);
    let q = context.supabase
      .from("quote_leads")
      .select(
        "id, full_name, email, phone, zip, city, state, square_footage, system_type_label, estimate_low, estimate_high, notes, status, created_at",
      )
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(data.limit ?? 500, 1), 2000));
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const term = (data.q || "").trim().toLowerCase();
    let list = rows ?? [];
    if (term)
      list = list.filter(
        (r: any) =>
          (r.email || "").toLowerCase().includes(term) ||
          (r.full_name || "").toLowerCase().includes(term) ||
          (r.zip || "").includes(term),
      );
    return list;
  });

export const adminUpdateQuoteLeadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: "new" | "contacted" | "converted" | "closed" }) => d)
  .handler(async ({ data, context }) => {
    
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("quote_leads")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteQuoteLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    
    await assertAdmin(context);
    const { error } = await context.supabase.from("quote_leads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
