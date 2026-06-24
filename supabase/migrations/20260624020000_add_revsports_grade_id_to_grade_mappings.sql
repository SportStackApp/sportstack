-- Add RevSports numeric grade ID to the grade mapping table and backfill it
-- from IDs already captured in revsports_players. Enables matching grades by
-- stable ID instead of fragile name text (prevents silent name-clash mismaps,
-- e.g. "Women" existing in both Sunraysia and Wimmera with different IDs).

ALTER TABLE public.revsports_grade_mappings
  ADD COLUMN IF NOT EXISTS revsports_grade_id text;

UPDATE public.revsports_grade_mappings m
SET revsports_grade_id = sub.gid
FROM (
  SELECT DISTINCT lower(trim(association)) AS assoc, lower(trim(grade)) AS grade, revsports_grade_id AS gid
  FROM revsports_players
  WHERE revsports_grade_id IS NOT NULL AND revsports_grade_id <> '' AND grade IS NOT NULL
) sub
WHERE lower(trim(m.association)) = sub.assoc
  AND lower(trim(m.revsports_grade)) = sub.grade;
