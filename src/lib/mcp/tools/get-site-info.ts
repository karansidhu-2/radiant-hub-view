import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";

export default defineTool({
  name: "get_site_info",
  title: "Get company info",
  description: "Get the HVAC company's public contact info: name, tagline, support phone, emergency phone, email, address, business hours.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await (supabase as any).rpc("get_site_settings_public");
    const row = Array.isArray(data) ? data[0] : data;
    return {
      content: [{ type: "text", text: JSON.stringify(row ?? {}) }],
      structuredContent: row ?? {},
    };
  },
});
