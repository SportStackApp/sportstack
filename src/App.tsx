import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Link, Routes, Route, useLocation, useParams } from "react-router-dom";

// Pages
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Pending from "./pages/Pending";
import Dashboard from "./pages/Dashboard";
import Games from "./pages/Games";
import GameDetail from "./pages/GameDetail";
import Lineup from "./pages/Lineup";
import Roster from "./pages/Roster";
import Chat from "./pages/Chat";
import CoachingSquad from "./pages/coaching/CoachingSquad";
import CoachingPlayerProfile from "./pages/coaching/CoachingPlayerProfile";
import FormationBuilder from "./pages/coaching/FormationBuilder";
import FormationLibrary from "./pages/coaching/FormationLibrary";
import TemplateBuilder from "./pages/coaching/TemplateBuilder";
import HockeyTraceLab from "./pages/coaching/HockeyTraceLab";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import VotingPortal from "./pages/VotingPortal";
import UmpireVoteSubmit from "./pages/umpire/UmpireVoteSubmit";
import UmpirePortalLanding from "./pages/umpire/UmpirePortalLanding";
import PublicUmpireVote from "./pages/umpire/PublicUmpireVote";
import MvpVotes from "./pages/MvpVotes";
import MvpVoteCast from "./pages/MvpVoteCast";



// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AssociationsManagement from "./pages/admin/AssociationsManagement";
import ClubsManagement from "./pages/admin/ClubsManagement";
import TeamsManagement from "./pages/admin/TeamsManagement";
import DivisionsManagement from "./pages/admin/DivisionsManagement";
import CompetitionsManagement from "./pages/admin/CompetitionsManagement";
import UsersManagement from "./pages/admin/UsersManagement";
import AddPlayer from "./pages/admin/AddPlayer";
import BulkImport from "./pages/admin/BulkImport";
import FixturesManagement from "./pages/admin/FixturesManagement";
import FixtureImport from "./pages/admin/FixtureImport";
import VenuesManagement from "./pages/admin/VenuesManagement";
import Requests from "./pages/admin/Requests";
import RevSportsMappings from "./pages/admin/RevSportsMappings";
import RevSportsUnmatched from "./pages/admin/RevSportsUnmatched";
import ErrorLogs from "./pages/admin/ErrorLogs";
import RevSportsEntityReview from "./pages/admin/RevSportsEntityReview";
import MvpVotingAdmin from "./pages/admin/MvpVotingAdmin";
import Analytics from "./pages/admin/Analytics";
import FeedbackResponses from "./pages/admin/FeedbackResponses";
import RolesPermissions from "./pages/admin/RolesPermissions";
import CommitteeManagement from "./pages/CommitteeManagement";
import { ModuleGate } from "./components/auth/ModuleGate";
import ModuleLayoutPreview from "./pages/admin/ModuleLayoutPreview";
import SafetyRiskModule from "./pages/admin/SafetyRiskModule";
import UmpireVotingModule from "./pages/admin/UmpireVotingModule";

// Entity Dashboards
import AssociationDashboard from "./pages/AssociationDashboard";
import ClubDashboard from "./pages/ClubDashboard";
import DivisionDashboard from "./pages/DivisionDashboard";
import TeamDashboard from "./pages/TeamDashboard";

// Layout
import AppLayout from "./components/layout/AppLayout";
import { GlobalLoadingBar } from "./components/GlobalLoadingBar";
import { ThemeAccountSync } from "./components/ThemeAccountSync";

// Auth
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";

// Context
import { TestRoleProvider } from "./contexts/TestRoleContext";
import { TeamProvider } from "./contexts/TeamContext";
import { AppModeProvider } from "./contexts/AppModeContext";
import { isUmpirePortalHostname } from "./lib/domainConfig";

const queryClient = new QueryClient();

const DomainHome = () =>
  isUmpirePortalHostname(window.location.hostname) ? <UmpirePortalLanding /> : <Landing />;

const RetiredMvpTokenRoute = () => (
  <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
    <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
      <h1 className="text-2xl font-display font-semibold text-foreground">MVP voting has moved</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Private token links are no longer used. Sign in to see the team voting rounds linked to your match attendance.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <Link className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" to="/login">
          Sign in
        </Link>
        <Link className="text-sm font-medium text-primary hover:underline" to="/mvp-votes">
          Already signed in? Open MVP Votes
        </Link>
      </div>
    </div>
  </main>
);

// Remount the ballot when a notification or link switches directly between
// session IDs so no form state can carry into the next match.
const MvpVoteCastRoute = () => {
  const { sessionId } = useParams();
  const location = useLocation();
  return <MvpVoteCast key={`${sessionId}:${location.key}`} />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <ThemeAccountSync />
        <TestRoleProvider>
          <AppModeProvider>
            <TeamProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <GlobalLoadingBar />
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<DomainHome />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/pending" element={<Pending />} />
                  <Route path="/vote/:token" element={<RetiredMvpTokenRoute />} />
                  <Route path="/umpire" element={<UmpirePortalLanding />} />
                  <Route path="/umpire/public-vote" element={<PublicUmpireVote />} />

                  {/* Protected Routes with App Layout */}
                  <Route element={<ProtectedRoute />}>
                    <Route element={<AppLayout />}>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/games" element={<Games />} />
                      <Route path="/games/:id" element={<GameDetail />} />
                      <Route path="/games/:id/lineup" element={<Lineup />} />
                      <Route path="/roster" element={<Roster />} />
                      <Route path="/coaching" element={<CoachingSquad />} />
                      <Route path="/coaching/formations" element={<FormationLibrary />} />
                      <Route path="/coaching/formations/builder" element={<FormationBuilder />} />
                      <Route path="/coaching/formations/templates/builder" element={<TemplateBuilder />} />
                      <Route path="/coaching/trace" element={<ModuleGate moduleKey="hockey_trace" moduleLabel="Hockey Trace Lab"><HockeyTraceLab /></ModuleGate>} />
                      <Route path="/coaching/:playerId" element={<CoachingPlayerProfile />} />
                      <Route path="/chat" element={<Chat />} />
                      <Route path="/umpire/vote" element={<ModuleGate moduleKey="umpire_match_voting" moduleLabel="Umpire Match Voting"><UmpireVoteSubmit /></ModuleGate>} />
                      <Route path="/voting" element={<VotingPortal />} />
                      <Route path="/mvp-votes" element={<ModuleGate moduleKey="player_mvp" moduleLabel="Player MVP Voting"><MvpVotes /></ModuleGate>} />
                      <Route path="/mvp-votes/:sessionId" element={<ModuleGate moduleKey="player_mvp" moduleLabel="Player MVP Voting"><MvpVoteCastRoute /></ModuleGate>} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/committee" element={<ModuleGate moduleKey="committee" moduleLabel="Committee Management"><CommitteeManagement /></ModuleGate>} />
                      
                      {/* Admin Routes */}
                      <Route path="/admin" element={<AdminDashboard />} />
                      <Route path="/admin/associations" element={<AssociationsManagement />} />
                      <Route path="/admin/competitions" element={<CompetitionsManagement />} />
                      <Route path="/admin/clubs" element={<ClubsManagement />} />
                      <Route path="/admin/teams" element={<TeamsManagement />} />
                      <Route path="/admin/divisions" element={<DivisionsManagement />} />
                      <Route path="/admin/users" element={<UsersManagement />} />
                      <Route path="/admin/add-player" element={<AddPlayer />} />
                      <Route path="/admin/bulk-import" element={<BulkImport />} />
                      <Route path="/admin/revsports-mappings" element={<RevSportsMappings />} />
                      <Route path="/admin/revsports-unmatched" element={<RevSportsUnmatched />} />
                      <Route path="/admin/error-logs" element={<ErrorLogs />} />
                      <Route path="/admin/feedback" element={<FeedbackResponses />} />
                      <Route path="/admin/revsports-entities" element={<RevSportsEntityReview />} />
                      <Route path="/admin/fixtures" element={<FixturesManagement />} />
                      <Route path="/admin/fixture-import" element={<FixtureImport />} />
                      <Route path="/admin/venues" element={<VenuesManagement />} />
                      <Route path="/admin/requests" element={<Requests />} />
                      <Route path="/admin/mvp-voting" element={<ModuleGate moduleKey="player_mvp" moduleLabel="Player MVP Voting"><MvpVotingAdmin /></ModuleGate>} />
                      <Route path="/admin/umpire-voting" element={<ModuleGate moduleKey="umpire_match_voting" moduleLabel="Umpire Match Voting"><UmpireVotingModule /></ModuleGate>} />
                      <Route path="/admin/safety-risk" element={<ModuleGate moduleKey="safety_risk" moduleLabel="Risk & Quality Improvement"><SafetyRiskModule /></ModuleGate>} />
                      <Route path="/admin/analytics" element={<Analytics />} />
                      <Route path="/admin/roles-permissions" element={<RolesPermissions />} />
                      <Route path="/admin/module-preview" element={<ModuleLayoutPreview />} />

                      {/* Entity Dashboards */}
                      <Route path="/associations/:id" element={<AssociationDashboard />} />
                      <Route path="/clubs/:id" element={<ClubDashboard />} />
                      <Route path="/divisions/:id" element={<DivisionDashboard />} />
                      <Route path="/admin/division" element={<DivisionDashboard />} />
                      <Route path="/teams/:id" element={<TeamDashboard />} />
                    </Route>
                  </Route>

                  {/* Catch-all */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TeamProvider>
          </AppModeProvider>
        </TestRoleProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
