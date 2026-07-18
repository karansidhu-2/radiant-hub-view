-- 1) Realtime for bookings and orders
ALTER TABLE public.bookings REPLICA IDENTITY FULL;
ALTER TABLE public.orders   REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 2) required_skill on services (nullable = any technician)
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS required_skill text;

-- 3) technicians table
CREATE TABLE IF NOT EXISTS public.technicians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  active boolean NOT NULL DEFAULT true,
  skills text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.technicians TO authenticated;
GRANT ALL ON public.technicians TO service_role;

ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage technicians"
  ON public.technicians FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read active technicians"
  ON public.technicians FOR SELECT
  TO authenticated
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_technicians_updated_at ON public.technicians;
CREATE TRIGGER trg_technicians_updated_at
  BEFORE UPDATE ON public.technicians
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_technicians_active ON public.technicians(active);
CREATE INDEX IF NOT EXISTS idx_technicians_skills ON public.technicians USING gin(skills);