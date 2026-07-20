
-- Restrict site_settings public read to a safe view; hide Twilio, templates, technicians, notification toggles
DROP POLICY IF EXISTS "site_settings public read" ON public.site_settings;

-- Authenticated admins keep full access via existing "site_settings admin write" (ALL) policy.
-- Add read policy for admins explicitly (ALL covers select, but be explicit for clarity)
CREATE POLICY "site_settings admin read"
  ON public.site_settings FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Public-safe view exposing only non-sensitive columns
CREATE OR REPLACE VIEW public.site_settings_public
WITH (security_invoker = true) AS
SELECT
  id, company_name, tagline, support_phone, support_email,
  address, business_hours, emergency_phone, singleton
FROM public.site_settings;

-- Underlying table needs a SELECT policy for anon/authenticated on ONLY these columns.
-- Simplest: allow SELECT on the whole row but only via the view (security_invoker respects
-- caller RLS). So add a policy that permits reading the singleton row to anon/authenticated;
-- since the view is the only interface exposing safe columns, sensitive columns are still
-- selectable directly. Instead: use security_definer view + revoke direct table SELECT.
DROP VIEW public.site_settings_public;

CREATE VIEW public.site_settings_public
WITH (security_invoker = false) AS
SELECT
  id, company_name, tagline, support_phone, support_email,
  address, business_hours, emergency_phone, singleton
FROM public.site_settings
WHERE singleton = true;

GRANT SELECT ON public.site_settings_public TO anon, authenticated;

-- Ignore/keep-safe: has_role & get_product_auto_ratings EXECUTE grants are intentional
-- (RLS helper + public ratings). No change.
