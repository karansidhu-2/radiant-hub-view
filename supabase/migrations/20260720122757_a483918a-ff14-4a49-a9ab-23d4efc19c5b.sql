
DROP VIEW IF EXISTS public.site_settings_public;

CREATE OR REPLACE FUNCTION public.get_site_settings_public()
RETURNS TABLE (
  company_name text,
  tagline text,
  support_phone text,
  support_email text,
  address text,
  business_hours text,
  emergency_phone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_name, tagline, support_phone, support_email,
         address, business_hours, emergency_phone
  FROM public.site_settings
  WHERE singleton = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_site_settings_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_site_settings_public() TO anon, authenticated;
