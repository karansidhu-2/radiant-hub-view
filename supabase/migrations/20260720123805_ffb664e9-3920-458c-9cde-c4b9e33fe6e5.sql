DROP POLICY IF EXISTS "Authenticated read active technicians" ON public.technicians;
CREATE POLICY "Admins read technicians" ON public.technicians
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));