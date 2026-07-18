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
};

const FALLBACK: SiteSettings = {
  company_name: "HVAC Pro",
  tagline: "Trusted heating & cooling experts",
  support_phone: "(800) 555-0199",
  support_email: "support@hvacpro.com",
  address: "123 Main St, Dallas, TX 75201",
  business_hours: "Mon–Sat 7am–8pm • 24/7 emergency",
  emergency_phone: "(800) 555-0911",
};

export function useSiteSettings() {
  const { data } = useQuery({
    queryKey: ["site_settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("company_name,tagline,support_phone,support_email,address,business_hours,emergency_phone")
        .eq("singleton", true)
        .maybeSingle();
      return (data as SiteSettings | null) ?? FALLBACK;
    },
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });
  return data ?? FALLBACK;
}

export const telHref = (s: string) => `tel:${s.replace(/[^\d+]/g, "")}`;
