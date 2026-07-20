
DROP POLICY IF EXISTS "Anyone views published products" ON public.products;
DROP POLICY IF EXISTS "Anyone views published services" ON public.services;

CREATE POLICY "Public reads published products"
  ON public.products FOR SELECT
  TO anon, authenticated
  USING (published = true);

CREATE POLICY "Admins read all products"
  ON public.products FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public reads published services"
  ON public.services FOR SELECT
  TO anon, authenticated
  USING (published = true);

CREATE POLICY "Admins read all services"
  ON public.services FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
