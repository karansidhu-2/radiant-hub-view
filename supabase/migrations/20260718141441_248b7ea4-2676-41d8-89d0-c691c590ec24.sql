
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS technician text,
  ADD COLUMN IF NOT EXISTS customer_phone_notify text;

CREATE INDEX IF NOT EXISTS bookings_technician_idx ON public.bookings (technician);
CREATE INDEX IF NOT EXISTS bookings_service_slug_idx ON public.bookings (service_slug);

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS notify_email_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_sms_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_on_reschedule boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_on_status_change boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS twilio_from_phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS technicians text[] NOT NULL DEFAULT ARRAY[]::text[];
