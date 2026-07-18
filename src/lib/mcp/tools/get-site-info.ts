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
    const { data } = await supabase
      .from("site_settings")
      .select("company_name,tagline,support_phone,support_email,address,business_hours,emergency_phone")
      .eq("singleton", true)
      .maybeSingle();
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? {}) }],
      structuredContent: data ?? {},
    };
  },
});
