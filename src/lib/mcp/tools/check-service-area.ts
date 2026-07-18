import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "check_service_area",
  title: "Check service area by ZIP",
  description: "Check whether the HVAC company services a given US ZIP code.",
  inputSchema: {
    zip: z.string().regex(/^\d{5}$/).describe("US 5-digit ZIP code."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ zip }) => {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await supabase
      .from("service_areas")
      .select("zip,city,state,active")
      .eq("zip", zip)
      .eq("active", true)
      .maybeSingle();
    const result = data
      ? { available: true, zip: data.zip, city: data.city, state: data.state }
      : { available: false, zip };
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});
