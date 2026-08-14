-- Public API: per-user API keys + webhook delivery (pg_net trigger)
-- Applied 2026-08-14 via pooler psql.

create extension if not exists pg_net;

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Default',
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

alter table public.api_keys enable row level security;

create policy "own api keys" on public.api_keys
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.api_webhooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  events text[] not null default '{subscription.created,subscription.updated,subscription.deleted}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.api_webhooks enable row level security;

create policy "own webhooks" on public.api_webhooks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.dispatch_subscription_webhooks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wh record;
  payload jsonb;
begin
  for wh in
    select url, events
    from public.api_webhooks
    where user_id = coalesce(new.user_id, old.user_id) and active
  loop
    if tg_op = 'INSERT' and 'subscription.created' = any(wh.events) then
      payload := jsonb_build_object('event', 'subscription.created', 'subscription', row_to_json(new));
    elsif tg_op = 'UPDATE' and 'subscription.updated' = any(wh.events) then
      payload := jsonb_build_object('event', 'subscription.updated', 'subscription', row_to_json(new));
    elsif tg_op = 'DELETE' and 'subscription.deleted' = any(wh.events) then
      payload := jsonb_build_object('event', 'subscription.deleted', 'subscription', row_to_json(old));
    else
      continue;
    end if;
    perform net.http_post(url := wh.url, body := payload);
  end loop;
  return coalesce(new, old);
end;
$$;

-- Trigger functions are executable by default; this one is trigger-only.
revoke execute on function public.dispatch_subscription_webhooks() from public, anon, authenticated;

drop trigger if exists subscriptions_dispatch_webhooks on public.subscriptions;
create trigger subscriptions_dispatch_webhooks
  after insert or update or delete on public.subscriptions
  for each row execute function public.dispatch_subscription_webhooks();

-- Data API exposure for the new tables (authenticated role; service_role has all).
grant select, insert, update, delete on public.api_keys to authenticated;
grant select, insert, update, delete on public.api_webhooks to authenticated;
