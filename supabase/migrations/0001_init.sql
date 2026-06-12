-- ============================================================================
-- SmartPlan — Initial schema (Phase 1)
-- Source of truth: ../SmartPlan_Engineering_Master_Document_v1.3.txt
-- Sections: §2 (schema), §2 RPCs (recalculate_job_times, increment_plan_count),
--           §5.3 (three required partial indexes)
-- Every table has RLS enabled with policy: user_id = auth.uid().
-- TABLES PERMANENTLY EXCLUDED per spec: opportunities, user_resume_embeddings,
--                                       opportunity_saves.
-- ============================================================================

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- profiles  (§2 + v1.3 timestamp columns)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id                       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name             text,
  major                    text,
  university               text,
  year                     int CHECK (year BETWEEN 1 AND 5),
  timezone                 text NOT NULL DEFAULT 'UTC',
  wake_time                time NOT NULL DEFAULT '07:30',
  sleep_time               time NOT NULL DEFAULT '23:00',
  next_plan_gen_at         timestamptz,
  next_pattern_analyse_at  timestamptz,
  next_week_reeval_at      timestamptz,
  daily_hour_cap           int  NOT NULL DEFAULT 8 CHECK (daily_hour_cap BETWEEN 2 AND 10),
  peak_hours_start         time NOT NULL DEFAULT '10:00',
  peak_hours_end           time NOT NULL DEFAULT '13:00',
  block_duration_mins      int  NOT NULL DEFAULT 45 CHECK (block_duration_mins IN (25,45,90,120)),
  time_multiplier          float NOT NULL DEFAULT 1.3,
  goals                    text[] NOT NULL DEFAULT '{}',
  subjects                 text[] NOT NULL DEFAULT '{}',
  ai_data_consent          bool NOT NULL DEFAULT true,
  onboarding_done          bool NOT NULL DEFAULT false,
  fcm_token                text,
  created_at               timestamptz NOT NULL DEFAULT now()
);

-- Auto-create profile row when an auth.users row appears
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- RPC: recalculate_job_times   (§2 — verbatim from spec)
-- Pre-computes next UTC timestamps from sleep_time + IANA timezone.
-- Called: signup, sleep_time change, after every plan generation.
-- ============================================================================
CREATE OR REPLACE FUNCTION recalculate_job_times(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_sleep_time time;
  v_timezone   text;
  v_base_utc   timestamptz;
BEGIN
  SELECT sleep_time, timezone
  INTO v_sleep_time, v_timezone
  FROM profiles WHERE id = p_user_id;

  -- Build the next occurrence of sleep_time in user local timezone
  -- If sleep_time has already passed today, schedule for tomorrow
  v_base_utc := (
    CASE
      WHEN (NOW() AT TIME ZONE v_timezone)::time < v_sleep_time
      THEN (CURRENT_DATE AT TIME ZONE v_timezone) + v_sleep_time
      ELSE (CURRENT_DATE + 1 AT TIME ZONE v_timezone) + v_sleep_time
    END
  );

  UPDATE profiles SET
    next_plan_gen_at        = v_base_utc + INTERVAL '30 minutes',
    next_pattern_analyse_at = v_base_utc + INTERVAL '45 minutes',
    next_week_reeval_at     = v_base_utc + INTERVAL '60 minutes'
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- plan_generation_counts  + increment_plan_count RPC  (§2 — verbatim)
-- 30 generations / user / day, race-condition safe.
-- ============================================================================
CREATE TABLE IF NOT EXISTS plan_generation_counts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date    date NOT NULL,
  count   int  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

CREATE OR REPLACE FUNCTION increment_plan_count(p_user_id uuid, p_date date)
RETURNS int AS $$
  INSERT INTO plan_generation_counts (user_id, date, count) VALUES (p_user_id, p_date, 1)
  ON CONFLICT (user_id, date) DO UPDATE
    SET count = plan_generation_counts.count + 1
  RETURNING count;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================================
-- integrations  (§2)
-- ============================================================================
CREATE TABLE IF NOT EXISTS integrations (
  user_id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  github_username    text,
  leetcode_username  text,
  codeforces_handle  text,
  last_synced_at     timestamptz
);

-- ============================================================================
-- tasks  (§2)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  subject         text,
  estimated_hours float,
  actual_hours    float,
  deadline        timestamptz,
  priority        text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  type            text NOT NULL DEFAULT 'deep_work'
                    CHECK (type IN ('deep_work','light_work','admin','social','health','personal')),
  is_fixed        bool NOT NULL DEFAULT false,
  fixed_time      time,
  status          text NOT NULL DEFAULT 'inbox'
                    CHECK (status IN ('inbox','scheduled','completed','deferred')),
  ai_categorised  bool NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks (user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_user_deadline ON tasks (user_id, deadline);

-- ============================================================================
-- check_ins  (§2)
-- ============================================================================
CREATE TABLE IF NOT EXISTS check_ins (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date         date NOT NULL,

  top_priority text,
  blocker      text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

-- ============================================================================
-- day_plans  (§2)
-- ============================================================================
CREATE TABLE IF NOT EXISTS day_plans (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date                  date NOT NULL,
  daily_insight         text,

  estimated_focus_hours float,
  deferred_tasks        jsonb NOT NULL DEFAULT '[]'::jsonb,
  tips                  jsonb NOT NULL DEFAULT '[]'::jsonb,
  provider_used         text,
  context_hash          text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_day_plans_user_date ON day_plans (user_id, date DESC);

-- ============================================================================
-- time_blocks  (§2)
-- ============================================================================
CREATE TABLE IF NOT EXISTS time_blocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_plan_id uuid NOT NULL REFERENCES day_plans(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time  time NOT NULL,
  end_time    time NOT NULL,
  title       text NOT NULL,
  type        text NOT NULL CHECK (type IN ('deep_work','light_work','admin','break','fixed_event','social','health','personal')),
  priority    text NOT NULL DEFAULT 'none' CHECK (priority IN ('high','medium','low','none')),
  rationale   text NOT NULL,
  task_id     uuid REFERENCES tasks(id) ON DELETE SET NULL,
  is_fixed    bool NOT NULL DEFAULT false,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','skipped')),
  sort_index  int  NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_time_blocks_plan ON time_blocks (day_plan_id, sort_index);

-- ============================================================================
-- week_plans  (§2 — unchanged)
-- ============================================================================
CREATE TABLE IF NOT EXISTS week_plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start  date NOT NULL,
  skeleton    jsonb NOT NULL DEFAULT '{}'::jsonb,
  load_score  float,
  insight     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

-- ============================================================================
-- behavior_logs  (§2 — only written when ai_data_consent = true)
-- ============================================================================
CREATE TABLE IF NOT EXISTS behavior_logs (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_behavior_logs_user_created ON behavior_logs (user_id, created_at DESC);

-- ============================================================================
-- fixed_events  (§2 — recurring weekly classes, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fixed_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  day_of_week int CHECK (day_of_week BETWEEN 0 AND 6),
  start_time  time NOT NULL,
  end_time    time NOT NULL,
  subject     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fixed_events_user_day ON fixed_events (user_id, day_of_week);

-- ============================================================================
-- user_insights  (§2 — written by PatternAnalyser, Phase 2)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_insights (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  insights    jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- week_templates  (§2)
-- ============================================================================
CREATE TABLE IF NOT EXISTS week_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  template   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- analytics_snapshots  (§2)
-- ============================================================================
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start           date NOT NULL,
  completion_rate      float NOT NULL DEFAULT 0,
  total_focus_hours    float NOT NULL DEFAULT 0,
  planned_focus_hours  float NOT NULL DEFAULT 0,
  external_stats       jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_review_text       text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

-- ============================================================================
-- §5.3 — Three required partial indexes for the UTC Timestamp Queue cron
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_next_plan_gen
  ON profiles (next_plan_gen_at) WHERE onboarding_done = true;

CREATE INDEX IF NOT EXISTS idx_profiles_next_pattern
  ON profiles (next_pattern_analyse_at) WHERE ai_data_consent = true;

CREATE INDEX IF NOT EXISTS idx_profiles_next_week_reeval
  ON profiles (next_week_reeval_at);

-- ============================================================================
-- ROW LEVEL SECURITY — every table, every operation: user_id = auth.uid()
-- ============================================================================
ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_generation_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins              ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_plans              ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_blocks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE week_plans             ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavior_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_insights          ENABLE ROW LEVEL SECURITY;
ALTER TABLE week_templates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_snapshots    ENABLE ROW LEVEL SECURITY;

-- Macro helper: 4 CRUD policies per table where col holds the owner id.
-- (Supabase SQL editor doesn't support DO $$ macros mid-file gracefully for
-- this, so we inline.)

-- profiles uses id = auth.uid()
CREATE POLICY profiles_select ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- All other tables: user_id = auth.uid()
CREATE POLICY pgc_all    ON plan_generation_counts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY integ_all  ON integrations           FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY tasks_all  ON tasks                  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY ci_all     ON check_ins              FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY dp_all     ON day_plans              FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY tb_all     ON time_blocks            FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY wp_all     ON week_plans             FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY bl_all     ON behavior_logs          FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY fe_all     ON fixed_events           FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY ui_all     ON user_insights          FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY wt_all     ON week_templates         FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY as_all     ON analytics_snapshots    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
