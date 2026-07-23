CREATE TABLE public.sample_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sample_notes TO authenticated;
GRANT ALL ON public.sample_notes TO service_role;
ALTER TABLE public.sample_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own sample notes" ON public.sample_notes
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_sample_notes_updated_at BEFORE UPDATE ON public.sample_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_sample_notes_user_created ON public.sample_notes(user_id, created_at DESC);