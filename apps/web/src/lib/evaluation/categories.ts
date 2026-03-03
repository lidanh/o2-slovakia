import type { EvaluationCategoryDef } from "./types";

export const CATEGORY_DEFINITIONS: EvaluationCategoryDef[] = [
  {
    key: "communication_standards",
    name: "Standards & Communication Structure",
    emoji: "🧭",
    weight: 0.10,
    description: "The basis of every contact — shapes the first impression and overall credibility.",
    items: [
      {
        key: "introductory_standard",
        label: "Introductory standard and first impression",
        question: "Did the user introduce themselves professionally and with a positive tone?",
        allowPartial: false,
      },
      {
        key: "verification_context",
        label: "Verification with context and consent",
        question: "Did the user verify the customer identity and explain the context/reason for verification?",
        allowPartial: false,
      },
      {
        key: "interaction_structure",
        label: "Interaction structure, intelligibility and pronunciation",
        question: "Did the user follow a clear call structure, use clear and correct communication without internal slang?",
        allowPartial: true,
      },
      {
        key: "professional_ending",
        label: "Professional end of interaction",
        question: "Did the user end the call on a positive note, thank the customer for cooperation and say goodbye professionally?",
        allowPartial: false,
      },
    ],
  },
  {
    key: "active_listening",
    name: "Active Listening & Perception of the Customer",
    emoji: "👂",
    weight: 0.15,
    description: "Truly understanding the customer through active listening, paraphrasing and responding to needs.",
    items: [
      {
        key: "clarification_understanding",
        label: "Clarification of request or confirmation of understanding",
        question: "Did the user verify they understood the customer correctly — for example, by paraphrasing or confirming understanding?",
        allowPartial: true,
      },
      {
        key: "tone_tempo_adaptation",
        label: "Customize tone, tempo, and communication style",
        question: "Did the user mirror the customer's style? Did they adapt their voice, pace and form of communication to the type of customer?",
        allowPartial: true,
      },
      {
        key: "capturing_signals",
        label: "Capturing details and signals in communication",
        question: "Did the user reflect on information that the customer said, picking up on details and signals?",
        allowPartial: true,
      },
    ],
  },
  {
    key: "solution",
    name: "Solution",
    emoji: "⚙️",
    weight: 0.30,
    description: "Taking responsibility and ensuring a specific result — affects customer trust and satisfaction.",
    items: [
      {
        key: "taking_responsibility",
        label: "Taking responsibility and reviewing the case",
        question: "Did the user express ownership of the case (e.g. 'I'll take care of it for you') and secured a solution?",
        allowPartial: true,
      },
      {
        key: "followup_questions",
        label: "Follow-up questions leading to correct solution",
        question: "Did the user obtain additional information or correctly identify the situation through follow-up questions?",
        allowPartial: true,
      },
      {
        key: "correct_procedure",
        label: "Solution in accordance with procedures and correct SLA",
        question: "Did the user provide correct information in accordance with terms and conditions, choose the correct course of action, and explain the procedure clearly with correct SLAs?",
        allowPartial: true,
      },
      {
        key: "solution_pickup_prevention",
        label: "Picking up the solution and prevention",
        question: "Did the user pick up the solution and naturally connect it with selfcare options?",
        allowPartial: true,
      },
      {
        key: "summarization",
        label: "Final or interim summarization",
        question: "Did the user make sure that the customer understands the solution — e.g. by continuous summarization or summary at the end?",
        allowPartial: true,
      },
    ],
  },
  {
    key: "attitude",
    name: "Attitude",
    emoji: "💬",
    weight: 0.15,
    description: "Improves brand perception. Attitude and empathy create an atmosphere of trust and respect.",
    items: [
      {
        key: "positive_tone_empathy",
        label: "Positive tone, empathy and authentic expression",
        question: "Did the user show interest in the specific situation? Did they seem sincere and authentic? Did they maintain a positive tone throughout and use polite phrases ('thank you', 'please')?",
        allowPartial: true,
      },
      {
        key: "respect_calm_emotions",
        label: "Respect and calm management of emotions",
        question: "Was the user patient and respectful during the call? Did they give the customer space to finish without interruption? Did they handle an upset customer calmly?",
        allowPartial: true,
      },
    ],
  },
  {
    key: "sales",
    name: "Sales",
    emoji: "💡",
    weight: 0.30,
    description: "Ability to turn interaction into value — recommending suitable and relevant solutions using behavioral techniques.",
    items: [
      {
        key: "needs_identification",
        label: "Identification of needs / Customer situation",
        question: "Did the user ask probing questions about the customer's needs/situation? Areas: Current provider, Family and group O2 Spolu/O2 Connect, Use of 3rd-party applications, Price, Data needs, Need for calls and SMS, HW needs, Commitment.",
        allowPartial: true,
      },
      {
        key: "offer_relevance_bridging",
        label: "Primary Offer Relevance / Bridging",
        question: "Did the user bridge from the solution to the offer, and was the offer chosen correctly in relation to the customer's needs?",
        allowPartial: true,
      },
      {
        key: "presentation_through_utility",
        label: "Presentation through utility",
        question: "Did the user use the language of added value? Did they present the product and services through benefit to the customer?",
        allowPartial: true,
      },
      {
        key: "objection_handling",
        label: "Acceptance and handling of objection",
        question: "Did the user actively pursue acceptance of objections, find out the reason for lack of interest, and argue effectively?",
        allowPartial: true,
      },
      {
        key: "closing_sale",
        label: "Closing a sale / Creating a lead",
        question: "Did the user take advantage of the momentum to complete the sale? If the deal was not closed immediately, was a lead created and follow-up contact arranged?",
        allowPartial: true,
      },
      {
        key: "additional_offer",
        label: "Additional offer",
        question: "Did the user apply relevant additional offers, e.g.: Connect, O2TV, HW, ACC, Fuse?",
        allowPartial: true,
      },
      {
        key: "behavioral_techniques",
        label: "Use of behavioral techniques in sales",
        question: "Did the user use at least 1 technique based on behavioral principles in sales (e.g. Hook, Loss Principle, anchoring, scarcity)?",
        allowPartial: true,
      },
    ],
  },
  {
    key: "wau_effect",
    name: "WAU Effect",
    emoji: "🌟",
    weight: 0.0, // Bonus — not part of base weight
    description: "Creating a moment that pleasantly surprises the customer — above-standard experience, initiative, added value.",
    items: [
      {
        key: "wau_initiative",
        label: "Initiative, proactivity, and above-standard experience",
        question: "Did the assistant do something extra that the customer did not expect? Did they offer a solution with added value? Did they end with a positive emotion that left an above-standard impression? Did they share a practical tip or advice beyond standard procedures?",
        allowPartial: true,
      },
    ],
  },
];

// Helper to get category definition by key
export function getCategoryDef(key: string): EvaluationCategoryDef | undefined {
  return CATEGORY_DEFINITIONS.find((c) => c.key === key);
}
