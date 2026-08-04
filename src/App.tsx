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
import ExpenseDashboard from "./pages/expense-hub/ExpenseDashboard";
import ExpensesPage from "./pages/expense-hub/ExpensesPage";
import ExpenseEditorPage from "./pages/expense-hub/ExpenseEditorPage";
import SuppliersPage from "./pages/expense-hub/SuppliersPage";
import ExpenseReportsPage from "./pages/expense-hub/ExpenseReportsPage";
import StatementImportsPage from "./pages/expense-hub/StatementImportsPage";
import ExpenseAiActivityPage from "./pages/expense-hub/ExpenseAiActivityPage";



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
import { ModeRouteGate } from "./components/auth/ModeRouteGate";
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
import { ExpenseHubGate } from "./features/expense-hub/ExpenseHubGate";
import { ExpenseHubLayout } from "./features/expense-hub/ExpenseHubLayout";

const queryClient = new QueryClient();

const ADMIN_MODES = ["super_admin", "association", "club"] as const;
const ASSOCIATION_ADMIN_MODES = ["super_admin", "association"] as const;
const SUPER_ADMIN_MODES = ["super_admin"] as const;
const MVP_ADMIN_MODES = ["super_admin", "association", "club", "team_manager"] as const;
const UMPIRE_BALLOT_MODES = ["super_admin", "association", "player"] as const;

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
          <TeamProvider>
            <AppModeProvider>
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
                      <Route path="/umpire/vote" element={<ModeRouteGate allowedModes={UMPIRE_BALLOT_MODES} requiredRoleForPlayerMode="UMPIRE"><ModuleGate moduleKey="umpire_match_voting" moduleLabel="Umpire Match Voting"><UmpireVoteSubmit /></ModuleGate></ModeRouteGate>} />
                      <Route path="/voting" element={<VotingPortal />} />
                      <Route path="/mvp-votes" element={<ModuleGate moduleKey="player_mvp" moduleLabel="Player MVP Voting"><MvpVotes /></ModuleGate>} />
                      <Route path="/mvp-votes/:sessionId" element={<ModuleGate moduleKey="player_mvp" moduleLabel="Player MVP Voting"><MvpVoteCastRoute /></ModuleGate>} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/expense-hub" element={<ExpenseHubGate><ExpenseHubLayout /></ExpenseHubGate>}>
                        <Route index element={<ExpenseDashboard />} />
                        <Route path="expenses" element={<ExpensesPage />} />
                        <Route path="expenses/new" element={<ExpenseEditorPage />} />
                        <Route path="statements" element={<StatementImportsPage />} />
                        <Route path="ai-activity" element={<ExpenseAiActivityPage />} />
                        <Route path="expenses/:id/edit" element={<ExpenseEditorPage />} />
                        <Route path="suppliers" element={<SuppliersPage />} />
                        <Route path="reports" element={<ExpenseReportsPage />} />
                      </Route>
                      <Route path="/committee" element={<ModuleGate moduleKey="committee" moduleLabel="Committee Management"><CommitteeManagement /></ModuleGate>} />
                      
                      {/* Admin Routes */}
                      <Route path="/admin" element={<ModeRouteGate allowedModes={ADMIN_MODES}><AdminDashboard /></ModeRouteGate>} />
                      <Route path="/admin/associations" element={<ModeRouteGate allowedModes={SUPER_ADMIN_MODES}><AssociationsManagement /></ModeRouteGate>} />
                      <Route path="/admin/competitions" element={<ModeRouteGate allowedModes={ASSOCIATION_ADMIN_MODES}><CompetitionsManagement /></ModeRouteGate>} />
                      <Route path="/admin/clubs" element={<ModeRouteGate allowedModes={ASSOCIATION_ADMIN_MODES}><ClubsManagement /></ModeRouteGate>} />
                      <Route path="/admin/teams" element={<ModeRouteGate allowedModes={ADMIN_MODES}><TeamsManagement /></ModeRouteGate>} />
                      <Route path="/admin/divisions" element={<ModeRouteGate allowedModes={ADMIN_MODES}><DivisionsManagement /></ModeRouteGate>} />
                      <Route path="/admin/users" element={<ModeRouteGate allowedModes={ADMIN_MODES}><UsersManagement /></ModeRouteGate>} />
                      <Route path="/admin/add-player" element={<ModeRouteGate allowedModes={ADMIN_MODES}><AddPlayer /></ModeRouteGate>} />
                      <Route path="/admin/bulk-import" element={<ModeRouteGate allowedModes={ADMIN_MODES}><BulkImport /></ModeRouteGate>} />
                      <Route path="/admin/revsports-mappings" element={<ModeRouteGate allowedModes={SUPER_ADMIN_MODES}><RevSportsMappings /></ModeRouteGate>} />
                      <Route path="/admin/revsports-unmatched" element={<ModeRouteGate allowedModes={SUPER_ADMIN_MODES}><RevSportsUnmatched /></ModeRouteGate>} />
                      <Route path="/admin/error-logs" element={<ModeRouteGate allowedModes={SUPER_ADMIN_MODES}><ErrorLogs /></ModeRouteGate>} />
                      <Route path="/admin/feedback" element={<ModeRouteGate allowedModes={ASSOCIATION_ADMIN_MODES}><FeedbackResponses /></ModeRouteGate>} />
                      <Route path="/admin/revsports-entities" element={<ModeRouteGate allowedModes={SUPER_ADMIN_MODES}><RevSportsEntityReview /></ModeRouteGate>} />
                      <Route path="/admin/fixtures" element={<ModeRouteGate allowedModes={ASSOCIATION_ADMIN_MODES}><FixturesManagement /></ModeRouteGate>} />
                      <Route path="/admin/fixture-import" element={<ModeRouteGate allowedModes={SUPER_ADMIN_MODES}><FixtureImport /></ModeRouteGate>} />
                      <Route path="/admin/venues" element={<ModeRouteGate allowedModes={ASSOCIATION_ADMIN_MODES}><VenuesManagement /></ModeRouteGate>} />
                      <Route path="/admin/requests" element={<ModeRouteGate allowedModes={ADMIN_MODES}><Requests /></ModeRouteGate>} />
                      <Route path="/admin/mvp-voting" element={<ModeRouteGate allowedModes={MVP_ADMIN_MODES}><ModuleGate moduleKey="player_mvp" moduleLabel="Player MVP Voting"><MvpVotingAdmin /></ModuleGate></ModeRouteGate>} />
                      <Route path="/admin/umpire-voting" element={<ModeRouteGate allowedModes={ASSOCIATION_ADMIN_MODES}><ModuleGate moduleKey="umpire_match_voting" moduleLabel="Umpire Match Voting"><UmpireVotingModule /></ModuleGate></ModeRouteGate>} />
                      <Route path="/admin/safety-risk" element={<ModeRouteGate allowedModes={ADMIN_MODES}><ModuleGate moduleKey="safety_risk" moduleLabel="Risk & Quality Improvement"><SafetyRiskModule /></ModuleGate></ModeRouteGate>} />
                      <Route path="/admin/analytics" element={<ModeRouteGate allowedModes={ASSOCIATION_ADMIN_MODES}><Analytics /></ModeRouteGate>} />
                      <Route path="/admin/roles-permissions" element={<ModeRouteGate allowedModes={ADMIN_MODES}><RolesPermissions /></ModeRouteGate>} />
                      <Route path="/admin/module-preview" element={<ModeRouteGate allowedModes={SUPER_ADMIN_MODES}><ModuleLayoutPreview /></ModeRouteGate>} />

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
            </AppModeProvider>
          </TeamProvider>
        </TestRoleProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
