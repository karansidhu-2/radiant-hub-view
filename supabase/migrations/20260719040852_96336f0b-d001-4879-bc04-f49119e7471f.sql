
-- Tighten saved_addresses policy to authenticated role
DROP POLICY IF EXISTS "Users manage own addresses" ON public.saved_addresses;
CREATE POLICY "Users manage own addresses"
  ON public.saved_addresses
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- decrement_product_stock is a trigger function; no client should call it directly
REVOKE EXECUTE ON FUNCTION public.decrement_product_stock() FROM PUBLIC, anon, authenticated;
