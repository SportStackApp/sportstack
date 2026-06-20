-- Keep club and team names separate on source match rows.

ALTER TABLE public.source_revsports_matches
  ADD COLUMN IF NOT EXISTS home_club_name text,
  ADD COLUMN IF NOT EXISTS away_club_name text;

