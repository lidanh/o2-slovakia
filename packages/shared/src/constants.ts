import type { AssignmentStatus, CallType, ScenarioType, SessionStatus } from "./types";

// ============================================================
// Status Maps
// ============================================================

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  initiated: "Initiated",
  ringing: "Ringing",
  in_progress: "In Progress",
  completed: "Completed",
  failed: "Failed",
  no_answer: "No Answer",
  busy: "Busy",
  canceled: "Canceled",
};

export const SESSION_STATUS_COLORS: Record<SessionStatus, string> = {
  initiated: "default",
  ringing: "processing",
  in_progress: "processing",
  completed: "success",
  failed: "error",
  no_answer: "warning",
  busy: "warning",
  canceled: "default",
};

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
};

export const ASSIGNMENT_STATUS_COLORS: Record<AssignmentStatus, string> = {
  pending: "default",
  in_progress: "processing",
  completed: "success",
};

export const SCENARIO_TYPE_LABELS: Record<ScenarioType, string> = {
  frontline: "Frontline",
  leadership: "Leadership",
};

export const CALL_TYPE_LABELS: Record<CallType, string> = {
  phone: "Phone Call",
  browser: "Browser Call",
};

export const OTP_LENGTH = 6;

// ============================================================
// Navigation
// ============================================================

export interface NavItem {
  key: string;
  label: string;
  icon: string;
  path: string;
  children?: NavItem[];
}

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "DashboardOutlined", path: "/dashboard" },
  { key: "scenarios", label: "Scenarios", icon: "FileTextOutlined", path: "/scenarios" },
  { key: "users", label: "Users", icon: "UserOutlined", path: "/users" },
  { key: "teams", label: "Teams", icon: "TeamOutlined", path: "/teams" },
  { key: "training", label: "Training", icon: "PhoneOutlined", path: "/training" },
  {
    key: "analytics",
    label: "Analytics",
    icon: "BarChartOutlined",
    path: "/analytics",
    children: [
      { key: "analytics-overview", label: "Overview", icon: "BarChartOutlined", path: "/analytics" },
      { key: "leaderboard", label: "Leaderboard", icon: "TrophyOutlined", path: "/analytics/leaderboard" },
    ],
  },
  { key: "settings", label: "Settings", icon: "SettingOutlined", path: "/settings" },
];

// ============================================================
// O2 Brand Colors
// ============================================================

export const O2_COLORS = {
  primary: "#0112AA",
  background: "#E5F2FA",
  text: "#33383B",
  white: "#FFFFFF",
} as const;

// ============================================================
// Misc Constants
// ============================================================

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_BULK_CALL_SIZE = 50;
export const FEEDBACK_CATEGORIES = [
  "communication",
  "active_listening",
  "empathy",
  "problem_solving",
  "confidence",
] as const;
