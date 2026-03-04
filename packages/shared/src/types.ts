// ============================================================
// Database Row Types
// ============================================================

export interface Team {
  id: string;
  name: string;
  description: string | null;
  parent_team_id: string | null;
  created_at: string;
  updated_at: string;
}

export type UserRole = "admin" | "team_manager" | "user";
export type UserStatus = "invited" | "active";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  team_id: string | null;
  avatar_url: string | null;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Scenario {
  id: string;
  name: string;
  description: string | null;
  prompt: string;
  type: ScenarioType;
  is_active: boolean;
  agent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WonderfulAgent {
  id: string;
  name: string;
  display_name?: string;
  description?: string;
  mode?: string;
}

export interface DifficultyLevel {
  id: string;
  scenario_id: string;
  name: string;
  prompt: string;
  resistance_level: number;
  emotional_intensity: number;
  cooperation: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Assignment {
  id: string;
  user_id: string;
  scenario_id: string;
  difficulty_level_id: string;
  assigned_by: string | null;
  status: AssignmentStatus;
  created_at: string;
}

export interface TrainingSession {
  id: string;
  user_id: string;
  scenario_id: string;
  difficulty_level_id: string | null;
  assignment_id: string | null;
  call_sid: string | null;
  call_duration: number | null;
  communication_id: string | null;
  call_type: CallType;
  otp: string | null;
  otp_expires_at: string | null;
  status: SessionStatus;
  score: number | null;
  star_rating: number | null;
  feedback_summary: string | null;
  feedback_breakdown: FeedbackBreakdown | null;
  suggestions: string[] | null;
  highlights: SessionHighlight[] | null;
  transcript: TranscriptEntry[] | null;
  audio_url: string | null;
  twilio_metadata: Record<string, unknown> | null;
  started_at: string | null;
  answered_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentConfig {
  id: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Enums & Literal Types
// ============================================================

export type ScenarioType = "frontline" | "leadership";
export type AssignmentStatus = "pending" | "in_progress" | "completed";
export type SessionStatus =
  | "initiated"
  | "ringing"
  | "in_progress"
  | "completed"
  | "failed"
  | "no_answer"
  | "busy"
  | "canceled";
export type CallType = "phone" | "browser";

// ============================================================
// Nested / JSONB Types
// ============================================================

export type ItemScore = "passed" | "partially_passed" | "failed";

export interface FeedbackItemResult {
  key: string;
  label: string;
  score: ItemScore;
  max_points: number;
  earned_points: number;
  feedback: string;
}

export interface FeedbackCategoryResult {
  weight: number;
  score_percentage: number;
  items: FeedbackItemResult[];
  highlights: SessionHighlight[];
  suggestions: string[];
}

export interface FeedbackBreakdown {
  categories: Record<string, FeedbackCategoryResult>;
  wau_bonus_percentage: number;
  sales_included: boolean;
}

export interface SessionHighlight {
  type: "positive" | "negative";
  text: string;
  timestamp?: number;
}

export interface TranscriptEntry {
  role: "agent" | "customer";
  content: string;
  timestamp?: number;
}

// ============================================================
// API Request / Response Types
// ============================================================

export interface CreateScenarioPayload {
  name: string;
  description?: string;
  prompt: string;
  type: ScenarioType;
  is_active?: boolean;
  agent_id?: string | null;
  difficulty_levels?: CreateDifficultyLevelPayload[];
}

export interface UpdateScenarioPayload {
  name?: string;
  description?: string;
  prompt?: string;
  type?: ScenarioType;
  is_active?: boolean;
  agent_id?: string | null;
}

export interface CreateDifficultyLevelPayload {
  name: string;
  prompt: string;
  resistance_level: number;
  emotional_intensity: number;
  cooperation: number;
  sort_order: number;
}

export interface InviteUserPayload {
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  team_id?: string;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  phone?: string;
  role?: UserRole;
  team_id?: string | null;
}

export interface CreateTeamPayload {
  name: string;
  description?: string;
  parent_team_id?: string | null;
}

export interface UpdateTeamPayload {
  name?: string;
  description?: string;
  parent_team_id?: string | null;
}

export interface CreateAssignmentsPayload {
  userIds: string[];
  scenarioId: string;
  difficultyLevelId: string;
}

export interface DeleteAssignmentsPayload {
  assignmentIds: string[];
}

export interface TriggerCallPayload {
  assignmentId: string;
}

export interface BulkCallPayload {
  scenarioId: string;
  difficultyLevelId: string;
}

export interface BrowserCallPayload {
  assignmentId: string;
}

export interface BrowserCallResponse {
  sessionId: string;
  otp: string;
  callUrl: string;
}

export interface BrowserCallCompletePayload {
  token: string;
  communicationId: string;
  transcript?: TranscriptEntry[];
}

export interface FeedbackPayload {
  transcript: TranscriptEntry[];
  scenarioName: string;
  difficultyName: string;
}

// ============================================================
// Wonderful Integration Types
// ============================================================

export interface WonderfulScenarioResponse {
  prompt: string;
  resistance_level: number;
  emotional_intensity: number;
  cooperation: number;
  scenario_name: string;
  difficulty_name: string;
}

export interface WonderfulGuidanceRequest {
  communication_id: string;
  transcript: TranscriptEntry[];
}

export interface WonderfulGuidanceResponse {
  guidance: string;
}

// ============================================================
// Wonderful Voice WebSocket Message Types
// ============================================================

// Server -> Client
export interface WonderfulVoiceStartMessage {
  event: "start";
  communication_id: string;
}
export interface WonderfulVoiceAudioMessage {
  event: "audio";
  payload: string; // base64 mu-law
}
export interface WonderfulVoiceClearMessage {
  event: "clear";
}
export interface WonderfulVoiceMarkMessage {
  event: "mark";
  mark: string;
}
export interface WonderfulVoiceStopMessage {
  event: "stop";
}

export type WonderfulVoiceServerMessage =
  | WonderfulVoiceStartMessage
  | WonderfulVoiceAudioMessage
  | WonderfulVoiceClearMessage
  | WonderfulVoiceMarkMessage
  | WonderfulVoiceStopMessage;

// ============================================================
// Analytics Types
// ============================================================

export interface AnalyticsKPIs {
  totalSessions: number;
  avgScore: number;
  avgCallDuration: number;
  completionRate: number;
  totalUsers: number;
  activeScenarios: number;
}

export interface LeaderboardEntry {
  user_id: string;
  user_name: string;
  team_name: string | null;
  avg_score: number;
  total_sessions: number;
  avg_star_rating: number;
}

// ============================================================
// Joined / Extended Types (for UI)
// ============================================================

export interface UserWithTeam extends User {
  team: Team | null;
}

export interface AssignmentWithDetails extends Assignment {
  user: User;
  scenario: Scenario;
  difficulty_level: DifficultyLevel;
}

export interface SessionWithDetails extends TrainingSession {
  user: User;
  scenario: Scenario;
  difficulty_level: DifficultyLevel | null;
}

export interface TeamWithMembers extends Team {
  members: User[];
}

export interface ScenarioWithLevels extends Scenario {
  difficulty_levels: DifficultyLevel[];
}
