
CREATE TABLE public.revenue_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type text NOT NULL CHECK (period_type IN ('week','month','year','custom')),
  started_at timestamptz NOT NULL DEFAULT now(),
  label text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenue_checkpoints TO authenticated;
GRANT ALL ON public.revenue_checkpoints TO service_role;
ALTER TABLE public.revenue_checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read checkpoints" ON public.revenue_checkpoints FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert checkpoints" ON public.revenue_checkpoints FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update checkpoints" ON public.revenue_checkpoints FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete checkpoints" ON public.revenue_checkpoints FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX revenue_checkpoints_active_idx ON public.revenue_checkpoints(active, started_at DESC);
