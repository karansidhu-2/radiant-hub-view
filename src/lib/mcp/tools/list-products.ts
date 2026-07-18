import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "list_products",
  title: "List HVAC products",
  description: "List HVAC products available in the shop (units, thermostats, filters). Optionally filter by category.",
  inputSchema: {
    category: z.string().optional().describe("Optional category filter, e.g. 'ac', 'furnace', 'thermostat'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ category }) => {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let q = supabase.from("products").select("slug,name,brand,category,price,installation_fee,in_stock,published").eq("published", true);
    if (category) q = q.eq("category", category);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { products: data ?? [] },
    };
  },
});
