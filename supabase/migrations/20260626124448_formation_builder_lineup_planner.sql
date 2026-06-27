-- Formation Builder + Fixture Line-up Planner
-- Adds formation-position templates and a new fixture-line-up structure
-- without dropping or changing the existing public.lineups table.

-- Existing formations table: add pitch-boundary and display metadata.
ALTER TABLE public.formations
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS pitch_boundary_x numeric(6,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pitch_boundary_y numeric(6,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pitch_boundary_width numeric(6,3) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS pitch_boundary_height numeric(6,3) NOT NULL DEFAULT 100;

ALTER TABLE public.formations
  ADD CONSTRAINT formations_pitch_boundary_x_check
    CHECK (pitch_boundary_x >= 0 AND pitch_boundary_x <= 100) NOT VALID,
  ADD CONSTRAINT formations_pitch_boundary_y_check
    CHECK (pitch_boundary_y >= 0 AND pitch_boundary_y <= 100) NOT VALID,
  ADD CONSTRAINT formations_pitch_boundary_width_check
    CHECK (pitch_boundary_width > 0 AND pitch_boundary_width <= 100) NOT VALID,
  ADD CONSTRAINT formations_pitch_boundary_height_check
    CHECK (pitch_boundary_height > 0 AND pitch_boundary_height <= 100) NOT VALID,
  ADD CONSTRAINT formations_pitch_boundary_box_check
    CHECK (
      pitch_boundary_x + pitch_boundary_width <= 100
      AND pitch_boundary_y + pitch_boundary_height <= 100
    ) NOT VALID;

-- Standard and custom icons used by formation positions.
CREATE TABLE IF NOT EXISTS public.formation_icons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image_url text,
  lucide_icon text,
  is_custom boolean NOT NULL DEFAULT false,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT formation_icons_asset_check
    CHECK ((image_url IS NOT NULL) OR (lucide_icon IS NOT NULL))
);

-- Position markers placed on a reusable formation template.
CREATE TABLE IF NOT EXISTS public.formation_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_id uuid NOT NULL REFERENCES public.formations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  icon_id uuid REFERENCES public.formation_icons(id) ON DELETE SET NULL,
  zone text,
  grid_x integer NOT NULL,
  grid_y integer NOT NULL,
  x_percent numeric(6,3) NOT NULL,
  y_percent numeric(6,3) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_starting_slot boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (formation_id, grid_x, grid_y),
  CONSTRAINT formation_positions_grid_x_check CHECK (grid_x >= 0),
  CONSTRAINT formation_positions_grid_y_check CHECK (grid_y >= 0),
  CONSTRAINT formation_positions_x_percent_check CHECK (x_percent >= 0 AND x_percent <= 100),
  CONSTRAINT formation_positions_y_percent_check CHECK (y_percent >= 0 AND y_percent <= 100)
);

-- Personal library controls. These do not change shared template visibility.
CREATE TABLE IF NOT EXISTS public.user_formation_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  formation_id uuid NOT NULL REFERENCES public.formations(id) ON DELETE CASCADE,
  is_favourite boolean NOT NULL DEFAULT false,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, formation_id)
);

-- One formation selected for one fixture and team.
CREATE TABLE IF NOT EXISTS public.fixture_lineups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id uuid NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  formation_id uuid REFERENCES public.formations(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fixture_id, team_id)
);

-- Player assignments for a fixture line-up. Bench rows have no formation position.
CREATE TABLE IF NOT EXISTS public.fixture_lineup_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_lineup_id uuid NOT NULL REFERENCES public.fixture_lineups(id) ON DELETE CASCADE,
  formation_position_id uuid REFERENCES public.formation_positions(id) ON DELETE SET NULL,
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_starting boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fixture_lineup_id, player_id)
);

CREATE INDEX IF NOT EXISTS formation_positions_formation_id_idx
  ON public.formation_positions (formation_id, sort_order);
CREATE INDEX IF NOT EXISTS user_formation_preferences_user_id_idx
  ON public.user_formation_preferences (user_id);
CREATE INDEX IF NOT EXISTS fixture_lineups_fixture_team_idx
  ON public.fixture_lineups (fixture_id, team_id);
CREATE INDEX IF NOT EXISTS fixture_lineup_assignments_lineup_idx
  ON public.fixture_lineup_assignments (fixture_lineup_id, sort_order);
CREATE INDEX IF NOT EXISTS fixture_lineup_assignments_player_idx
  ON public.fixture_lineup_assignments (player_id);

DROP TRIGGER IF EXISTS update_formation_positions_updated_at ON public.formation_positions;
CREATE TRIGGER update_formation_positions_updated_at
BEFORE UPDATE ON public.formation_positions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_formation_preferences_updated_at ON public.user_formation_preferences;
CREATE TRIGGER update_user_formation_preferences_updated_at
BEFORE UPDATE ON public.user_formation_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_fixture_lineups_updated_at ON public.fixture_lineups;
CREATE TRIGGER update_fixture_lineups_updated_at
BEFORE UPDATE ON public.fixture_lineups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_fixture_lineup_assignments_updated_at ON public.fixture_lineup_assignments;
CREATE TRIGGER update_fixture_lineup_assignments_updated_at
BEFORE UPDATE ON public.fixture_lineup_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.formation_icons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formation_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_formation_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixture_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixture_lineup_assignments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.formation_icons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formation_positions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_formation_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixture_lineups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixture_lineup_assignments TO authenticated;

-- Scoped formation library visibility. This replaces the previous broad
-- "Anyone can view formations" policy.
DROP POLICY IF EXISTS "Anyone can view formations" ON public.formations;
DROP POLICY IF EXISTS "Formation scoped select" ON public.formations;
CREATE POLICY "Formation scoped select"
ON public.formations
FOR SELECT
TO authenticated
USING (
  public.is_super_admin()
  OR owner_scope = 'SUPER_ADMIN'::public.formation_owner_scope
  OR (
    owner_scope = 'ASSOCIATION'::public.formation_owner_scope
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (select auth.uid())
        AND (
          ur.role = 'SUPER_ADMIN'::public.user_role_enum
          OR (ur.role = 'ASSOCIATION_ADMIN'::public.user_role_enum AND ur.association_id = formations.association_id)
          OR EXISTS (
            SELECT 1
            FROM public.clubs c
            JOIN public.teams t ON t.club_id = c.id
            WHERE c.association_id = formations.association_id
              AND (
                (ur.role = 'CLUB_ADMIN'::public.user_role_enum AND ur.club_id = c.id)
                OR (ur.role = ANY (ARRAY['TEAM_MANAGER'::public.user_role_enum, 'COACH'::public.user_role_enum]) AND ur.team_id = t.id)
              )
          )
        )
    )
  )
  OR (
    owner_scope = 'CLUB'::public.formation_owner_scope
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      LEFT JOIN public.teams t ON t.id = ur.team_id
      WHERE ur.user_id = (select auth.uid())
        AND (
          (ur.role = 'CLUB_ADMIN'::public.user_role_enum AND ur.club_id = formations.club_id)
          OR (ur.role = ANY (ARRAY['TEAM_MANAGER'::public.user_role_enum, 'COACH'::public.user_role_enum]) AND t.club_id = formations.club_id)
          OR (ur.role = 'ASSOCIATION_ADMIN'::public.user_role_enum AND EXISTS (
            SELECT 1 FROM public.clubs c WHERE c.id = formations.club_id AND c.association_id = ur.association_id
          ))
        )
    )
  )
  OR (
    owner_scope = 'TEAM'::public.formation_owner_scope
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.teams t ON t.id = formations.team_id
      JOIN public.clubs c ON c.id = t.club_id
      WHERE ur.user_id = (select auth.uid())
        AND (
          (ur.role = ANY (ARRAY['TEAM_MANAGER'::public.user_role_enum, 'COACH'::public.user_role_enum]) AND ur.team_id = formations.team_id)
          OR (ur.role = 'CLUB_ADMIN'::public.user_role_enum AND ur.club_id = c.id)
          OR (ur.role = 'ASSOCIATION_ADMIN'::public.user_role_enum AND ur.association_id = c.association_id)
        )
    )
  )
);

-- Child rows are visible only when the parent formation is visible.
DROP POLICY IF EXISTS "Formation positions scoped select" ON public.formation_positions;
CREATE POLICY "Formation positions scoped select"
ON public.formation_positions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.formations f
    WHERE f.id = formation_positions.formation_id
  )
);

DROP POLICY IF EXISTS "Formation positions owner manage" ON public.formation_positions;
CREATE POLICY "Formation positions owner manage"
ON public.formation_positions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.formations f
    WHERE f.id = formation_positions.formation_id
      AND (
        public.is_super_admin()
        OR (f.owner_scope = 'ASSOCIATION'::public.formation_owner_scope AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = (select auth.uid())
            AND ur.role = 'ASSOCIATION_ADMIN'::public.user_role_enum
            AND ur.association_id = f.association_id
        ))
        OR (f.owner_scope = 'CLUB'::public.formation_owner_scope AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = (select auth.uid())
            AND ur.role = 'CLUB_ADMIN'::public.user_role_enum
            AND ur.club_id = f.club_id
        ))
        OR (f.owner_scope = 'TEAM'::public.formation_owner_scope AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = (select auth.uid())
            AND ur.role = ANY (ARRAY['TEAM_MANAGER'::public.user_role_enum, 'COACH'::public.user_role_enum])
            AND ur.team_id = f.team_id
        ))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.formations f
    WHERE f.id = formation_positions.formation_id
      AND (
        public.is_super_admin()
        OR (f.owner_scope = 'ASSOCIATION'::public.formation_owner_scope AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = (select auth.uid())
            AND ur.role = 'ASSOCIATION_ADMIN'::public.user_role_enum
            AND ur.association_id = f.association_id
        ))
        OR (f.owner_scope = 'CLUB'::public.formation_owner_scope AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = (select auth.uid())
            AND ur.role = 'CLUB_ADMIN'::public.user_role_enum
            AND ur.club_id = f.club_id
        ))
        OR (f.owner_scope = 'TEAM'::public.formation_owner_scope AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = (select auth.uid())
            AND ur.role = ANY (ARRAY['TEAM_MANAGER'::public.user_role_enum, 'COACH'::public.user_role_enum])
            AND ur.team_id = f.team_id
        ))
      )
  )
);

DROP POLICY IF EXISTS "Formation icons select" ON public.formation_icons;
CREATE POLICY "Formation icons select"
ON public.formation_icons
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Formation icons own custom insert" ON public.formation_icons;
CREATE POLICY "Formation icons own custom insert"
ON public.formation_icons
FOR INSERT
TO authenticated
WITH CHECK (
  (is_custom = true AND uploaded_by = (select auth.uid()))
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Formation icons own custom update" ON public.formation_icons;
CREATE POLICY "Formation icons own custom update"
ON public.formation_icons
FOR UPDATE
TO authenticated
USING (uploaded_by = (select auth.uid()) OR public.is_super_admin())
WITH CHECK (uploaded_by = (select auth.uid()) OR public.is_super_admin());

DROP POLICY IF EXISTS "Formation icons own custom delete" ON public.formation_icons;
CREATE POLICY "Formation icons own custom delete"
ON public.formation_icons
FOR DELETE
TO authenticated
USING (uploaded_by = (select auth.uid()) OR public.is_super_admin());

DROP POLICY IF EXISTS "Users manage own formation preferences" ON public.user_formation_preferences;
CREATE POLICY "Users manage own formation preferences"
ON public.user_formation_preferences
FOR ALL
TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Fixture lineups scoped select" ON public.fixture_lineups;
CREATE POLICY "Fixture lineups scoped select"
ON public.fixture_lineups
FOR SELECT
TO authenticated
USING (
  public.is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.team_memberships tm
    WHERE tm.team_id = fixture_lineups.team_id
      AND tm.user_id = (select auth.uid())
      AND tm.status = 'ACTIVE'
  )
  OR EXISTS (
    SELECT 1
    FROM public.teams t
    JOIN public.clubs c ON c.id = t.club_id
    JOIN public.user_roles ur ON ur.user_id = (select auth.uid())
    WHERE t.id = fixture_lineups.team_id
      AND (
        (ur.role = 'ASSOCIATION_ADMIN'::public.user_role_enum AND ur.association_id = c.association_id)
        OR (ur.role = 'CLUB_ADMIN'::public.user_role_enum AND ur.club_id = c.id)
        OR (ur.role = ANY (ARRAY['TEAM_MANAGER'::public.user_role_enum, 'COACH'::public.user_role_enum]) AND ur.team_id = t.id)
      )
  )
);

DROP POLICY IF EXISTS "Fixture lineups scoped manage" ON public.fixture_lineups;
CREATE POLICY "Fixture lineups scoped manage"
ON public.fixture_lineups
FOR ALL
TO authenticated
USING (
  public.is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.teams t
    JOIN public.clubs c ON c.id = t.club_id
    JOIN public.user_roles ur ON ur.user_id = (select auth.uid())
    WHERE t.id = fixture_lineups.team_id
      AND (
        (ur.role = 'ASSOCIATION_ADMIN'::public.user_role_enum AND ur.association_id = c.association_id)
        OR (ur.role = 'CLUB_ADMIN'::public.user_role_enum AND ur.club_id = c.id)
        OR (ur.role = ANY (ARRAY['TEAM_MANAGER'::public.user_role_enum, 'COACH'::public.user_role_enum]) AND ur.team_id = t.id)
      )
  )
)
WITH CHECK (
  public.is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.teams t
    JOIN public.clubs c ON c.id = t.club_id
    JOIN public.user_roles ur ON ur.user_id = (select auth.uid())
    WHERE t.id = fixture_lineups.team_id
      AND (
        (ur.role = 'ASSOCIATION_ADMIN'::public.user_role_enum AND ur.association_id = c.association_id)
        OR (ur.role = 'CLUB_ADMIN'::public.user_role_enum AND ur.club_id = c.id)
        OR (ur.role = ANY (ARRAY['TEAM_MANAGER'::public.user_role_enum, 'COACH'::public.user_role_enum]) AND ur.team_id = t.id)
      )
  )
);

DROP POLICY IF EXISTS "Fixture lineup assignments scoped select" ON public.fixture_lineup_assignments;
CREATE POLICY "Fixture lineup assignments scoped select"
ON public.fixture_lineup_assignments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.fixture_lineups fl
    WHERE fl.id = fixture_lineup_assignments.fixture_lineup_id
  )
);

DROP POLICY IF EXISTS "Fixture lineup assignments scoped manage" ON public.fixture_lineup_assignments;
CREATE POLICY "Fixture lineup assignments scoped manage"
ON public.fixture_lineup_assignments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.fixture_lineups fl
    JOIN public.teams t ON t.id = fl.team_id
    JOIN public.clubs c ON c.id = t.club_id
    JOIN public.user_roles ur ON ur.user_id = (select auth.uid())
    WHERE fl.id = fixture_lineup_assignments.fixture_lineup_id
      AND (
        public.is_super_admin()
        OR (ur.role = 'ASSOCIATION_ADMIN'::public.user_role_enum AND ur.association_id = c.association_id)
        OR (ur.role = 'CLUB_ADMIN'::public.user_role_enum AND ur.club_id = c.id)
        OR (ur.role = ANY (ARRAY['TEAM_MANAGER'::public.user_role_enum, 'COACH'::public.user_role_enum]) AND ur.team_id = t.id)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.fixture_lineups fl
    JOIN public.teams t ON t.id = fl.team_id
    JOIN public.clubs c ON c.id = t.club_id
    JOIN public.user_roles ur ON ur.user_id = (select auth.uid())
    WHERE fl.id = fixture_lineup_assignments.fixture_lineup_id
      AND (
        public.is_super_admin()
        OR (ur.role = 'ASSOCIATION_ADMIN'::public.user_role_enum AND ur.association_id = c.association_id)
        OR (ur.role = 'CLUB_ADMIN'::public.user_role_enum AND ur.club_id = c.id)
        OR (ur.role = ANY (ARRAY['TEAM_MANAGER'::public.user_role_enum, 'COACH'::public.user_role_enum]) AND ur.team_id = t.id)
      )
  )
);

-- Keep the legacy public.lineups table usable while new code and old code
-- overlap. This table remains for MVP voting and coaching history compatibility.
DROP POLICY IF EXISTS "lineups_read" ON public.lineups;
DROP POLICY IF EXISTS "lineups_write" ON public.lineups;
DROP POLICY IF EXISTS "Legacy lineups scoped select" ON public.lineups;
CREATE POLICY "Legacy lineups scoped select"
ON public.lineups
FOR SELECT
TO authenticated
USING (
  public.is_super_admin()
  OR player_id = (select auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.team_memberships tm
    WHERE tm.team_id = lineups.team_id
      AND tm.user_id = (select auth.uid())
      AND tm.status = 'ACTIVE'
  )
  OR EXISTS (
    SELECT 1
    FROM public.teams t
    JOIN public.clubs c ON c.id = t.club_id
    JOIN public.user_roles ur ON ur.user_id = (select auth.uid())
    WHERE t.id = lineups.team_id
      AND (
        (ur.role = 'ASSOCIATION_ADMIN'::public.user_role_enum AND ur.association_id = c.association_id)
        OR (ur.role = 'CLUB_ADMIN'::public.user_role_enum AND ur.club_id = c.id)
        OR (ur.role = ANY (ARRAY['TEAM_MANAGER'::public.user_role_enum, 'COACH'::public.user_role_enum]) AND ur.team_id = t.id)
      )
  )
);

DROP POLICY IF EXISTS "Legacy lineups scoped manage" ON public.lineups;
CREATE POLICY "Legacy lineups scoped manage"
ON public.lineups
FOR ALL
TO authenticated
USING (
  public.is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.teams t
    JOIN public.clubs c ON c.id = t.club_id
    JOIN public.user_roles ur ON ur.user_id = (select auth.uid())
    WHERE t.id = lineups.team_id
      AND (
        (ur.role = 'ASSOCIATION_ADMIN'::public.user_role_enum AND ur.association_id = c.association_id)
        OR (ur.role = 'CLUB_ADMIN'::public.user_role_enum AND ur.club_id = c.id)
        OR (ur.role = ANY (ARRAY['TEAM_MANAGER'::public.user_role_enum, 'COACH'::public.user_role_enum]) AND ur.team_id = t.id)
      )
  )
)
WITH CHECK (
  public.is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.teams t
    JOIN public.clubs c ON c.id = t.club_id
    JOIN public.user_roles ur ON ur.user_id = (select auth.uid())
    WHERE t.id = lineups.team_id
      AND (
        (ur.role = 'ASSOCIATION_ADMIN'::public.user_role_enum AND ur.association_id = c.association_id)
        OR (ur.role = 'CLUB_ADMIN'::public.user_role_enum AND ur.club_id = c.id)
        OR (ur.role = ANY (ARRAY['TEAM_MANAGER'::public.user_role_enum, 'COACH'::public.user_role_enum]) AND ur.team_id = t.id)
      )
  )
);

-- Formation media storage. Files are stored below the uploading user's ID.
INSERT INTO storage.buckets (id, name, public)
VALUES ('formation-assets', 'formation-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Formation assets public read" ON storage.objects;
CREATE POLICY "Formation assets public read"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'formation-assets');

DROP POLICY IF EXISTS "Formation assets own upload" ON storage.objects;
CREATE POLICY "Formation assets own upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'formation-assets'
  AND (storage.foldername(name))[1] = (select auth.uid())::text
);

DROP POLICY IF EXISTS "Formation assets own update" ON storage.objects;
CREATE POLICY "Formation assets own update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'formation-assets'
  AND (storage.foldername(name))[1] = (select auth.uid())::text
)
WITH CHECK (
  bucket_id = 'formation-assets'
  AND (storage.foldername(name))[1] = (select auth.uid())::text
);

DROP POLICY IF EXISTS "Formation assets own delete" ON storage.objects;
CREATE POLICY "Formation assets own delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'formation-assets'
  AND (storage.foldername(name))[1] = (select auth.uid())::text
);

INSERT INTO public.formation_icons (name, lucide_icon, is_custom)
VALUES
  ('Player', 'CircleUserRound', false),
  ('Goalkeeper', 'Shield', false),
  ('Captain', 'Star', false)
ON CONFLICT DO NOTHING;
