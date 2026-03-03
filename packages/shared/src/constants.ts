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
export const EVALUATION_CATEGORIES = [
  "communication_standards",
  "active_listening",
  "solution",
  "attitude",
  "sales",
  "wau_effect",
] as const;

export type EvaluationCategoryKey = (typeof EVALUATION_CATEGORIES)[number];

// Category display names for UI
export const EVALUATION_CATEGORY_LABELS: Record<EvaluationCategoryKey, string> = {
  communication_standards: "Standards & Communication",
  active_listening: "Active Listening & Perception",
  solution: "Solution",
  attitude: "Attitude",
  sales: "Sales",
  wau_effect: "WAU Effect",
};

export const EVALUATION_CATEGORY_EMOJIS: Record<EvaluationCategoryKey, string> = {
  communication_standards: "\uD83E\uDDED",
  active_listening: "\uD83D\uDC42",
  solution: "\u2699\uFE0F",
  attitude: "\uD83D\uDCAC",
  sales: "\uD83D\uDCA1",
  wau_effect: "\uD83C\uDF1F",
};

// Keep old constant for reference during migration, but mark deprecated
/** @deprecated Use EVALUATION_CATEGORIES instead */
export const FEEDBACK_CATEGORIES = EVALUATION_CATEGORIES;
