ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS url text,
  ADD COLUMN IF NOT EXISTS plan text;