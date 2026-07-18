ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS admin_reply text,
  ADD COLUMN IF NOT EXISTS admin_reply_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_note text;