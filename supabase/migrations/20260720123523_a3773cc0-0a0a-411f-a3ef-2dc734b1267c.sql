
-- Lock down EXECUTE on SECURITY DEFINER functions to the minimum required roles.
-- Revoke PUBLIC (which grants any role including anon) and re-grant narrowly.

-- has_role: called by RLS policies for signed-in users only.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- get_product_auto_ratings: read by public shop (anon + signed-in).
REVOKE ALL ON FUNCTION public.get_product_auto_ratings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_product_auto_ratings() TO anon, authenticated, service_role;

-- get_site_settings_public: read by public site (anon + signed-in).
REVOKE ALL ON FUNCTION public.get_site_settings_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_site_settings_public() TO anon, authenticated, service_role;

-- check_and_hit_rate_limit: server-side only; must not be callable from the Data API.
REVOKE ALL ON FUNCTION public.check_and_hit_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_hit_rate_limit(text, integer, integer) TO service_role;

-- Internal trigger functions: only owner/service_role need EXECUTE.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrement_product_stock() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
