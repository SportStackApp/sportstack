import { supabase } from '@/integrations/supabase/client';

async function test() {
  const teamsQuery1 = supabase.from("teams").select("*, clubs:club_id(name, association_id), divisions:division_id(name)");
  const teamsQuery2 = supabase.from("teams").select("*, clubs:club_id(name, association_id), team_divisions(divisions(name))");
}
