
-- 1. Case-insensitive unique index for admin allowlist
CREATE UNIQUE INDEX IF NOT EXISTS admin_allowlist_email_ci_uniq
  ON public.admin_allowlist (lower(email));

-- 2. Direct FK from bookings to orders
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_order_id ON public.bookings(order_id);

-- Backfill from the legacy notes prefix ("Order <reference>")
UPDATE public.bookings b
   SET order_id = o.id
  FROM public.orders o
 WHERE b.order_id IS NULL
   AND b.notes IS NOT NULL
   AND b.notes LIKE ('Order ' || o.reference || '%');

-- 3. Rate limit tracker (server-side, per-key sliding window)
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text NOT NULL,
  hit_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key, hit_at)
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_time ON public.rate_limits(key, hit_at DESC);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies: only accessed via SECURITY DEFINER function below.

CREATE OR REPLACE FUNCTION public.check_and_hit_rate_limit(
  _key text, _max int, _window_seconds int
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE hits int;
BEGIN
  DELETE FROM public.rate_limits
   WHERE key = _key AND hit_at < now() - make_interval(secs => _window_seconds * 4);
  SELECT count(*) INTO hits FROM public.rate_limits
   WHERE key = _key AND hit_at > now() - make_interval(secs => _window_seconds);
  IF hits >= _max THEN
    RETURN false;
  END IF;
  INSERT INTO public.rate_limits(key) VALUES (_key);
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_and_hit_rate_limit(text, int, int) FROM PUBLIC, anon, authenticated;
