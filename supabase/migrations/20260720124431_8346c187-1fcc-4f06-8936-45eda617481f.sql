CREATE TABLE public.rpc_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  event TEXT NOT NULL,                         -- e.g. 'createOrder.success', 'rateLimit.denied'
  actor_role TEXT NOT NULL DEFAULT 'anon',     -- 'anon' | 'authenticated' | 'admin' | 'service_role'
  actor_user_id UUID,                          -- null for guests
  ip_hash TEXT,                                -- sha256(ip + daily-salt), never raw IP
  outcome TEXT NOT NULL DEFAULT 'success',     -- 'success' | 'denied' | 'error'
  reason TEXT,                                 -- short machine-readable reason
  entity_type TEXT,                            -- 'order' | 'booking' | 'rate_limit'
  entity_id TEXT,                              -- order.id / booking.id / rate-limit bucket
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb  -- safe fields only (slugs, counts, totals)
);

GRANT SELECT ON public.rpc_audit_log TO authenticated;
GRANT ALL    ON public.rpc_audit_log TO service_role;

ALTER TABLE public.rpc_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view rpc audit log"
  ON public.rpc_audit_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX rpc_audit_log_created_at_idx ON public.rpc_audit_log (created_at DESC);
CREATE INDEX rpc_audit_log_event_idx      ON public.rpc_audit_log (event);
CREATE INDEX rpc_audit_log_outcome_idx    ON public.rpc_audit_log (outcome);
CREATE INDEX rpc_audit_log_user_idx       ON public.rpc_audit_log (actor_user_id);
CREATE INDEX rpc_audit_log_entity_idx     ON public.rpc_audit_log (entity_type, entity_id);