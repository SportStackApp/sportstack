import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase as originalSupabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Star, Trophy } from "lucide-react";

// Local interfaces since they aren't in types.ts yet
interface MvpToken {
  id: string;
  token: string;
  voted_at: string | null;
  shoutout: string | null;
  revsports_player_id: string;
  voter_name: string;
  voter_team: string;
  match_url: string;
  grade: string;
  round: string;
  date: string;
  home_team: string;
  away_team: string;
  is_closed: boolean;
}

interface RevsportsPlayer {
  id: string;
  match_url: string;
  player_name: string;
  team: string;
  jersey: string | null;
  attended: boolean;
}

interface MvpVote {
  id?: string;
  token_id: string;
  player_id: string;
  points: number;
}

// Widened Supabase client type for these new MVP queries
const supabase = originalSupabase as any;

export default function VotingPortal() {
  const { token } = useParams();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [tokenData, setTokenData] = useState<MvpToken | null>(null);
  const [players, setPlayers] = useState<RevsportsPlayer[]>([]);
  
  const [votes, setVotes] = useState({ vote3: "__none__", vote2: "__none__", vote1: "__none__" });
  const [shoutout, setShoutout] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!token) return;
      
      const { data: tData, error: tErr } = await supabase
        .from('mvp_vote_tokens')
        .select('*')
        .eq('token', token)
        .maybeSingle();
        
      if (tErr || !tData) {
        setLoading(false);
        return;
      }
      
      const { data: pRow, error: pRowErr } = await supabase
        .from('revsports_players')
        .select('*')
        .eq('id', tData.revsports_player_id)
        .maybeSingle();
        
      const { data: sRow, error: sRowErr } = await supabase
        .from('mvp_voting_sessions')
        .select('*')
        .eq('id', tData.session_id)
        .maybeSingle();
        
      if (pRowErr || sRowErr || !pRow || !sRow) {
        setLoading(false);
        return;
      }
      
      const combinedTokenData: MvpToken = {
        id: tData.id,
        token: tData.token,
        voted_at: tData.voted_at,
        shoutout: tData.shoutout,
        revsports_player_id: tData.revsports_player_id,
        voter_name: pRow.player_name,
        voter_team: pRow.team,
        match_url: pRow.match_url,
        grade: sRow.grade,
        round: sRow.round,
        date: sRow.game_date,
        home_team: sRow.home_team,
        away_team: sRow.away_team,
        is_closed: sRow.status !== 'OPEN' || sRow.closes_at < new Date().toISOString(),
      };
      
      setTokenData(combinedTokenData);
      
      if (!combinedTokenData.voted_at && !combinedTokenData.is_closed) {
        const { data: pData, error: pErr } = await supabase
          .from('revsports_players')
          .select('*')
          .eq('match_url', combinedTokenData.match_url)
          .eq('attended', true)
          .eq('team', combinedTokenData.voter_team);
          
        if (!pErr && pData) {
          const typedPlayers = pData as RevsportsPlayer[];
          const sorted = [...typedPlayers].sort((a, b) => a.player_name.localeCompare(b.player_name));
          const eligible = sorted.filter((p: RevsportsPlayer) => p.id !== combinedTokenData.revsports_player_id);
          setPlayers(eligible);
        }
      }
      
      setLoading(false);
    }
    
    loadData();
  }, [token]);

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen"><div className="animate-pulse">Loading...</div></div>;
  }

  if (!tokenData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Invalid Link</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">This voting link is invalid.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (tokenData.voted_at) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Already Voted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">You've already voted. Thanks!</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (tokenData.is_closed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Session Closed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">Voting for this game has closed.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md text-center border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold text-green-700 flex items-center justify-center gap-2">
              <span>✅</span> Votes submitted! Thanks for voting.
            </h2>
          </CardContent>
        </Card>
      </div>
    );
  }

  const checkDuplicate = (val: string) => {
    if (val === "__none__") return false;
    const all = [votes.vote3, votes.vote2, votes.vote1];
    return all.filter(v => v === val).length > 1;
  };

  const hasDuplicates = checkDuplicate(votes.vote3) || checkDuplicate(votes.vote2) || checkDuplicate(votes.vote1);
  const allSelected = votes.vote3 !== "__none__" && votes.vote2 !== "__none__" && votes.vote1 !== "__none__";

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      const votesToInsert: MvpVote[] = [
        { token_id: tokenData.id, player_id: votes.vote3, points: 3 },
        { token_id: tokenData.id, player_id: votes.vote2, points: 2 },
        { token_id: tokenData.id, player_id: votes.vote1, points: 1 },
      ];
      
      const { error: vErr } = await supabase.from('mvp_votes').insert(votesToInsert);
      if (vErr) throw vErr;
      
      const { error: tErr } = await supabase.from('mvp_vote_tokens').update({
        voted_at: new Date().toISOString(),
        shoutout: shoutout.trim() || null
      }).eq('id', tokenData.id);
      if (tErr) throw tErr;
      
      setSuccess(true);
    } catch (e) {
      toast({ variant: "destructive", title: "Something went wrong. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const formattedDate = new Intl.DateTimeFormat('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(tokenData.date));

  return (
    <div className="min-h-screen bg-gray-50 p-4 py-8 flex justify-center">
      <div className="w-full max-w-md space-y-6">
        
        <div className="text-center">
          <h1 className="text-3xl font-black tracking-tight text-gray-900">SportStack</h1>
          <p className="text-sm text-gray-500 mt-1">MVP Voting Portal</p>
        </div>

        <Card>
          <CardHeader className="bg-gray-100/50 border-b pb-4">
            <CardTitle className="text-lg flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">{tokenData.grade} • {tokenData.round}</span>
              <span>{tokenData.home_team} vs {tokenData.away_team}</span>
            </CardTitle>
            <CardDescription className="text-sm text-gray-600 font-medium">
              {formattedDate}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-8">
            
            <div className="space-y-6">
              <VoteSelect 
                label="3 Votes" 
                helper="Best player of the game"
                icon={<Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />}
                value={votes.vote3}
                onChange={(val) => setVotes(v => ({ ...v, vote3: val }))}
                players={players}
              />
              <VoteSelect 
                label="2 Votes" 
                icon={<Star className="h-4 w-4 fill-gray-400 text-gray-400" />}
                value={votes.vote2}
                onChange={(val) => setVotes(v => ({ ...v, vote2: val }))}
                players={players}
              />
              <VoteSelect 
                label="1 Vote" 
                icon={<Star className="h-4 w-4 fill-amber-700 text-amber-700" />}
                value={votes.vote1}
                onChange={(val) => setVotes(v => ({ ...v, vote1: val }))}
                players={players}
              />

              {hasDuplicates && (
                <p className="text-sm text-red-500 font-medium text-center">
                  You can't give two votes to the same player.
                </p>
              )}
            </div>

            <div className="space-y-2 pt-4 border-t">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 font-semibold">
                  Club Champion <Trophy className="h-4 w-4 text-yellow-500" />
                </Label>
                <span className="text-xs text-gray-500">{shoutout.length}/200</span>
              </div>
              <Textarea 
                placeholder="Give a shoutout to someone who made a difference — on or off the field"
                className="resize-none h-24"
                maxLength={200}
                value={shoutout}
                onChange={(e) => setShoutout(e.target.value)}
              />
            </div>

            <Button 
              className="w-full" 
              size="lg"
              disabled={!allSelected || hasDuplicates || submitting}
              onClick={onSubmit}
            >
              {submitting ? "Submitting..." : "Submit Votes"}
            </Button>
            
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function VoteSelect({ 
  label, 
  helper, 
  icon, 
  value, 
  onChange, 
  players 
}: { 
  label: string, 
  helper?: string, 
  icon: React.ReactNode,
  value: string,
  onChange: (val: string) => void,
  players: RevsportsPlayer[]
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <Label className="font-semibold">{label}</Label>
      </div>
      {helper && <p className="text-xs text-gray-500 -mt-1 mb-2">{helper}</p>}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select a player" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">-- Select a player --</SelectItem>
          {players.map(p => (
            <SelectItem key={p.id} value={p.id}>
              {p.player_name} {p.jersey ? `(#${p.jersey})` : ""} — {p.team}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
