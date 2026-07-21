
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS review_request_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_request_delay_hours integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS google_review_url text,
  ADD COLUMN IF NOT EXISTS review_request_sms_template text NOT NULL
    DEFAULT 'Hi {{name}}, thanks for choosing {{company}}! We''d love your feedback — leave us a quick Google review: {{review_url}}';

CREATE TABLE IF NOT EXISTS public.review_request_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  reference text NOT NULL,
  phone text NOT NULL,
  message text NOT NULL,
  send_after timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  provider_sid text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_request_queue TO authenticated;
GRANT ALL ON public.review_request_queue TO service_role;

ALTER TABLE public.review_request_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage review request queue"
  ON public.review_request_queue FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS review_request_queue_due_idx
  ON public.review_request_queue (send_after)
  WHERE status = 'pending';

CREATE TRIGGER update_review_request_queue_updated_at
  BEFORE UPDATE ON public.review_request_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
