import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

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
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import VotingPortal from "./pages/VotingPortal";
import UmpireVoteSubmit from "./pages/umpire/UmpireVoteSubmit";
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

// Entity Dashboards
import AssociationDashboard from "./pages/AssociationDashboard";
import ClubDashboard from "./pages/ClubDashboard";
import DivisionDashboard from "./pages/DivisionDashboard";
import TeamDashboard from "./pages/TeamDashboard";

// Layout
import AppLayout from "./components/layout/AppLayout";
import { GlobalLoadingBar } from "./components/GlobalLoadingBar";

// Auth
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";

// Context
import { TestRoleProvider } from "./contexts/TestRoleContext";
import { TeamProvider } from "./contexts/TeamContext";
import { AppModeProvider } from "./contexts/AppModeContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <TestRoleProvider>
          <AppModeProvider>
            <TeamProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <GlobalLoadingBar />
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<Landing />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/pending" element={<Pending />} />
                  <Route path="/vote/:token" element={<VotingPortal />} />

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
                      <Route path="/coaching/:playerId" element={<CoachingPlayerProfile />} />
                      <Route path="/chat" element={<Chat />} />
                      <Route path="/umpire/vote" element={<UmpireVoteSubmit />} />
                      <Route path="/voting" element={<VotingPortal />} />
                      <Route path="/mvp-votes" element={<MvpVotes />} />
                      <Route path="/mvp-votes/:sessionId" element={<MvpVoteCast />} />
                      <Route path="/profile" element={<Profile />} />
                      
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
                      <Route path="/admin/mvp-voting" element={<MvpVotingAdmin />} />
                      <Route path="/admin/analytics" element={<Analytics />} />
                      <Route path="/admin/roles-permissions" element={<RolesPermissions />} />

                      {/* Entity Dashboards */}
                      <Route path="/associations/:id" element={<AssociationDashboard />} />
                      <Route path="/clubs/:id" element={<ClubDashboard />} />
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
