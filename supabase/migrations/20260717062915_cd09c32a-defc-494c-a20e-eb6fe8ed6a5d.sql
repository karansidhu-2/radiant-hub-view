
-- Fix: admins were denied because has_role RPC lost EXECUTE for authenticated
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- Site settings (single-row key/value-ish table, but with named columns for simplicity)
CREATE TABLE public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT 'HVAC Pro',
  tagline text NOT NULL DEFAULT 'Trusted heating & cooling experts',
  support_phone text NOT NULL DEFAULT '(800) 555-0199',
  support_email text NOT NULL DEFAULT 'support@hvacpro.com',
  address text NOT NULL DEFAULT '123 Main St, Dallas, TX 75201',
  business_hours text NOT NULL DEFAULT 'Mon–Sat 7am–8pm • 24/7 emergency',
  emergency_phone text NOT NULL DEFAULT '(800) 555-0911',
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_settings public read" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "site_settings admin write" ON public.site_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- seed the single row
INSERT INTO public.site_settings (singleton) VALUES (true) ON CONFLICT DO NOTHING;
