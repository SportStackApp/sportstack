import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, ChevronLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import fieldBg from "@/assets/Field_1.png";
import { logError } from "@/lib/logError";

interface Association {
  id: string;
  name: string;
}

interface Club {
  id: string;
  name: string;
  association_id: string;
}

interface Team {
  id: string;
  name: string;
  club_id: string;
  division: string | null;
}

const Signup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signUp, signInWithGoogle, user, loading: authLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    associationId: "",
    clubId: "",
    teamId: "",
  });

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      navigate("/dashboard");
    }
  }, [user, authLoading, navigate]);

  // Fetch associations on mount
  useEffect(() => {
    const fetchAssociations = async () => {
      const { data, error } = await supabase
        .from("associations")
        .select("id, name")
        .order("name");
      
      if (!error && data) {
        setAssociations(data);
      }
    };
    fetchAssociations();
  }, []);

  // Fetch clubs when association changes
  useEffect(() => {
    const fetchClubs = async () => {
      if (!formData.associationId) {
        setClubs([]);
        return;
      }
      
      const { data, error } = await supabase
        .from("clubs")
        .select("id, name, association_id")
        .eq("association_id", formData.associationId)
        .order("name");
      
      if (!error && data) {
        setClubs(data);
      }
    };
    fetchClubs();
  }, [formData.associationId]);

  // Fetch teams when club changes
  useEffect(() => {
    const fetchTeams = async () => {
      if (!formData.clubId) {
        setTeams([]);
        return;
      }
      
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, club_id, division")
        .eq("club_id", formData.clubId)
        .order("name");
      
      if (!error && data) {
        setTeams(data);
      }
    };
    fetchTeams();
  }, [formData.clubId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (formData.password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const savePendingSignup = async () => {
      const { error: pendingError } = await supabase.functions.invoke("save-pending-signup", {
        body: {
          email: formData.email,
          first_name: formData.firstName,
          last_name: formData.lastName,
          association_id: formData.associationId || null,
          club_id: formData.clubId || null,
          team_id: formData.teamId || null,
        },
      });

      if (pendingError) {
        await logError({
          context: "Signup - save pending signup",
          message: "Failed to save pending signup details",
          error: pendingError,
        });
        toast({
          title: "Some details not saved",
          description: "Your account was created but your name/team details didn't save. Please update them in your profile.",
          variant: "destructive",
        });
      }
    };

    const { error } = await signUp(formData.email, formData.password);

    if (error) {
      const errorText = error.message.toLowerCase();
      const accountAlreadyExists =
        errorText.includes("user already registered") ||
        errorText.includes("already been registered") ||
        errorText.includes("already exists");

      if (accountAlreadyExists) {
        await savePendingSignup();
      }

      setIsLoading(false);
      
      // Handle specific error cases
      let errorMessage = "An error occurred during signup.";
      if (accountAlreadyExists) {
        errorMessage = "An account with this email already exists. Please sign in instead.";
      } else if (error.message.includes("Invalid email")) {
        errorMessage = "Please enter a valid email address.";
      } else if (error.message.includes("Password")) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Signup failed",
        description: errorMessage,
        variant: "destructive",
      });
      return;
    }

    await savePendingSignup();

    setIsLoading(false);
    toast({
      title: "Account created!",
      description: formData.teamId 
        ? "Your team membership is pending approval."
        : "Welcome to Grampians Hockey!",
    });
    navigate("/dashboard");
  };

  const handleGoogleSignIn = async () => {
    const { error } = await signInWithGoogle();
    
    if (error) {
      toast({
        title: "Google sign up failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding (mobile hidden) */}
      <div
        className="hidden lg:flex flex-1 items-center justify-center relative overflow-hidden"
      >
        <img src={fieldBg} alt="Hockey field" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-primary/60 to-accent/40" />
        <div className="relative z-10 text-center p-8">
          <h2 className="font-display text-5xl text-primary-foreground mb-4">
            JOIN THE TEAM
          </h2>
          <p className="text-primary-foreground/80 max-w-md">
            Create your account and get started with managing your hockey club
            experience.
          </p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background overflow-auto">
        <div className="w-full max-w-md animate-fade-in">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to home
          </Link>

          <Card variant="ghost" className="border-0 shadow-none">
            <CardHeader className="px-0 pb-4">
              <CardTitle className="text-3xl">Create Account</CardTitle>
              <CardDescription>
                Fill in your details to join your team
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                size="lg"
                onClick={handleGoogleSignIn}
              >
                <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </Button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with email
                  </span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      type="text"
                      placeholder="First name"
                      value={formData.firstName}
                      onChange={(e) =>
                        setFormData({ ...formData, firstName: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      type="text"
                      placeholder="Last name"
                      value={formData.lastName}
                      onChange={(e) =>
                        setFormData({ ...formData, lastName: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? "Hide passwords" : "Show passwords"}
                        aria-pressed={showPassword}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm</Label>
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirm"
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          confirmPassword: e.target.value,
                        })
                      }
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <p className="text-sm text-muted-foreground mb-3">
                    Select your team (optional)
                  </p>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="association">Association</Label>
                      <Select
                        value={formData.associationId || undefined}
                        onValueChange={(value) =>
                          setFormData({
                            ...formData,
                            associationId: value,
                            clubId: "",
                            teamId: "",
                          })
                        }
                      >
                        <SelectTrigger aria-label="Association">
                          <SelectValue placeholder="Select association" />
                        </SelectTrigger>
                        <SelectContent>
                          {associations.map((assoc) => (
                            <SelectItem key={assoc.id} value={assoc.id}>
                              {assoc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="club">Club</Label>
                      <Select
                        value={formData.clubId || undefined}
                        onValueChange={(value) =>
                          setFormData({
                            ...formData,
                            clubId: value,
                            teamId: "",
                          })
                        }
                        disabled={!formData.associationId}
                      >
                        <SelectTrigger aria-label="Club">
                          <SelectValue placeholder="Select club" />
                        </SelectTrigger>
                        <SelectContent>
                          {clubs.map((club) => (
                            <SelectItem key={club.id} value={club.id}>
                              {club.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="team">Team</Label>
                      <Select
                        value={formData.teamId || undefined}
                        onValueChange={(value) =>
                          setFormData({ ...formData, teamId: value })
                        }
                        disabled={!formData.clubId}
                      >
                        <SelectTrigger aria-label="Team">
                          <SelectValue placeholder="Select team" />
                        </SelectTrigger>
                        <SelectContent>
                          {teams.map((team) => (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name} {team.division && `(${team.division})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full mt-6"
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading ? "Creating account..." : "Create Account"}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-muted-foreground">
                  Already have an account?{" "}
                  <Link
                    to="/login"
                    className="text-accent font-semibold hover:underline"
                  >
                    Sign in
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Signup;
