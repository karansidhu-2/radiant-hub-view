-- 1. Faster auto-ratings: join reviews -> bookings -> orders via order_id (indexed FK)
CREATE OR REPLACE FUNCTION public.get_product_auto_ratings()
 RETURNS TABLE(slug text, units_sold integer, order_count integer, avg_related_rating numeric, related_review_count integer, auto_rating numeric, auto_confidence numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH unit_stats AS (
    SELECT oi.product_slug,
           COALESCE(SUM(oi.quantity),0)::int AS units_sold,
           COUNT(DISTINCT oi.order_id)::int AS order_count
    FROM public.order_items oi
    GROUP BY oi.product_slug
  ),
  review_stats AS (
    SELECT oi.product_slug,
           AVG(r.rating)::numeric(3,2) AS avg_related_rating,
           COUNT(r.id)::int AS related_review_count
    FROM public.reviews r
    JOIN public.bookings b   ON b.id = r.booking_id AND b.order_id IS NOT NULL
    JOIN public.order_items oi ON oi.order_id = b.order_id
    WHERE r.published = true
    GROUP BY oi.product_slug
  )
  SELECT
    p.slug,
    COALESCE(u.units_sold, 0),
    COALESCE(u.order_count, 0),
    rs.avg_related_rating,
    COALESCE(rs.related_review_count, 0),
    LEAST(5.0, GREATEST(1.0,
      3.7
      + 0.35 * ln(COALESCE(u.units_sold, 0) + 1)
      + COALESCE((rs.avg_related_rating - 3.5) * 0.6, 0)
    ))::numeric(3,2),
    LEAST(1.0, (
      (COALESCE(u.units_sold, 0)::numeric * 1)
      + (COALESCE(rs.related_review_count, 0)::numeric * 4)
    ) / 20.0)::numeric(3,2)
  FROM public.products p
  LEFT JOIN unit_stats  u  ON u.product_slug  = p.slug
  LEFT JOIN review_stats rs ON rs.product_slug = p.slug
  WHERE p.published = true;
$function$;

-- 2. Supporting indexes for hot read paths
CREATE INDEX IF NOT EXISTS idx_reviews_published_booking
  ON public.reviews (booking_id, rating) WHERE published = true;
CREATE INDEX IF NOT EXISTS idx_bookings_order_id_notnull
  ON public.bookings (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_created_at
  ON public.bookings (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_obs_kind_name_created
  ON public.observability_events (kind, name, created_at DESC);

-- 3. Retention cleanup for telemetry so the table cannot grow unbounded
CREATE OR REPLACE FUNCTION public.prune_observability_events()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE removed int;
BEGIN
  DELETE FROM public.observability_events
   WHERE (kind <> 'error' AND created_at < now() - interval '30 days')
      OR (kind =  'error' AND created_at < now() - interval '90 days');
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$function$;

REVOKE ALL ON FUNCTION public.prune_observability_events() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_observability_events() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('prune-observability-events')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-observability-events');
    PERFORM cron.schedule('prune-observability-events', '17 3 * * *',
      $cmd$SELECT public.prune_observability_events();$cmd$);
  END IF;
END $$;

-- 4. Reclaim planner stats after the index additions
ANALYZE public.observability_events;
ANALYZE public.order_items;
ANALYZE public.reviews;
ANALYZE public.bookings;