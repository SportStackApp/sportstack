-- RevSports V2 source tables.
-- These tables keep scraped RevSports data separate from clean SportStack data.
-- Scrapers write source rows first; a later promotion step maps and writes to live tables.

CREATE TABLE IF NOT EXISTS public.source_scrape_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'revsports',
  scraper_name text NOT NULL,
  association_id uuid REFERENCES public.associations(id),
  association_name text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'success', 'failed', 'partial')),
  rows_found integer NOT NULL DEFAULT 0,
  rows_written integer NOT NULL DEFAULT 0,
  error_message text,
  source_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.source_revsports_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scrape_run_id uuid REFERENCES public.source_scrape_runs(id) ON DELETE SET NULL,
  association_name text NOT NULL,
  competition_name text,
  grade text,
  round_name text,
  round_number integer,
  match_url text NOT NULL,
  game_date date,
  game_time time,
  venue_name text,
  pitch_name text,
  home_team_name text,
  home_revsports_team_id text,
  away_team_name text,
  away_revsports_team_id text,
  home_score integer,
  away_score integer,
  umpire_1 text,
  umpire_2 text,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  scraped_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.source_revsports_match_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.source_revsports_matches(id) ON DELETE CASCADE,
  side text NOT NULL CHECK (side IN ('home', 'away')),
  club_name text,
  team_name text,
  team_label text,
  revsports_team_id text,
  team_url text,
  score integer,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  scraped_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.source_revsports_player_appearances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scrape_run_id uuid REFERENCES public.source_scrape_runs(id) ON DELETE SET NULL,
  match_id uuid REFERENCES public.source_revsports_matches(id) ON DELETE CASCADE,
  match_team_id uuid REFERENCES public.source_revsports_match_teams(id) ON DELETE SET NULL,
  appearance_key text NOT NULL,
  team_side text CHECK (team_side IN ('home', 'away')),
  club_name text,
  team_name text,
  revsports_team_id text,
  player_name text NOT NULL,
  revsports_player_id text,
  jersey text,
  attended boolean,
  is_goalkeeper boolean NOT NULL DEFAULT false,
  is_captain boolean NOT NULL DEFAULT false,
  is_fillin boolean NOT NULL DEFAULT false,
  is_removed boolean NOT NULL DEFAULT false,
  goals integer NOT NULL DEFAULT 0,
  green_cards integer NOT NULL DEFAULT 0,
  yellow_cards integer NOT NULL DEFAULT 0,
  red_cards integer NOT NULL DEFAULT 0,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  scraped_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.source_revsports_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scrape_run_id uuid REFERENCES public.source_scrape_runs(id) ON DELETE SET NULL,
  source_table text NOT NULL,
  source_row_id uuid,
  source_key text,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  change_type text NOT NULL DEFAULT 'updated'
    CHECK (change_type IN ('created', 'updated', 'removed', 'restored')),
  detected_at timestamptz NOT NULL DEFAULT now(),
  promoted_at timestamptz,
  promotion_status text NOT NULL DEFAULT 'not_reviewed'
    CHECK (promotion_status IN ('not_reviewed', 'approved', 'ignored', 'auto_promoted')),
  notes text
);

CREATE TABLE IF NOT EXISTS public.external_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'revsports',
  entity_type text NOT NULL
    CHECK (entity_type IN (
      'association',
      'competition',
      'grade',
      'club',
      'team',
      'venue',
      'pitch',
      'player',
      'umpire',
      'match'
    )),
  external_id text,
  external_name text NOT NULL,
  association_name text,
  competition_name text,
  grade text,
  club_name text,
  team_name text,
  source_url text,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'ignored')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.external_entity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_entity_id uuid NOT NULL REFERENCES public.external_entities(id) ON DELETE CASCADE,
  target_table text NOT NULL,
  target_id uuid,
  status text NOT NULL DEFAULT 'unmatched'
    CHECK (status IN ('unmatched', 'matched', 'ignored', 'needs_review')),
  confidence text NOT NULL DEFAULT 'manual'
    CHECK (confidence IN ('exact_id', 'name_context', 'manual', 'fallback')),
  matched_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  matched_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS source_revsports_matches_match_url_key
  ON public.source_revsports_matches (match_url);

CREATE UNIQUE INDEX IF NOT EXISTS source_revsports_match_teams_match_side_key
  ON public.source_revsports_match_teams (match_id, side);

CREATE UNIQUE INDEX IF NOT EXISTS source_revsports_player_appearances_key
  ON public.source_revsports_player_appearances (appearance_key);

CREATE UNIQUE INDEX IF NOT EXISTS external_entities_source_type_id_key
  ON public.external_entities (source, entity_type, external_id)
  WHERE external_id IS NOT NULL AND btrim(external_id) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS external_entities_source_type_context_key
  ON public.external_entities (
    source,
    entity_type,
    coalesce(association_name, ''),
    coalesce(competition_name, ''),
    coalesce(grade, ''),
    coalesce(club_name, ''),
    coalesce(team_name, ''),
    external_name
  )
  WHERE external_id IS NULL OR btrim(external_id) = '';

CREATE UNIQUE INDEX IF NOT EXISTS external_entity_links_entity_target_key
  ON public.external_entity_links (external_entity_id, target_table);

CREATE INDEX IF NOT EXISTS source_scrape_runs_source_scraper_idx
  ON public.source_scrape_runs (source, scraper_name, started_at DESC);

CREATE INDEX IF NOT EXISTS source_revsports_matches_association_idx
  ON public.source_revsports_matches (association_name, competition_name, grade);

CREATE INDEX IF NOT EXISTS source_revsports_match_teams_revsports_team_id_idx
  ON public.source_revsports_match_teams (revsports_team_id)
  WHERE revsports_team_id IS NOT NULL AND btrim(revsports_team_id) <> '';

CREATE INDEX IF NOT EXISTS source_revsports_player_appearances_player_id_idx
  ON public.source_revsports_player_appearances (revsports_player_id)
  WHERE revsports_player_id IS NOT NULL AND btrim(revsports_player_id) <> '';

CREATE INDEX IF NOT EXISTS source_revsports_change_log_source_key_idx
  ON public.source_revsports_change_log (source_table, source_key, detected_at DESC);

CREATE INDEX IF NOT EXISTS external_entities_lookup_idx
  ON public.external_entities (source, entity_type, external_name);

CREATE INDEX IF NOT EXISTS external_entity_links_status_idx
  ON public.external_entity_links (status, target_table);

ALTER TABLE public.source_scrape_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_revsports_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_revsports_match_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_revsports_player_appearances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_revsports_change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_entity_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view source scrape runs"
  ON public.source_scrape_runs FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Admins can view source revsports matches"
  ON public.source_revsports_matches FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Admins can view source revsports match teams"
  ON public.source_revsports_match_teams FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Admins can view source revsports player appearances"
  ON public.source_revsports_player_appearances FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Admins can view source revsports change log"
  ON public.source_revsports_change_log FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Admins can view external entities"
  ON public.external_entities FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Admins can view external entity links"
  ON public.external_entity_links FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Admins can manage external entity links"
  ON public.external_entity_links FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE TRIGGER update_source_revsports_matches_updated_at
  BEFORE UPDATE ON public.source_revsports_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_source_revsports_match_teams_updated_at
  BEFORE UPDATE ON public.source_revsports_match_teams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_source_revsports_player_appearances_updated_at
  BEFORE UPDATE ON public.source_revsports_player_appearances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_external_entities_updated_at
  BEFORE UPDATE ON public.external_entities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_external_entity_links_updated_at
  BEFORE UPDATE ON public.external_entity_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
