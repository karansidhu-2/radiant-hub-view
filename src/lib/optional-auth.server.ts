// Server-only helper: best-effort resolve current user id from the
// Authorization header without failing when the request is anonymous.
import { getRequest } from "@tanstack/react-start/server";

export async function optionalUserId(): Promise<string | null> {
  try {
    const request = getRequest();
    const authHeader = request?.headers?.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    const token = authHeader.slice("Bearer ".length).trim();
    if (!token || token.split(".").length !== 3) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.auth.getUser(token);
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}
