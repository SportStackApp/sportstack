-- Give every newly-created auth user a limited VOTER role.
-- This keeps brand-new accounts inside the app as limited users until an admin
-- upgrades them through normal team, club, association, or admin permissions.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = NEW.id
      AND role = 'VOTER'::public.app_role
      AND association_id IS NULL
      AND club_id IS NULL
      AND team_id IS NULL
  ) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'VOTER'::public.app_role);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
