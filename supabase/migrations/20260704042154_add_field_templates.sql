-- Phase 1 Formation Builder split.
-- Adds reusable field templates without changing existing line-up or position data.

CREATE TABLE IF NOT EXISTS public.field_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  sport text NOT NULL DEFAULT 'field_hockey',
  owner_scope public.formation_owner_scope NOT NULL,
  association_id uuid REFERENCES public.associations(id) ON DELETE CASCADE,
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  background_image_url text,
  grid_rows integer NOT NULL DEFAULT 10,
  grid_columns integer NOT NULL DEFAULT 14,
  pitch_boundary_x numeric(6,3) NOT NULL DEFAULT 0,
  pitch_boundary_y numeric(6,3) NOT NULL DEFAULT 0,
  pitch_boundary_width numeric(6,3) NOT NULL DEFAULT 100,
  pitch_boundary_height numeric(6,3) NOT NULL DEFAULT 100,
  default_icon_id uuid REFERENCES public.formation_icons(id) ON DELETE SET NULL,
  position_icon_size integer NOT NULL DEFAULT 40,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT field_templates_grid_rows_check CHECK (grid_rows > 0),
  CONSTRAINT field_templates_grid_columns_check CHECK (grid_columns > 0),
  CONSTRAINT field_templates_pitch_boundary_x_check CHECK (pitch_boundary_x >= 0 AND pitch_boundary_x <= 100),
  CONSTRAINT field_templates_pitch_boundary_y_check CHECK (pitch_boundary_y >= 0 AND pitch_boundary_y <= 100),
  CONSTRAINT field_templates_pitch_boundary_width_check CHECK (pitch_boundary_width > 0 AND pitch_boundary_width <= 100),
  CONSTRAINT field_templates_pitch_boundary_height_check CHECK (pitch_boundary_height > 0 AND pitch_boundary_height <= 100),
  CONSTRAINT field_templates_pitch_boundary_box_check CHECK (
    pitch_boundary_x + pitch_boundary_width <= 100
    AND pitch_boundary_y + pitch_boundary_height <= 100
  ),
  CONSTRAINT field_templates_position_icon_size_check CHECK (position_icon_size >= 24 AND position_icon_size <= 72),
  CONSTRAINT field_templates_owner_scope_check CHECK (
    (
      owner_scope = 'SUPER_ADMIN'::public.formation_owner_scope
      AND association_id IS NULL
      AND club_id IS NULL
      AND team_id IS NULL
    )
    OR (
      owner_scope = 'ASSOCIATION'::public.formation_owner_scope
      AND association_id IS NOT NULL
      AND club_id IS NULL
      AND team_id IS NULL
    )
    OR (
      owner_scope = 'CLUB'::public.formation_owner_scope
      AND association_id IS NULL
      AND club_id IS NOT NULL
      AND team_id IS NULL
    )
    OR (
      owner_scope = 'TEAM'::public.formation_owner_scope
      AND association_id IS NULL
      AND club_id IS NULL
      AND team_id IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS field_templates_owner_idx
  ON public.field_templates (owner_scope, association_id, club_id, team_id);

CREATE INDEX IF NOT EXISTS field_templates_created_by_idx
  ON public.field_templates (created_by);

ALTER TABLE public.formations
  ADD COLUMN IF NOT EXISTS field_template_id uuid REFERENCES public.field_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS formations_field_template_id_idx
  ON public.formations (field_template_id);

DROP TRIGGER IF EXISTS update_field_templates_updated_at ON public.field_templates;
CREATE TRIGGER update_field_templates_updated_at
BEFORE UPDATE ON public.field_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.field_templates ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_templates TO authenticated;

DROP POLICY IF EXISTS "Field templates scoped select" ON public.field_templates;
CREATE POLICY "Field templates scoped select"
ON public.field_templates
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
          OR (ur.role = 'ASSOCIATION_ADMIN'::public.user_role_enum AND ur.association_id = field_templates.association_id)
          OR EXISTS (
            SELECT 1
            FROM public.clubs c
            JOIN public.teams t ON t.club_id = c.id
            WHERE c.association_id = field_templates.association_id
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
          (ur.role = 'CLUB_ADMIN'::public.user_role_enum AND ur.club_id = field_templates.club_id)
          OR (ur.role = ANY (ARRAY['TEAM_MANAGER'::public.user_role_enum, 'COACH'::public.user_role_enum]) AND t.club_id = field_templates.club_id)
          OR (ur.role = 'ASSOCIATION_ADMIN'::public.user_role_enum AND EXISTS (
            SELECT 1 FROM public.clubs c WHERE c.id = field_templates.club_id AND c.association_id = ur.association_id
          ))
        )
    )
  )
  OR (
    owner_scope = 'TEAM'::public.formation_owner_scope
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.teams t ON t.id = field_templates.team_id
      JOIN public.clubs c ON c.id = t.club_id
      WHERE ur.user_id = (select auth.uid())
        AND (
          (ur.role = ANY (ARRAY['TEAM_MANAGER'::public.user_role_enum, 'COACH'::public.user_role_enum]) AND ur.team_id = field_templates.team_id)
          OR (ur.role = 'CLUB_ADMIN'::public.user_role_enum AND ur.club_id = c.id)
          OR (ur.role = 'ASSOCIATION_ADMIN'::public.user_role_enum AND ur.association_id = c.association_id)
        )
    )
  )
);

DROP POLICY IF EXISTS "Field templates scoped manage" ON public.field_templates;
CREATE POLICY "Field templates scoped manage"
ON public.field_templates
FOR ALL
TO authenticated
USING (
  public.is_super_admin()
  OR (
    owner_scope = 'ASSOCIATION'::public.formation_owner_scope
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (select auth.uid())
        AND ur.role = 'ASSOCIATION_ADMIN'::public.user_role_enum
        AND ur.association_id = field_templates.association_id
    )
  )
  OR (
    owner_scope = 'CLUB'::public.formation_owner_scope
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (select auth.uid())
        AND ur.role = 'CLUB_ADMIN'::public.user_role_enum
        AND ur.club_id = field_templates.club_id
    )
  )
  OR (
    owner_scope = 'TEAM'::public.formation_owner_scope
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (select auth.uid())
        AND ur.role = ANY (ARRAY['TEAM_MANAGER'::public.user_role_enum, 'COACH'::public.user_role_enum])
        AND ur.team_id = field_templates.team_id
    )
  )
)
WITH CHECK (
  public.is_super_admin()
  OR (
    owner_scope = 'ASSOCIATION'::public.formation_owner_scope
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (select auth.uid())
        AND ur.role = 'ASSOCIATION_ADMIN'::public.user_role_enum
        AND ur.association_id = field_templates.association_id
    )
  )
  OR (
    owner_scope = 'CLUB'::public.formation_owner_scope
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (select auth.uid())
        AND ur.role = 'CLUB_ADMIN'::public.user_role_enum
        AND ur.club_id = field_templates.club_id
    )
  )
  OR (
    owner_scope = 'TEAM'::public.formation_owner_scope
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (select auth.uid())
        AND ur.role = ANY (ARRAY['TEAM_MANAGER'::public.user_role_enum, 'COACH'::public.user_role_enum])
        AND ur.team_id = field_templates.team_id
    )
  )
);

CREATE TEMP TABLE _formation_field_template_backfill (
  formation_id uuid PRIMARY KEY,
  field_template_id uuid NOT NULL
) ON COMMIT DROP;

INSERT INTO _formation_field_template_backfill (formation_id, field_template_id)
SELECT f.id, gen_random_uuid()
FROM public.formations f
WHERE f.field_template_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'formations'
      AND column_name = 'position_icon_size'
  ) THEN
    EXECUTE $sql$
      INSERT INTO public.field_templates (
        id,
        name,
        code,
        sport,
        owner_scope,
        association_id,
        club_id,
        team_id,
        background_image_url,
        grid_rows,
        grid_columns,
        pitch_boundary_x,
        pitch_boundary_y,
        pitch_boundary_width,
        pitch_boundary_height,
        position_icon_size,
        created_by,
        created_at,
        updated_at
      )
      SELECT
        map.field_template_id,
        COALESCE(NULLIF(TRIM(f.name), ''), 'Formation field'),
        f.code,
        'field_hockey',
        f.owner_scope,
        CASE WHEN f.owner_scope = 'ASSOCIATION'::public.formation_owner_scope THEN f.association_id ELSE NULL END,
        CASE WHEN f.owner_scope = 'CLUB'::public.formation_owner_scope THEN f.club_id ELSE NULL END,
        CASE WHEN f.owner_scope = 'TEAM'::public.formation_owner_scope THEN f.team_id ELSE NULL END,
        f.background_image_url,
        COALESCE(f.grid_rows, 10),
        COALESCE(f.grid_columns, 14),
        COALESCE(f.pitch_boundary_x, 0),
        COALESCE(f.pitch_boundary_y, 0),
        COALESCE(f.pitch_boundary_width, 100),
        COALESCE(f.pitch_boundary_height, 100),
        COALESCE(f.position_icon_size, 40),
        f.created_by,
        now(),
        now()
      FROM public.formations f
      JOIN _formation_field_template_backfill map ON map.formation_id = f.id
    $sql$;
  ELSE
    INSERT INTO public.field_templates (
      id,
      name,
      code,
      sport,
      owner_scope,
      association_id,
      club_id,
      team_id,
      background_image_url,
      grid_rows,
      grid_columns,
      pitch_boundary_x,
      pitch_boundary_y,
      pitch_boundary_width,
      pitch_boundary_height,
      position_icon_size,
      created_by,
      created_at,
      updated_at
    )
    SELECT
      map.field_template_id,
      COALESCE(NULLIF(TRIM(f.name), ''), 'Formation field'),
      f.code,
      'field_hockey',
      f.owner_scope,
      CASE WHEN f.owner_scope = 'ASSOCIATION'::public.formation_owner_scope THEN f.association_id ELSE NULL END,
      CASE WHEN f.owner_scope = 'CLUB'::public.formation_owner_scope THEN f.club_id ELSE NULL END,
      CASE WHEN f.owner_scope = 'TEAM'::public.formation_owner_scope THEN f.team_id ELSE NULL END,
      f.background_image_url,
      COALESCE(f.grid_rows, 10),
      COALESCE(f.grid_columns, 14),
      COALESCE(f.pitch_boundary_x, 0),
      COALESCE(f.pitch_boundary_y, 0),
      COALESCE(f.pitch_boundary_width, 100),
      COALESCE(f.pitch_boundary_height, 100),
      40,
      f.created_by,
      now(),
      now()
    FROM public.formations f
    JOIN _formation_field_template_backfill map ON map.formation_id = f.id;
  END IF;
END $$;

UPDATE public.formations f
SET field_template_id = map.field_template_id
FROM _formation_field_template_backfill map
WHERE f.id = map.formation_id
  AND f.field_template_id IS NULL;
