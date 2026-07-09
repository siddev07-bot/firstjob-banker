
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS quiz_stats jsonb NOT NULL DEFAULT '{}'::jsonb;

DROP TABLE IF EXISTS public.daily_missions;
