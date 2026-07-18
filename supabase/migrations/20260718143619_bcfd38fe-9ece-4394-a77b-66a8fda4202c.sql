CREATE TABLE public.saved_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Home',
  street TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX saved_addresses_user_id_idx ON public.saved_addresses(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_addresses TO authenticated;
GRANT ALL ON public.saved_addresses TO service_role;
ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own addresses" ON public.saved_addresses FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_saved_addresses_updated_at BEFORE UPDATE ON public.saved_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();