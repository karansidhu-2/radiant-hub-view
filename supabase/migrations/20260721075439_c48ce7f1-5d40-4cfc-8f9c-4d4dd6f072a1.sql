-- Handover: bootstrap-friendly admin trigger.
-- If the admin_allowlist is empty AND no admin exists yet, the first signup
-- becomes admin (self-claim). Otherwise falls back to the allowlist behavior.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_allowlisted boolean;
  any_admin_exists boolean;
  allowlist_empty boolean;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;

  SELECT EXISTS (SELECT 1 FROM public.admin_allowlist WHERE lower(email) = lower(NEW.email))
    INTO is_allowlisted;
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
    INTO any_admin_exists;
  SELECT NOT EXISTS (SELECT 1 FROM public.admin_allowlist)
    INTO allowlist_empty;

  IF is_allowlisted OR (allowlist_empty AND any_admin_exists) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer')
      ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;