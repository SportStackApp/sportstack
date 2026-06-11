// Mock data for the application
// This will be replaced with Supabase data when backend is connected

// ============= TYPE DEFINITIONS =============

export type Role = "PLAYER" | "COACH" | "CLUB_ADMIN" | "ASSOCIATION_ADMIN" | "SYSTEM_ADMIN";
export type AvailabilityStatus = "AVAILABLE" | "UNAVAILABLE" | "UNSURE";
export type GameStatus = "SCHEDULED" | "FINALISED";
export type MembershipType = "PRIMARY" | "SECONDARY" | "FILL_IN";
export type InviteStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED";
export type RequestStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export interface TeamMembership {
  teamId: string;
  teamName: string;
  clubId: string;
  clubName: string;
  associationId: string;
  associationName: string;
  type: MembershipType;
  position?: string;
  jerseyNumber?: number;
  gameId?: string; // For fill-ins only
  gameDate?: string; // For fill-ins only
}

export interface TeamInvite {
  id: string;
  teamId: string;
  teamName: string;
  clubName: string;
  type: "SECONDARY" | "FILL_IN";
  gameId?: string;
  gameDate?: string;
  sentBy: string;
  sentAt: string;
  expiresAt: string; // 30 days from sentAt
  status: InviteStatus;
}

export interface PrimaryChangeRequest {
  id: string;
  fromTeamId: string;
  fromTeamName: string;
  toTeamId: string;
  toTeamName: string;
  status: RequestStatus;
  requestedAt: string;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export interface PlayerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  suburb: string;
  emergencyContact: EmergencyContact;
  dateOfBirth: string;
  associationId: string; // Required - all profiles must have association
  avatarUrl?: string;
  primaryTeam: TeamMembership | null; // null = "no team"
  extraTeams: TeamMembership[];
  pendingInvites: TeamInvite[];
  pendingPrimaryChangeRequest: PrimaryChangeRequest | null;
}

// ============= PLAYER STATS RECORDS =============

export interface PlayerGameRecord {
  id: string;
  date: string;
  teamName: string;
  clubName: string;
  associationName: string;
  opponent: string;
  location: string;
  result?: string;
}

export interface PlayerGoalRecord {
  id: string;
  date: string;
  gameId: string;
  teamName: string;
  clubName: string;
  associationName: string;
  opponent: string;
  minute?: number;
}

// ============= ASSOCIATIONS =============

export interface Association {
  id: string;
  name: string;
  logo?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  themePrimaryColor: string;
  themeSecondaryColor: string;
}

export const mockAssociations: Association[] = [
  {
    id: "1",
    name: "Ballarat Hockey Association",
    logo: "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=100&h=100&fit=crop",
    email: "admin@ballarathockey.org.au",
    phone: "03 5331 1234",
    website: "https://ballarathockey.org.au",
    address: "Prince of Wales Park, Ballarat VIC 3350",
    themePrimaryColor: "#1e3a5f",
    themeSecondaryColor: "#14b8a6",
  },
  {
    id: "2",
    name: "Geelong Hockey Association",
    logo: "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=100&h=100&fit=crop",
    email: "admin@geelonghockey.org.au",
    phone: "03 5221 5678",
    website: "https://geelonghockey.org.au",
    address: "Stead Park, Geelong VIC 3220",
    themePrimaryColor: "#2d5a27",
    themeSecondaryColor: "#f59e0b",
  },
  {
    id: "3",
    name: "Bendigo Hockey Association",
    logo: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=100&h=100&fit=crop",
    email: "admin@bendigohockey.org.au",
    phone: "03 5441 9012",
    website: "https://bendigohockey.org.au",
    address: "Bendigo Stadium, Bendigo VIC 3550",
    themePrimaryColor: "#7c2d12",
    themeSecondaryColor: "#fbbf24",
  },
];

// ============= CLUBS =============

export interface Club {
  id: string;
  associationId: string;
  name: string;
  logo?: string;
  email?: string;
  phone?: string;
  venue?: string;
  address?: string;
  themePrimaryColor: string;
  themeSecondaryColor: string;
}

export const mockClubs: Club[] = [
  {
    id: "1",
    associationId: "1",
    name: "Grampians Hockey Club",
    logo: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=100&h=100&fit=crop",
    email: "info@grampianshc.com.au",
    phone: "03 5331 2345",
    venue: "Prince of Wales Park",
    address: "Prince of Wales Park, Ballarat VIC 3350",
    themePrimaryColor: "#1e3a5f",
    themeSecondaryColor: "#14b8a6",
  },
  {
    id: "2",
    associationId: "1",
    name: "Ballarat Tigers HC",
    logo: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=100&h=100&fit=crop",
    email: "info@ballarattigers.com.au",
    phone: "03 5331 3456",
    venue: "Tiger Arena",
    address: "Tiger Arena, Ballarat VIC 3350",
    themePrimaryColor: "#f97316",
    themeSecondaryColor: "#000000",
  },
  {
    id: "3",
    associationId: "1",
    name: "Wendouree FC Hockey",
    logo: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=100&h=100&fit=crop",
    email: "hockey@wendoureefc.com.au",
    phone: "03 5331 4567",
    venue: "Wendouree Sports Complex",
    address: "Wendouree Sports Complex, Wendouree VIC 3355",
    themePrimaryColor: "#dc2626",
    themeSecondaryColor: "#ffffff",
  },
  {
    id: "4",
    associationId: "2",
    name: "Geelong Saints HC",
    logo: "https://images.unsplash.com/photo-1551958219-acbc608c6377?w=100&h=100&fit=crop",
    email: "info@geelongsaints.com.au",
    phone: "03 5221 6789",
    venue: "Kardinia Park",
    address: "Kardinia Park, Geelong VIC 3220",
    themePrimaryColor: "#1d4ed8",
    themeSecondaryColor: "#ffffff",
  },
  {
    id: "5",
    associationId: "3",
    name: "Bendigo Thunder",
    logo: "https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?w=100&h=100&fit=crop",
    email: "info@bendigothunder.com.au",
    phone: "03 5441 1234",
    venue: "Bendigo Stadium",
    address: "Bendigo Stadium, Bendigo VIC 3550",
    themePrimaryColor: "#7c2d12",
    themeSecondaryColor: "#fbbf24",
  },
];

// ============= TEAMS =============

export interface Team {
  id: string;
  clubId: string;
  name: string;
  grade: string;
}

export const mockTeams: Team[] = [
  { id: "1", clubId: "1", name: "Div2 Men", grade: "Division 2" },
  { id: "2", clubId: "1", name: "Div1 Women", grade: "Division 1" },
  { id: "3", clubId: "1", name: "U17 Mixed", grade: "Under 17" },
  { id: "4", clubId: "1", name: "Div1 Men", grade: "Division 1" },
  { id: "5", clubId: "1", name: "Div3 Women", grade: "Division 3" },
  { id: "6", clubId: "2", name: "Tigers Div1 Men", grade: "Division 1" },
  { id: "7", clubId: "2", name: "Tigers Div2 Women", grade: "Division 2" },
  { id: "8", clubId: "3", name: "Wendouree Premier", grade: "Premier League" },
  { id: "9", clubId: "4", name: "Saints Div1 Men", grade: "Division 1" },
  { id: "10", clubId: "5", name: "Thunder Premier", grade: "Premier League" },
];

// ============= PLAYERS =============

export interface Player {
  id: string;
  name: string;
  position: string;
  number: number;
}

export const mockPlayers: Player[] = [
  { id: "1", name: "James Wilson", position: "Centre Forward", number: 7 },
  { id: "2", name: "Sarah Chen", position: "Goalkeeper", number: 1 },
  { id: "3", name: "Marcus Lee", position: "Left Wing", number: 11 },
  { id: "4", name: "Emily Brown", position: "Centre Half", number: 6 },
  { id: "5", name: "David Singh", position: "Right Half", number: 4 },
  { id: "6", name: "Olivia Taylor", position: "Fullback", number: 3 },
  { id: "7", name: "Michael O'Brien", position: "Right Wing", number: 9 },
  { id: "8", name: "Jessica Nguyen", position: "Left Inside", number: 8 },
  { id: "9", name: "Daniel Kim", position: "Right Inside", number: 10 },
  { id: "10", name: "Sophie Martinez", position: "Left Half", number: 5 },
  { id: "11", name: "Ryan Thompson", position: "Centre Forward", number: 12 },
  { id: "12", name: "Emma Watson", position: "Goalkeeper", number: 22 },
  { id: "13", name: "Liam Johnson", position: "Fullback", number: 2 },
  { id: "14", name: "Ava Williams", position: "Centre Half", number: 14 },
  { id: "15", name: "Noah Davis", position: "Left Wing", number: 17 },
  { id: "16", name: "Isabella Garcia", position: "Right Wing", number: 19 },
  { id: "17", name: "Ethan Miller", position: "Left Inside", number: 15 },
  { id: "18", name: "Mia Anderson", position: "Right Inside", number: 16 },
  { id: "19", name: "Lucas White", position: "Left Half", number: 18 },
  { id: "20", name: "Charlotte Harris", position: "Right Half", number: 20 },
  { id: "21", name: "Benjamin Clark", position: "Centre Forward", number: 21 },
  { id: "22", name: "Amelia Lewis", position: "Fullback", number: 23 },
  { id: "23", name: "Mason Walker", position: "Centre Half", number: 24 },
  { id: "24", name: "Harper Robinson", position: "Left Wing", number: 25 },
];

// ============= CURRENT USER PROFILE =============

export const currentUser: PlayerProfile = {
  id: "1",
  name: "James Wilson",
  email: "james.wilson@email.com",
  phone: "0412 345 678",
  suburb: "Ballarat Central",
  emergencyContact: {
    name: "Sarah Wilson",
    phone: "0413 456 789",
    relationship: "Spouse",
  },
  dateOfBirth: "1992-05-15",
  associationId: "1",
  avatarUrl: undefined,
  primaryTeam: {
    teamId: "1",
    teamName: "Div2 Men",
    clubId: "1",
    clubName: "Grampians Hockey Club",
    associationId: "1",
    associationName: "Ballarat Hockey Association",
    type: "PRIMARY",
    position: "Centre Forward",
    jerseyNumber: 7,
  },
  extraTeams: [
    {
      teamId: "4",
      teamName: "Div1 Men",
      clubId: "1",
      clubName: "Grampians Hockey Club",
      associationId: "1",
      associationName: "Ballarat Hockey Association",
      type: "SECONDARY",
      position: "Left Wing",
      jerseyNumber: 11,
    },
  ],
  pendingInvites: [
    {
      id: "inv-1",
      teamId: "6",
      teamName: "Tigers Div1 Men",
      clubName: "Ballarat Tigers HC",
      type: "FILL_IN",
      gameId: "game-123",
      gameDate: "2025-01-15",
      sentBy: "Coach Mike",
      sentAt: "2024-12-20",
      expiresAt: "2025-01-19",
      status: "PENDING",
    },
  ],
  pendingPrimaryChangeRequest: null,
};

// ============= MOCK PLAYER STATS =============

export const mockPlayerGames: PlayerGameRecord[] = [
  {
    id: "pg-1",
    date: "2024-12-28",
    teamName: "Div2 Men",
    clubName: "Grampians Hockey Club",
    associationName: "Ballarat Hockey Association",
    opponent: "Ballarat Tigers",
    location: "Prince of Wales Park",
    result: "W 3-1",
  },
  {
    id: "pg-2",
    date: "2024-12-21",
    teamName: "Div2 Men",
    clubName: "Grampians Hockey Club",
    associationName: "Ballarat Hockey Association",
    opponent: "Wendouree FC",
    location: "Wendouree Sports Complex",
    result: "D 2-2",
  },
  {
    id: "pg-3",
    date: "2024-12-14",
    teamName: "Div1 Men",
    clubName: "Grampians Hockey Club",
    associationName: "Ballarat Hockey Association",
    opponent: "Sebastopol United",
    location: "Prince of Wales Park",
    result: "W 4-0",
  },
  {
    id: "pg-4",
    date: "2024-12-07",
    teamName: "Div2 Men",
    clubName: "Grampians Hockey Club",
    associationName: "Ballarat Hockey Association",
    opponent: "Ballarat Tigers",
    location: "Tiger Arena",
    result: "L 1-2",
  },
  {
    id: "pg-5",
    date: "2024-11-30",
    teamName: "Div2 Men",
    clubName: "Grampians Hockey Club",
    associationName: "Ballarat Hockey Association",
    opponent: "Wendouree FC",
    location: "Prince of Wales Park",
    result: "W 2-1",
  },
  {
    id: "pg-6",
    date: "2024-11-23",
    teamName: "Div1 Men",
    clubName: "Grampians Hockey Club",
    associationName: "Ballarat Hockey Association",
    opponent: "Wendouree Premier",
    location: "Wendouree Sports Complex",
    result: "W 3-2",
  },
  {
    id: "pg-7",
    date: "2024-11-16",
    teamName: "Div2 Men",
    clubName: "Grampians Hockey Club",
    associationName: "Ballarat Hockey Association",
    opponent: "Sebastopol United",
    location: "Sebastopol Recreation Reserve",
    result: "D 1-1",
  },
  {
    id: "pg-8",
    date: "2024-11-09",
    teamName: "Div2 Men",
    clubName: "Grampians Hockey Club",
    associationName: "Ballarat Hockey Association",
    opponent: "Ballarat Tigers",
    location: "Prince of Wales Park",
    result: "W 2-0",
  },
];

export const mockPlayerGoals: PlayerGoalRecord[] = [
  {
    id: "goal-1",
    date: "2024-12-28",
    gameId: "pg-1",
    teamName: "Div2 Men",
    clubName: "Grampians Hockey Club",
    associationName: "Ballarat Hockey Association",
    opponent: "Ballarat Tigers",
    minute: 23,
  },
  {
    id: "goal-2",
    date: "2024-12-14",
    gameId: "pg-3",
    teamName: "Div1 Men",
    clubName: "Grampians Hockey Club",
    associationName: "Ballarat Hockey Association",
    opponent: "Sebastopol United",
    minute: 45,
  },
  {
    id: "goal-3",
    date: "2024-12-14",
    gameId: "pg-3",
    teamName: "Div1 Men",
    clubName: "Grampians Hockey Club",
    associationName: "Ballarat Hockey Association",
    opponent: "Sebastopol United",
    minute: 67,
  },
  {
    id: "goal-4",
    date: "2024-11-30",
    gameId: "pg-5",
    teamName: "Div2 Men",
    clubName: "Grampians Hockey Club",
    associationName: "Ballarat Hockey Association",
    opponent: "Wendouree FC",
    minute: 12,
  },
  {
    id: "goal-5",
    date: "2024-11-09",
    gameId: "pg-8",
    teamName: "Div2 Men",
    clubName: "Grampians Hockey Club",
    associationName: "Ballarat Hockey Association",
    opponent: "Ballarat Tigers",
    minute: 78,
  },
];

// ============= GAME DATA =============

export const mockLineups: Record<string, { playerId: string; position: string }[]> = {
  "1": [{ playerId: "1", position: "Centre Forward" }],
  "4": [{ playerId: "1", position: "Left Wing" }],
};

export const mockUserAvailability: Record<string, AvailabilityStatus> = {
  "1": "AVAILABLE",
  "2": "AVAILABLE",
  "5": "AVAILABLE",
};

export const mockCoachSelections: Record<string, { status: "SELECTED" | "NOT_SELECTED"; position?: string }> = {
  "1": { status: "SELECTED", position: "Centre Forward" },
  "4": { status: "NOT_SELECTED" },
};

// ============= NOTIFICATIONS =============

export type NotificationType = 
  | "AVAILABILITY_REMINDER" 
  | "COACH_REMINDER" 
  | "UNREAD_CHAT" 
  | "TEAM_INVITE"
  | "FILL_IN_INVITE"
  | "AVAILABILITY_CHANGE"
  | "FILL_IN_DECLINED";

export interface Notification {
  id: string;
  type: NotificationType;
  gameId?: string;
  chatId?: string;
  teamId?: string;
  teamName?: string;
  message: string;
  date: string;
  read: boolean;
}

export const mockNotifications: Notification[] = [
  {
    id: "1",
    type: "AVAILABILITY_REMINDER",
    gameId: "5",
    message: "Add availability for Grampians HC vs Sebastopol (Jan 11)",
    date: "2025-01-06",
    read: false,
  },
  {
    id: "2",
    type: "COACH_REMINDER",
    gameId: "2",
    message: "Coach reminder: Please confirm your availability",
    date: "2024-12-26",
    read: false,
  },
  {
    id: "3",
    type: "UNREAD_CHAT",
    chatId: "general",
    teamId: "1",
    teamName: "Div2 Men",
    message: "5 new messages in Div2 Men Chat",
    date: "2024-12-26",
    read: false,
  },
  {
    id: "4",
    type: "FILL_IN_INVITE",
    teamId: "6",
    teamName: "Tigers Div1 Men",
    gameId: "game-123",
    message: "You've been invited as a fill-in for Tigers Div1 Men",
    date: "2024-12-20",
    read: false,
  },
];

// ============= GAMES =============

export interface Game {
  id: string;
  teamId: string | null;
  homeTeamName: string;
  awayTeamName: string;
  associationName: string;
  grade: string;
  date: string;
  startTime: string;
  location: string;
  status: GameStatus;
  isClubTeamGame: boolean;
}

export const mockGames: Game[] = [
  {
    id: "1",
    teamId: "1",
    homeTeamName: "Grampians HC",
    awayTeamName: "Ballarat Tigers",
    associationName: "Ballarat HA",
    grade: "Division 2",
    date: "2024-12-28",
    startTime: "14:30",
    location: "Prince of Wales Park",
    status: "SCHEDULED",
    isClubTeamGame: true,
  },
  {
    id: "2",
    teamId: "1",
    homeTeamName: "Wendouree FC",
    awayTeamName: "Grampians HC",
    associationName: "Ballarat HA",
    grade: "Division 2",
    date: "2025-01-04",
    startTime: "16:00",
    location: "Wendouree Sports Complex",
    status: "SCHEDULED",
    isClubTeamGame: true,
  },
  {
    id: "3",
    teamId: null,
    homeTeamName: "Ballarat Tigers",
    awayTeamName: "Wendouree FC",
    associationName: "Ballarat HA",
    grade: "Division 2",
    date: "2024-12-28",
    startTime: "12:00",
    location: "Tiger Arena",
    status: "SCHEDULED",
    isClubTeamGame: false,
  },
  {
    id: "4",
    teamId: "2",
    homeTeamName: "Grampians HC Women",
    awayTeamName: "Wendouree Ladies",
    associationName: "Ballarat HA",
    grade: "Division 1",
    date: "2024-12-29",
    startTime: "10:00",
    location: "Prince of Wales Park",
    status: "SCHEDULED",
    isClubTeamGame: true,
  },
  {
    id: "5",
    teamId: "1",
    homeTeamName: "Grampians HC",
    awayTeamName: "Sebastopol United",
    associationName: "Ballarat HA",
    grade: "Division 2",
    date: "2025-01-11",
    startTime: "15:00",
    location: "Prince of Wales Park",
    status: "SCHEDULED",
    isClubTeamGame: true,
  },
  {
    id: "6",
    teamId: null,
    homeTeamName: "Geelong Saints",
    awayTeamName: "Ballarat Tigers",
    associationName: "Geelong HA",
    grade: "Premier League",
    date: "2025-01-05",
    startTime: "18:00",
    location: "Kardinia Park",
    status: "SCHEDULED",
    isClubTeamGame: false,
  },
  {
    id: "7",
    teamId: "3",
    homeTeamName: "Grampians U17",
    awayTeamName: "Tigers U17",
    associationName: "Ballarat HA",
    grade: "Under 17",
    date: "2024-12-30",
    startTime: "09:00",
    location: "Prince of Wales Park",
    status: "SCHEDULED",
    isClubTeamGame: true,
  },
  {
    id: "8",
    teamId: null,
    homeTeamName: "Bendigo Thunder",
    awayTeamName: "Geelong Saints",
    associationName: "Bendigo HA",
    grade: "Division 1",
    date: "2025-01-12",
    startTime: "14:00",
    location: "Bendigo Stadium",
    status: "SCHEDULED",
    isClubTeamGame: false,
  },
  {
    id: "9",
    teamId: "4",
    homeTeamName: "Grampians HC Div1",
    awayTeamName: "Wendouree Premier",
    associationName: "Ballarat HA",
    grade: "Division 1",
    date: "2025-01-18",
    startTime: "16:30",
    location: "Prince of Wales Park",
    status: "SCHEDULED",
    isClubTeamGame: true,
  },
  {
    id: "10",
    teamId: null,
    homeTeamName: "Sebastopol United",
    awayTeamName: "Ballarat Tigers",
    associationName: "Ballarat HA",
    grade: "Division 2",
    date: "2025-01-19",
    startTime: "11:00",
    location: "Sebastopol Recreation Reserve",
    status: "SCHEDULED",
    isClubTeamGame: false,
  },
  {
    id: "11",
    teamId: "2",
    homeTeamName: "Tigers Ladies",
    awayTeamName: "Grampians HC Women",
    associationName: "Ballarat HA",
    grade: "Division 1",
    date: "2025-01-25",
    startTime: "13:00",
    location: "Tiger Arena",
    status: "SCHEDULED",
    isClubTeamGame: true,
  },
  {
    id: "12",
    teamId: null,
    homeTeamName: "Wendouree FC",
    awayTeamName: "Sebastopol United",
    associationName: "Ballarat HA",
    grade: "Division 3",
    date: "2025-01-26",
    startTime: "10:30",
    location: "Wendouree Sports Complex",
    status: "SCHEDULED",
    isClubTeamGame: false,
  },
];

// ============= POSITIONS =============

export const positions = [
  // Strikers
  "Left Wing",
  "Centre Forward",
  "Right Wing",
  // Mid-fielders
  "Left Inside",
  "Centre Half",
  "Right Inside",
  // Backs
  "Left Half",
  "Fullback",
  "Right Half",
  // Goalkeeper
  "Goalkeeper",
];

// ============= HELPER FUNCTIONS =============

export const getClubsByAssociation = (associationId: string): Club[] => {
  return mockClubs.filter((club) => club.associationId === associationId);
};

export const getTeamsByClub = (clubId: string): Team[] => {
  return mockTeams.filter((team) => team.clubId === clubId);
};

export const getAssociationById = (id: string): Association | undefined => {
  return mockAssociations.find((a) => a.id === id);
};

export const getClubById = (id: string): Club | undefined => {
  return mockClubs.find((c) => c.id === id);
};

export const getTeamById = (id: string): Team | undefined => {
  return mockTeams.find((t) => t.id === id);
};
