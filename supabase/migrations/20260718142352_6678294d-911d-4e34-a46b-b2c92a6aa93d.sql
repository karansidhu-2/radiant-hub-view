ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS notification_templates jsonb NOT NULL DEFAULT '{}'::jsonb;