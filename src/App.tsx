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
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import VotingPortal from "./pages/VotingPortal";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AssociationsManagement from "./pages/admin/AssociationsManagement";
import ClubsManagement from "./pages/admin/ClubsManagement";
import TeamsManagement from "./pages/admin/TeamsManagement";
import DivisionsManagement from "./pages/admin/DivisionsManagement";
import UsersManagement from "./pages/admin/UsersManagement";
import AddPlayer from "./pages/admin/AddPlayer";
import BulkImport from "./pages/admin/BulkImport";
import FixturesManagement from "./pages/admin/FixturesManagement";
import FixtureImport from "./pages/admin/FixtureImport";
import VenuesManagement from "./pages/admin/VenuesManagement";
import Requests from "./pages/admin/Requests";

// Entity Dashboards
import AssociationDashboard from "./pages/AssociationDashboard";
import ClubDashboard from "./pages/ClubDashboard";
import DivisionDashboard from "./pages/DivisionDashboard";
import TeamDashboard from "./pages/TeamDashboard";

// Layout
import AppLayout from "./components/layout/AppLayout";

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
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<Landing />} />
                  <Route path="/vote/:token" element={<VotingPortal />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/pending" element={<Pending />} />

                  {/* Protected Routes with App Layout */}
                  <Route element={<ProtectedRoute />}>
                    <Route element={<AppLayout />}>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/games" element={<Games />} />
                      <Route path="/games/:id" element={<GameDetail />} />
                      <Route path="/games/:id/lineup" element={<Lineup />} />
                      <Route path="/roster" element={<Roster />} />
                      <Route path="/chat" element={<Chat />} />
                      <Route path="/profile" element={<Profile />} />
                      
                      {/* Admin Routes */}
                      <Route path="/admin" element={<AdminDashboard />} />
                      <Route path="/admin/associations" element={<AssociationsManagement />} />
                      <Route path="/admin/clubs" element={<ClubsManagement />} />
                      <Route path="/admin/teams" element={<TeamsManagement />} />
                      <Route path="/admin/divisions" element={<DivisionsManagement />} />
                      <Route path="/admin/users" element={<UsersManagement />} />
                      <Route path="/admin/add-player" element={<AddPlayer />} />
                      <Route path="/admin/bulk-import" element={<BulkImport />} />
                      <Route path="/admin/fixtures" element={<FixturesManagement />} />
                      <Route path="/admin/fixture-import" element={<FixtureImport />} />
                      <Route path="/admin/venues" element={<VenuesManagement />} />
                      <Route path="/admin/requests" element={<Requests />} />

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
