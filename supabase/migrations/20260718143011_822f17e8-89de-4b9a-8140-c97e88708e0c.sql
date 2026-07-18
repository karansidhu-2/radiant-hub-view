ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS crew_capacity_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS crew_capacity integer NOT NULL DEFAULT 1;

ALTER TABLE public.site_settings
  ADD CONSTRAINT site_settings_crew_capacity_min CHECK (crew_capacity >= 1 AND crew_capacity <= 50);