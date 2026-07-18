
CREATE TABLE public.review_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  admin_email text,
  action text NOT NULL,
  review_id uuid,
  service_name text,
  target_user_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX review_audit_log_created_at_idx ON public.review_audit_log (created_at DESC);
CREATE INDEX review_audit_log_review_id_idx ON public.review_audit_log (review_id);

GRANT SELECT, INSERT ON public.review_audit_log TO authenticated;
GRANT ALL ON public.review_audit_log TO service_role;

ALTER TABLE public.review_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read review audit log"
  ON public.review_audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert review audit log"
  ON public.review_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND admin_id = auth.uid());
