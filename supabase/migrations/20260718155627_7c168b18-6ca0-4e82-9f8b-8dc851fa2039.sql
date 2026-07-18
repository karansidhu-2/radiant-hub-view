
CREATE OR REPLACE FUNCTION public.get_product_auto_ratings()
RETURNS TABLE(
  slug text,
  units_sold integer,
  order_count integer,
  avg_related_rating numeric,
  related_review_count integer,
  auto_rating numeric,
  auto_confidence numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    FROM public.order_items oi
    JOIN public.orders o    ON o.id = oi.order_id
    JOIN public.bookings b  ON b.notes ILIKE 'Order ' || o.reference || '%'
    JOIN public.reviews  r  ON r.booking_id = b.id AND r.published = true
    GROUP BY oi.product_slug
  )
  SELECT
    p.slug,
    COALESCE(u.units_sold, 0)              AS units_sold,
    COALESCE(u.order_count, 0)             AS order_count,
    rs.avg_related_rating                  AS avg_related_rating,
    COALESCE(rs.related_review_count, 0)   AS related_review_count,
    LEAST(5.0, GREATEST(1.0,
      3.7
      + 0.35 * ln(COALESCE(u.units_sold, 0) + 1)
      + COALESCE((rs.avg_related_rating - 3.5) * 0.6, 0)
    ))::numeric(3,2) AS auto_rating,
    LEAST(1.0, (
      (COALESCE(u.units_sold, 0)::numeric * 1)
      + (COALESCE(rs.related_review_count, 0)::numeric * 4)
    ) / 20.0)::numeric(3,2) AS auto_confidence
  FROM public.products p
  LEFT JOIN unit_stats  u  ON u.product_slug  = p.slug
  LEFT JOIN review_stats rs ON rs.product_slug = p.slug
  WHERE p.published = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_auto_ratings() TO anon, authenticated, service_role;
