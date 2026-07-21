
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS quote_estimator_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS quote_estimator jsonb NOT NULL DEFAULT jsonb_build_object(
    'systemTypes', jsonb_build_array(
      jsonb_build_object('key','central_ac','label','Central AC','basePrice',3500,'perSqft',1.5),
      jsonb_build_object('key','heat_pump','label','Heat Pump','basePrice',5000,'perSqft',2.0),
      jsonb_build_object('key','furnace','label','Gas Furnace','basePrice',3000,'perSqft',1.2),
      jsonb_build_object('key','mini_split','label','Ductless Mini-Split','basePrice',4000,'perSqft',1.8),
      jsonb_build_object('key','tankless','label','Tankless Water Heater','basePrice',2200,'perSqft',0)
    ),
    'zipMultipliers', jsonb_build_array(),
    'defaultMultiplier', 1.0,
    'rangeSpreadPct', 20,
    'disclaimer','Estimates are non-binding and based on typical installations. Final pricing depends on on-site assessment.'
  );

CREATE TABLE IF NOT EXISTS public.quote_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  zip text NOT NULL,
  city text,
  state text,
  square_footage integer NOT NULL,
  system_type_key text NOT NULL,
  system_type_label text NOT NULL,
  estimate_low numeric(10,2) NOT NULL,
  estimate_high numeric(10,2) NOT NULL,
  multiplier numeric(6,3) NOT NULL DEFAULT 1.0,
  notes text,
  status text NOT NULL DEFAULT 'new',
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_leads TO authenticated;
GRANT INSERT ON public.quote_leads TO anon;
GRANT ALL ON public.quote_leads TO service_role;

ALTER TABLE public.quote_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quote_leads anyone insert" ON public.quote_leads;
CREATE POLICY "quote_leads anyone insert"
  ON public.quote_leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "quote_leads admin read" ON public.quote_leads;
CREATE POLICY "quote_leads admin read"
  ON public.quote_leads FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "quote_leads admin update" ON public.quote_leads;
CREATE POLICY "quote_leads admin update"
  ON public.quote_leads FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "quote_leads admin delete" ON public.quote_leads;
CREATE POLICY "quote_leads admin delete"
  ON public.quote_leads FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS quote_leads_created_at_idx ON public.quote_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS quote_leads_status_idx ON public.quote_leads (status);

DROP TRIGGER IF EXISTS quote_leads_updated_at ON public.quote_leads;
CREATE TRIGGER quote_leads_updated_at
  BEFORE UPDATE ON public.quote_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP FUNCTION IF EXISTS public.get_site_settings_public();
CREATE OR REPLACE FUNCTION public.get_site_settings_public()
 RETURNS TABLE(
   company_name text, tagline text, support_phone text, support_email text,
   address text, business_hours text, emergency_phone text,
   quote_estimator_enabled boolean, quote_estimator jsonb
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT company_name, tagline, support_phone, support_email,
         address, business_hours, emergency_phone,
         quote_estimator_enabled, quote_estimator
  FROM public.site_settings
  WHERE singleton = true
  LIMIT 1;
$function$;
