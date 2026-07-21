create table if not exists public.observability_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('error','pageview','event','vital')),
  name text not null,
  url text,
  path text,
  session_id text,
  user_id uuid references auth.users(id) on delete set null,
  is_admin boolean default false,
  duration_ms numeric,
  value numeric,
  message text,
  stack text,
  meta jsonb not null default '{}'::jsonb,
  user_agent text,
  created_at timestamptz not null default now()
);
grant select, insert on public.observability_events to authenticated;
grant select, insert on public.observability_events to anon;
grant all on public.observability_events to service_role;
alter table public.observability_events enable row level security;
create policy "insert own telemetry"
  on public.observability_events for insert
  to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
create policy "admins read telemetry"
  on public.observability_events for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create index if not exists idx_obs_created on public.observability_events (created_at desc);
create index if not exists idx_obs_kind_created on public.observability_events (kind, created_at desc);
create index if not exists idx_obs_name_created on public.observability_events (name, created_at desc);
create index if not exists idx_obs_session on public.observability_events (session_id, created_at);