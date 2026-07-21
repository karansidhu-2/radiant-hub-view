import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SiteSettings = {
  company_name: string;
  tagline: string;
  support_phone: string;
  support_email: string;
  address: string;
  business_hours: string;
  emergency_phone: string;
  quote_estimator_enabled?: boolean;
  quote_estimator?: any;
};

// Neutral placeholders. Real values live in site_settings and are edited from
// /admin/settings after handover.
const FALLBACK: SiteSettings = {
  company_name: "Your Company Name",
  tagline: "Trusted heating & cooling experts",
  support_phone: "(555) 555-0100",
  support_email: "support@example.com",
  address: "123 Main St, City, ST 00000",
  business_hours: "Mon–Sat 8am–6pm",
  emergency_phone: "(555) 555-0199",
  quote_estimator_enabled: true,
};

export function useSiteSettings() {
  const { data } = useQuery({
    queryKey: ["site_settings"],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("get_site_settings_public");
      const row = Array.isArray(data) ? data[0] : data;
      return (row as SiteSettings | null) ?? FALLBACK;
    },
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });
  return data ?? FALLBACK;
}

export const telHref = (s: string) => `tel:${s.replace(/[^\d+]/g, "")}`;
