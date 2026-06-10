
CREATE TABLE public.daily_missions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  mission_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'UTC')::date),
  title text NOT NULL,
  source_text text NOT NULL,
  summary text DEFAULT '',
  key_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  difficulty text DEFAULT '',
  topic text DEFAULT '',
  vocabulary jsonb NOT NULL DEFAULT '[]'::jsonb,
  rc_prelims jsonb NOT NULL DEFAULT '[]'::jsonb,
  rc_mains jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_detection jsonb NOT NULL DEFAULT '[]'::jsonb,
  cloze jsonb NOT NULL DEFAULT '[]'::jsonb,
  sentence_improvement jsonb NOT NULL DEFAULT '[]'::jsonb,
  grammar_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_missions TO authenticated;
GRANT ALL ON public.daily_missions TO service_role;

ALTER TABLE public.daily_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own missions" ON public.daily_missions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX daily_missions_user_date_idx ON public.daily_missions (user_id, mission_date DESC);

CREATE TRIGGER update_daily_missions_updated_at
  BEFORE UPDATE ON public.daily_missions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
