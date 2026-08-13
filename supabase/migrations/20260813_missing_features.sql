-- Missing-feature schema (applied 2026-08-13 via psql pooler; tracker not used).
-- 1) subscription status + trial end tracking
-- 2) per-category monthly budget (USD)
-- 3) price change history log

alter table public.subscriptions
  add column if not exists status text not null default 'active'
    check (status in ('active', 'trialing', 'paused', 'cancelled')),
  add column if not exists trial_ends date;

alter table public.categories
  add column if not exists budget numeric(10, 2);

create table if not exists public.price_history (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users on delete cascade,
  subscription_id uuid not null references public.subscriptions on delete cascade,
  cost numeric(10, 2) not null,
  currency text not null default 'USD',
  changed_at timestamptz not null default now()
);

alter table public.price_history enable row level security;
drop policy if exists "Users manage own price history" on public.price_history;
create policy "Users manage own price history"
  on public.price_history
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.price_history to authenticated;
grant all on public.price_history to service_role;
create index if not exists price_history_subscription_idx on public.price_history (subscription_id);
