-- Phase 1: Database Schema

-- 1. Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('PLAYER', 'COACH', 'TEAM_MANAGER', 'CLUB_ADMIN', 'ASSOCIATION_ADMIN');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'CLUB_ADMIN') OR public.has_role(auth.uid(), 'ASSOCIATION_ADMIN'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'CLUB_ADMIN') OR public.has_role(auth.uid(), 'ASSOCIATION_ADMIN'));

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'CLUB_ADMIN') OR public.has_role(auth.uid(), 'ASSOCIATION_ADMIN'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'CLUB_ADMIN') OR public.has_role(auth.uid(), 'ASSOCIATION_ADMIN'));

-- 4. Create associations table
CREATE TABLE public.associations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    abbreviation TEXT,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.associations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view associations"
ON public.associations
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Association admins can manage associations"
ON public.associations
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'ASSOCIATION_ADMIN'));

-- 5. Create clubs table
CREATE TABLE public.clubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    association_id UUID REFERENCES public.associations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    abbreviation TEXT,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view clubs"
ON public.clubs
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Club admins can manage their clubs"
ON public.clubs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'CLUB_ADMIN') OR public.has_role(auth.uid(), 'ASSOCIATION_ADMIN'));

-- 6. Create teams table
CREATE TABLE public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    age_group TEXT,
    gender TEXT,
    division TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view teams"
ON public.teams
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Club admins and coaches can manage teams"
ON public.teams
FOR ALL
TO authenticated
USING (
    public.has_role(auth.uid(), 'CLUB_ADMIN') 
    OR public.has_role(auth.uid(), 'ASSOCIATION_ADMIN')
    OR public.has_role(auth.uid(), 'TEAM_MANAGER')
);

-- 7. Create membership_type enum
CREATE TYPE public.membership_type AS ENUM ('PRIMARY', 'SECONDARY', 'FILL_IN');

-- 8. Create membership_status enum
CREATE TYPE public.membership_status AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- 9. Create team_memberships table
CREATE TABLE public.team_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    membership_type membership_type NOT NULL DEFAULT 'PRIMARY',
    status membership_status NOT NULL DEFAULT 'PENDING',
    jersey_number INTEGER,
    position TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, team_id)
);

ALTER TABLE public.team_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own memberships"
ON public.team_memberships
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Team members can view teammates"
ON public.team_memberships
FOR SELECT
TO authenticated
USING (
    team_id IN (
        SELECT team_id FROM public.team_memberships WHERE user_id = auth.uid() AND status = 'APPROVED'
    )
);

CREATE POLICY "Admins and coaches can view all memberships"
ON public.team_memberships
FOR SELECT
TO authenticated
USING (
    public.has_role(auth.uid(), 'CLUB_ADMIN') 
    OR public.has_role(auth.uid(), 'ASSOCIATION_ADMIN')
    OR public.has_role(auth.uid(), 'COACH')
    OR public.has_role(auth.uid(), 'TEAM_MANAGER')
);

CREATE POLICY "Users can request to join teams"
ON public.team_memberships
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND status = 'PENDING');

CREATE POLICY "Admins and coaches can manage memberships"
ON public.team_memberships
FOR UPDATE
TO authenticated
USING (
    public.has_role(auth.uid(), 'CLUB_ADMIN') 
    OR public.has_role(auth.uid(), 'ASSOCIATION_ADMIN')
    OR public.has_role(auth.uid(), 'COACH')
    OR public.has_role(auth.uid(), 'TEAM_MANAGER')
);

CREATE POLICY "Admins can delete memberships"
ON public.team_memberships
FOR DELETE
TO authenticated
USING (
    public.has_role(auth.uid(), 'CLUB_ADMIN') 
    OR public.has_role(auth.uid(), 'ASSOCIATION_ADMIN')
);

-- 10. Create games table
CREATE TABLE public.games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    opponent_name TEXT NOT NULL,
    game_date TIMESTAMP WITH TIME ZONE NOT NULL,
    location TEXT,
    is_home BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'scheduled',
    home_score INTEGER,
    away_score INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view their games"
ON public.games
FOR SELECT
TO authenticated
USING (
    team_id IN (
        SELECT team_id FROM public.team_memberships WHERE user_id = auth.uid() AND status = 'APPROVED'
    )
    OR public.has_role(auth.uid(), 'CLUB_ADMIN')
    OR public.has_role(auth.uid(), 'ASSOCIATION_ADMIN')
    OR public.has_role(auth.uid(), 'COACH')
);

CREATE POLICY "Coaches and admins can manage games"
ON public.games
FOR ALL
TO authenticated
USING (
    public.has_role(auth.uid(), 'CLUB_ADMIN') 
    OR public.has_role(auth.uid(), 'ASSOCIATION_ADMIN')
    OR public.has_role(auth.uid(), 'COACH')
    OR public.has_role(auth.uid(), 'TEAM_MANAGER')
);

-- 11. Create lineups table
CREATE TABLE public.lineups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
    player_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    position TEXT NOT NULL,
    is_starting BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (game_id, player_id)
);

ALTER TABLE public.lineups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view lineups"
ON public.lineups
FOR SELECT
TO authenticated
USING (
    game_id IN (
        SELECT g.id FROM public.games g
        JOIN public.team_memberships tm ON tm.team_id = g.team_id
        WHERE tm.user_id = auth.uid() AND tm.status = 'APPROVED'
    )
    OR public.has_role(auth.uid(), 'COACH')
    OR public.has_role(auth.uid(), 'CLUB_ADMIN')
);

CREATE POLICY "Coaches can manage lineups"
ON public.lineups
FOR ALL
TO authenticated
USING (
    public.has_role(auth.uid(), 'COACH')
    OR public.has_role(auth.uid(), 'CLUB_ADMIN')
    OR public.has_role(auth.uid(), 'TEAM_MANAGER')
);

-- 12. Add triggers for updated_at
CREATE TRIGGER update_associations_updated_at
BEFORE UPDATE ON public.associations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clubs_updated_at
BEFORE UPDATE ON public.clubs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_teams_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_memberships_updated_at
BEFORE UPDATE ON public.team_memberships
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_games_updated_at
BEFORE UPDATE ON public.games
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lineups_updated_at
BEFORE UPDATE ON public.lineups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Phase 2: Seed Data with valid UUIDs (only hex characters 0-9, a-f)

-- Insert associations
INSERT INTO public.associations (id, name, abbreviation) VALUES
    ('a1111111-1111-1111-1111-111111111111', 'Hockey Victoria', 'HV'),
    ('a2222222-2222-2222-2222-222222222222', 'Hockey NSW', 'HNSW'),
    ('a3333333-3333-3333-3333-333333333333', 'Hockey Queensland', 'HQ');

-- Insert clubs
INSERT INTO public.clubs (id, association_id, name, abbreviation) VALUES
    ('b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'Melbourne Hockey Club', 'MHC'),
    ('b2222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', 'Camberwell Hockey Club', 'CHC'),
    ('b3333333-3333-3333-3333-333333333333', 'a2222222-2222-2222-2222-222222222222', 'Sydney University Hockey', 'SUHC'),
    ('b4444444-4444-4444-4444-444444444444', 'a2222222-2222-2222-2222-222222222222', 'Mosman Hockey Club', 'MOSHC'),
    ('b5555555-5555-5555-5555-555555555555', 'a3333333-3333-3333-3333-333333333333', 'Brisbane Hockey Club', 'BHC');

-- Insert teams
INSERT INTO public.teams (id, club_id, name, age_group, gender, division) VALUES
    ('d1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'Melbourne HC - Mens 1st', 'Open', 'Men', 'Premier League'),
    ('d2222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111', 'Melbourne HC - Womens 1st', 'Open', 'Women', 'Premier League'),
    ('d3333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111', 'Melbourne HC - U18 Boys', 'U18', 'Men', 'Junior League'),
    ('d4444444-4444-4444-4444-444444444444', 'b2222222-2222-2222-2222-222222222222', 'Camberwell HC - Mens 1st', 'Open', 'Men', 'Premier League'),
    ('d5555555-5555-5555-5555-555555555555', 'b2222222-2222-2222-2222-222222222222', 'Camberwell HC - Womens 1st', 'Open', 'Women', 'Premier League'),
    ('d6666666-6666-6666-6666-666666666666', 'b3333333-3333-3333-3333-333333333333', 'Sydney Uni - Mens 1st', 'Open', 'Men', 'Premier League'),
    ('d7777777-7777-7777-7777-777777777777', 'b4444444-4444-4444-4444-444444444444', 'Mosman HC - Mixed Masters', 'Masters', 'Mixed', 'Masters League'),
    ('d8888888-8888-8888-8888-888888888888', 'b5555555-5555-5555-5555-555555555555', 'Brisbane HC - Mens 1st', 'Open', 'Men', 'Premier League');

-- Insert sample games (upcoming)
INSERT INTO public.games (id, team_id, opponent_name, game_date, location, is_home, status) VALUES
    ('e1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'Camberwell HC', now() + interval '3 days', 'State Hockey Centre', true, 'scheduled'),
    ('e2222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 'Essendon HC', now() + interval '10 days', 'Essendon Fields', false, 'scheduled'),
    ('e3333333-3333-3333-3333-333333333333', 'd1111111-1111-1111-1111-111111111111', 'Footscray HC', now() + interval '17 days', 'State Hockey Centre', true, 'scheduled'),
    ('e4444444-4444-4444-4444-444444444444', 'd2222222-2222-2222-2222-222222222222', 'Hawthorn HC', now() + interval '4 days', 'State Hockey Centre', true, 'scheduled'),
    ('e5555555-5555-5555-5555-555555555555', 'd4444444-4444-4444-4444-444444444444', 'Melbourne HC', now() + interval '3 days', 'Camberwell Sports Ground', false, 'scheduled');