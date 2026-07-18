
-- Capacity conflict inbox
CREATE TABLE public.capacity_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_date date NOT NULL,
  scheduled_hour integer NOT NULL,
  capacity integer NOT NULL,
  count integer NOT NULL,
  source text NOT NULL,
  note text,
  booking_id uuid,
  created_by uuid,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.capacity_conflicts TO authenticated;
GRANT ALL ON public.capacity_conflicts TO service_role;
ALTER TABLE public.capacity_conflicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view conflicts" ON public.capacity_conflicts FOR SELECT
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update conflicts" ON public.capacity_conflicts FOR UPDATE
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete conflicts" ON public.capacity_conflicts FOR DELETE
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_capacity_conflicts_updated BEFORE UPDATE ON public.capacity_conflicts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX capacity_conflicts_open_idx ON public.capacity_conflicts (resolved, scheduled_date, scheduled_hour);

-- Low stock threshold on products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS low_stock_threshold integer;

-- Automatic stock decrement on order item insert
CREATE OR REPLACE FUNCTION public.decrement_product_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products
     SET stock = GREATEST(0, COALESCE(stock, 0) - NEW.quantity),
         available = CASE
           WHEN GREATEST(0, COALESCE(stock, 0) - NEW.quantity) <= 0 THEN false
           ELSE available
         END
   WHERE slug = NEW.product_slug;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_items_decrement_stock ON public.order_items;
CREATE TRIGGER trg_order_items_decrement_stock
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.decrement_product_stock();
