import type {
  FeedbackBreakdown,
  SessionHighlight,
  TranscriptEntry,
} from "@repo/shared";

// ============================================================
// KPIs
// ============================================================

export const kpis = {
  totalSessions: 247,
  avgScore: 76.4,
  totalUsers: 24,
  completionRate: 89.2,
};

// ============================================================
// Users
// ============================================================

export const users = [
  { name: "Ján Novák", email: "jan.novak@o2.sk" },
  { name: "Mária Kováčová", email: "maria.kovacova@o2.sk" },
  { name: "Peter Horváth", email: "peter.horvath@o2.sk" },
  { name: "Eva Szabová", email: "eva.szabova@o2.sk" },
  { name: "Tomáš Kučera", email: "tomas.kucera@o2.sk" },
];

// ============================================================
// Scenario
// ============================================================

export const scenario = {
  name: "Internet Upsell",
  type: "frontline" as const,
  description:
    "Customer calls to report slow internet. Agent should diagnose the issue and offer an upgraded package.",
  prompt:
    "You are a customer calling O2 Slovakia. Your internet has been slow for the past week. You are frustrated but open to solutions. If the agent offers a good deal on a faster package, you might consider upgrading.",
};

// ============================================================
// Difficulty Levels
// ============================================================

export const difficultyLevels = [
  {
    name: "Easy",
    prompt: "Be cooperative and agreeable. Accept the first reasonable offer.",
    resistance_level: 20,
    emotional_intensity: 15,
    cooperation: 90,
  },
  {
    name: "Medium",
    prompt:
      "Be somewhat skeptical. Ask about pricing twice. Need convincing but reachable.",
    resistance_level: 50,
    emotional_intensity: 45,
    cooperation: 60,
  },
  {
    name: "Hard",
    prompt:
      "Be very resistant. Threaten to switch providers. Only accept if given a significant discount.",
    resistance_level: 85,
    emotional_intensity: 75,
    cooperation: 25,
  },
];

// ============================================================
// Feedback Session
// ============================================================

export const feedbackScore = 87;
export const feedbackStarRating = 4;

export const feedbackBreakdown: FeedbackBreakdown = {
  communication: 92,
  active_listening: 85,
  empathy: 78,
  problem_solving: 88,
  confidence: 90,
};

export const feedbackSummary =
  "Excellent performance overall. The agent demonstrated strong communication skills and effectively identified the customer's needs. The upsell was presented naturally and the agent handled objections well. Minor improvement needed in showing empathy during the initial frustration phase.";

export const feedbackSuggestions = [
  "Acknowledge the customer's frustration earlier in the conversation before moving to diagnostics",
  "Use more open-ended questions to better understand the customer's usage patterns",
  "Present the upgrade offer with a clearer comparison of current vs. new speeds",
];

export const feedbackHighlights: SessionHighlight[] = [
  { type: "positive", text: "Excellent rapport building with the customer" },
  {
    type: "positive",
    text: "Smooth transition from troubleshooting to upsell offer",
  },
  {
    type: "positive",
    text: "Clear explanation of package benefits and pricing",
  },
  {
    type: "negative",
    text: "Delayed acknowledgment of customer's initial frustration",
  },
  {
    type: "negative",
    text: "Could have probed deeper into customer's daily internet usage",
  },
];

// ============================================================
// Transcript
// ============================================================

export const transcript: TranscriptEntry[] = [
  {
    role: "agent",
    content:
      "Good afternoon, this is O2 customer support, how can I help you today?",
  },
  {
    role: "customer",
    content:
      "Hi, I've been having really slow internet for the past week and I'm getting frustrated.",
  },
  {
    role: "agent",
    content:
      "I understand that must be frustrating. Let me pull up your account and we'll get to the bottom of this. Can you describe what kind of slowness you're experiencing?",
  },
  {
    role: "customer",
    content:
      "Everything is slow — streaming buffers constantly and video calls keep dropping.",
  },
  {
    role: "agent",
    content:
      "I can see you're on our 100 Mbps plan. Based on what you're describing, your household might benefit from our 500 Mbps package. It's actually on promotion right now.",
  },
  {
    role: "customer",
    content: "How much more would that cost? I'm not looking to spend a fortune.",
  },
  {
    role: "agent",
    content:
      "Great question — it's only €5 more per month, and you'd get 5x the speed. Plus we'd include a new router at no extra charge.",
  },
  {
    role: "customer",
    content: "That actually sounds reasonable. Let's do it.",
  },
];

// ============================================================
// Dashboard chart data (weekly sessions over 8 weeks)
// ============================================================

export const weeklySessionData = [
  { week: "W1", sessions: 18, avgScore: 68 },
  { week: "W2", sessions: 24, avgScore: 71 },
  { week: "W3", sessions: 31, avgScore: 72 },
  { week: "W4", sessions: 28, avgScore: 74 },
  { week: "W5", sessions: 35, avgScore: 75 },
  { week: "W6", sessions: 33, avgScore: 77 },
  { week: "W7", sessions: 38, avgScore: 76 },
  { week: "W8", sessions: 40, avgScore: 79 },
];

// ============================================================
// Call config
// ============================================================

export const callOtp = "847293";
export const callScenarioName = "Internet Upsell";
export const callDifficultyName = "Medium";

// ============================================================
// Assignable Users
// ============================================================

export const assignableUsers = [
  { name: "Ján Novák", role: "Senior Agent", initials: "JN", department: "Customer Care" },
  { name: "Mária Kováčová", role: "Sales Agent", initials: "MK", department: "Sales" },
  { name: "Peter Horváth", role: "Team Lead", initials: "PH", department: "Support" },
  { name: "Eva Szabová", role: "Agent", initials: "ES", department: "Customer Care" },
  { name: "Tomáš Kučera", role: "Junior Agent", initials: "TK", department: "Sales" },
];

// ============================================================
// Scattered feedback showcase — diverse positive & negative items
// ============================================================

export const scatteredFeedbackItems: SessionHighlight[] = [
  { type: "positive", text: "Showed outstanding empathy when customer expressed frustration" },
  { type: "positive", text: "Timed the upsell perfectly after resolving the issue" },
  { type: "positive", text: "Actively listened and paraphrased the customer's concern" },
  { type: "negative", text: "Missed the customer's buying signal about the premium plan" },
  { type: "negative", text: "Took too long to acknowledge the initial complaint" },
  { type: "positive", text: "Handled the price objection with confidence and clarity" },
  { type: "positive", text: "Built natural rapport by referencing the customer's history" },
  { type: "negative", text: "Closing was weak — didn't confirm the next steps clearly" },
  { type: "positive", text: "Demonstrated deep product knowledge across all plan tiers" },
  { type: "negative", text: "Interrupted the customer mid-sentence twice during the call" },
  { type: "positive", text: "Smoothly pivoted from the problem to the solution" },
  { type: "positive", text: "Maintained a warm and professional tone throughout the call" },
  { type: "negative", text: "Jumped to a solution without exploring the customer's needs" },
  { type: "positive", text: "Explained pricing in a clear, easy-to-follow way" },
  { type: "negative", text: "Ended the call without offering any follow-up options" },
  { type: "positive", text: "Opened with a strong, personalized greeting" },
  { type: "positive", text: "Used the customer's name naturally to build connection" },
  { type: "negative", text: "Rushed through key benefits without checking understanding" },
  { type: "positive", text: "Adapted tone and pace when the customer became emotional" },
  { type: "negative", text: "Failed to summarize agreed next steps before hanging up" },
  { type: "positive", text: "Proactively offered an alternative when first option didn't fit" },
  { type: "positive", text: "Showed genuine concern for the customer's situation" },
  { type: "negative", text: "Ignored clear emotional cues when customer sounded upset" },
  { type: "positive", text: "Managed the entire call flow seamlessly from start to finish" },
];
