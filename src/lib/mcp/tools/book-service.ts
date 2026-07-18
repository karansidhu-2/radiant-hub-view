import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "book_service",
  title: "Book an HVAC service",
  description: "Book an HVAC service appointment for the signed-in user at a given date and hour (8-18, 24h). Verifies the ZIP is in the service area.",
  inputSchema: {
    full_name: z.string().min(2).max(80),
    email: z.string().email(),
    phone: z.string().min(7).max(20),
    street: z.string().min(3).max(120),
    city: z.string().min(2).max(60),
    state: z.string().min(2).max(20),
    zip: z.string().regex(/^\d{5}$/),
    service_slug: z.string().max(80).nullable().optional(),
    service_name: z.string().min(2).max(120),
    scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("YYYY-MM-DD"),
    scheduled_hour: z.number().int().min(8).max(18).describe("Hour 8-18 (24h)"),
    notes: z.string().max(1000).optional().nullable(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const sb = supabaseForUser(ctx);
    const { data: area } = await sb
      .from("service_areas").select("zip").eq("zip", input.zip).eq("active", true).maybeSingle();
    if (!area) return { content: [{ type: "text", text: `ZIP ${input.zip} is not in our service area.` }], isError: true };
    const { data, error } = await sb
      .from("bookings")
      .insert({ ...input, user_id: ctx.getUserId(), notes: input.notes ?? null })
      .select("id,reference")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Booking confirmed. Reference: ${data.reference}` }],
      structuredContent: { reference: data.reference, id: data.id },
    };
  },
});
