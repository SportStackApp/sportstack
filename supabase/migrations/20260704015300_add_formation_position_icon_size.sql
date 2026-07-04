-- Saves the display size for position markers on each reusable formation.
ALTER TABLE public.formations
  ADD COLUMN IF NOT EXISTS position_icon_size integer NOT NULL DEFAULT 40;

ALTER TABLE public.formations
  DROP CONSTRAINT IF EXISTS formations_position_icon_size_check;

ALTER TABLE public.formations
  ADD CONSTRAINT formations_position_icon_size_check
    CHECK (position_icon_size >= 24 AND position_icon_size <= 72) NOT VALID;
