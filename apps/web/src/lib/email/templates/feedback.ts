import type { FeedbackBreakdown, SessionHighlight, FeedbackDetail } from "@repo/shared";
import {
  EVALUATION_CATEGORY_LABELS,
  EVALUATION_CATEGORY_EMOJIS,
  type EvaluationCategoryKey,
} from "@repo/shared";

type Language = "en" | "sk" | "hu";

const LABELS: Record<Language, {
  trainingFeedback: string;
  trainee: string;
  scenario: string;
  difficulty: string;
  date: string;
  summary: string;
  detailedBreakdown: string;
  suggestionsForImprovement: string;
  strengths: string;
  areasToImprove: string;
  viewFullReport: string;
  passed: string;
  partial: string;
  failed: string;
  whatCouldBeImproved: string;
  exampleBetterApproach: string;
}> = {
  en: {
    trainingFeedback: "TRAINING FEEDBACK",
    trainee: "Trainee",
    scenario: "Scenario",
    difficulty: "Difficulty",
    date: "Date",
    summary: "Summary",
    detailedBreakdown: "Detailed Breakdown",
    suggestionsForImprovement: "Suggestions for Improvement",
    strengths: "Strengths",
    areasToImprove: "Areas to Improve",
    viewFullReport: "View Full Report",
    passed: "Passed",
    partial: "Partial",
    failed: "Failed",
    whatCouldBeImproved: "What could be improved",
    exampleBetterApproach: "Example of a better approach",
  },
  sk: {
    trainingFeedback: "SPÄTNÁ VÄZBA Z TRÉNINGU",
    trainee: "Účastník",
    scenario: "Scenár",
    difficulty: "Obtiažnosť",
    date: "Dátum",
    summary: "Zhrnutie",
    detailedBreakdown: "Podrobný rozpis",
    suggestionsForImprovement: "Návrhy na zlepšenie",
    strengths: "Silné stránky",
    areasToImprove: "Oblasti na zlepšenie",
    viewFullReport: "Zobraziť celú správu",
    passed: "Splnené",
    partial: "Čiastočne",
    failed: "Nesplnené",
    whatCouldBeImproved: "Čo by sa dalo zlepšiť",
    exampleBetterApproach: "Príklad lepšieho prístupu",
  },
  hu: {
    trainingFeedback: "KÉPZÉSI VISSZAJELZÉS",
    trainee: "Résztvevő",
    scenario: "Forgatókönyv",
    difficulty: "Nehézség",
    date: "Dátum",
    summary: "Összefoglalás",
    detailedBreakdown: "Részletes bontás",
    suggestionsForImprovement: "Javaslatok a fejlesztésre",
    strengths: "Erősségek",
    areasToImprove: "Fejlesztendő területek",
    viewFullReport: "Teljes jelentés megtekintése",
    passed: "Megfelelt",
    partial: "Részleges",
    failed: "Nem felelt meg",
    whatCouldBeImproved: "Mit lehetne javítani",
    exampleBetterApproach: "Jobb megközelítés példája",
  },
};

export interface FeedbackEmailParams {
  userName: string;
  scenarioName: string;
  difficultyName: string;
  completedAt: string; // ISO date string
  score: number;
  starRating: number;
  feedbackSummary: string;
  feedbackBreakdown: FeedbackBreakdown;
  suggestions: string[];
  highlights: SessionHighlight[];
  sessionUrl: string;
  language?: Language;
  localizedSummary?: string;
  localizedSuggestions?: string[];
  localizedHighlights?: SessionHighlight[];
  localizedItemFeedback?: Record<string, Record<string, string>>; // categoryKey → itemKey → translated feedback
  localizedItemFeedbackDetail?: Record<string, Record<string, FeedbackDetail>>; // categoryKey → itemKey → translated detail
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateSlovak(isoDate: string): string {
  const d = new Date(isoDate);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

function scoreColor(score: number): string {
  if (score >= 80) return "#52c41a";
  if (score >= 60) return "#faad14";
  return "#ff4d4f";
}

function barColor(pct: number): string {
  if (pct >= 75) return "#059669";
  if (pct >= 50) return "#D97706";
  return "#EF4444";
}

function stars(rating: number): string {
  return "&#9733;".repeat(rating) + "&#9734;".repeat(5 - rating);
}

function itemColor(score: string, l: typeof LABELS["en"]): { bg: string; text: string; label: string } {
  switch (score) {
    case "passed":
      return { bg: "#F0FDF4", text: "#15803D", label: l.passed };
    case "partially_passed":
      return { bg: "#FFFBEB", text: "#B45309", label: l.partial };
    default:
      return { bg: "#FEF2F2", text: "#DC2626", label: l.failed };
  }
}

export function buildFeedbackHtml(params: FeedbackEmailParams): string {
  const {
    userName,
    scenarioName,
    difficultyName,
    completedAt,
    score,
    starRating,
    feedbackSummary,
    feedbackBreakdown,
    suggestions,
    highlights,
    sessionUrl,
    language = "en",
    localizedSummary,
    localizedSuggestions,
    localizedHighlights,
    localizedItemFeedback,
    localizedItemFeedbackDetail,
  } = params;

  const l = LABELS[language];
  const displaySummary = localizedSummary ?? feedbackSummary;
  const displaySuggestions = localizedSuggestions ?? suggestions;
  const displayHighlights = localizedHighlights ?? highlights;

  const categories = feedbackBreakdown.categories ?? {};
  const categoryKeys = Object.keys(categories).filter((k) => k !== "wau_effect");
  const wauBonus = feedbackBreakdown.wau_bonus_percentage ?? 0;

  // Build category rows
  const categoryRows = categoryKeys
    .map((key) => {
      const cat = categories[key];
      const label =
        EVALUATION_CATEGORY_LABELS[key as EvaluationCategoryKey] ?? key;
      const emoji =
        EVALUATION_CATEGORY_EMOJIS[key as EvaluationCategoryKey] ?? "";
      const pct = cat.score_percentage ?? 0;
      const weight = Math.round((cat.weight ?? 0) * 100);
      const color = barColor(pct);

      // Build item rows for this category
      const itemRows = (cat.items ?? [])
        .map((item) => {
          const ic = itemColor(item.score, l);
          const detail: FeedbackDetail | undefined = localizedItemFeedbackDetail?.[key]?.[item.key] ?? item.feedback_detail;
          const itemFeedback = localizedItemFeedback?.[key]?.[item.key] ?? item.feedback;

          let feedbackHtml: string;
          if (detail) {
            feedbackHtml = `<div style="font-size: 12px; font-weight: 600; color: #1a1a2e; margin-bottom: 2px;">${escapeHtml(detail.verdict)}</div>
                      <div style="font-size: 12px; color: #6B7280; line-height: 1.5;">${escapeHtml(detail.evidence)}</div>`;
            if (detail.improvements && detail.improvements.length > 0) {
              feedbackHtml += `<div style="font-size: 11px; font-weight: 600; color: #B45309; margin-top: 6px;">${escapeHtml(l.whatCouldBeImproved)}:</div>
                      <ul style="margin: 2px 0 0 16px; padding: 0; font-size: 12px; color: #374151; line-height: 1.5;">
                        ${detail.improvements.map((imp) => `<li>${escapeHtml(imp)}</li>`).join("")}
                      </ul>`;
            }
            if (detail.example) {
              feedbackHtml += `<div style="margin-top: 6px; padding: 6px 10px; background: #F0FDF4; border-radius: 6px; border-left: 3px solid #059669;">
                        <div style="font-size: 10px; font-weight: 600; color: #059669;">${escapeHtml(l.exampleBetterApproach)}:</div>
                        <div style="font-size: 12px; color: #374151; font-style: italic;">&ldquo;${escapeHtml(detail.example)}&rdquo;</div>
                      </div>`;
            }
          } else {
            feedbackHtml = `<div style="font-size: 12px; color: #6B7280; line-height: 1.5;">${escapeHtml(itemFeedback)}</div>`;
          }

          return `
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #F5F5F5; vertical-align: top;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="70" style="vertical-align: top; padding-right: 8px;">
                      <span style="display: inline-block; padding: 2px 8px; font-size: 10px; font-weight: 600; color: ${ic.text}; background: ${ic.bg}; border-radius: 4px;">${ic.label}</span>
                    </td>
                    <td style="vertical-align: top;">
                      <div style="font-size: 13px; font-weight: 600; color: #1a1a2e; margin-bottom: 2px;">${escapeHtml(item.label)}</div>
                      ${feedbackHtml}
                    </td>
                    <td width="40" style="vertical-align: top; text-align: right; font-size: 12px; color: #9CA3AF; white-space: nowrap;">
                      ${item.earned_points}/${item.max_points}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`;
        })
        .join("");

      return `
        <!-- Category: ${escapeHtml(label)} -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
          <tr>
            <td style="background: #F8F9FA; border-radius: 10px; padding: 14px 16px;">
              <!-- Category header -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 10px;">
                <tr>
                  <td style="font-size: 14px; font-weight: 600; color: #1a1a2e;">
                    ${emoji} ${escapeHtml(label)}
                    <span style="font-size: 11px; font-weight: 400; color: #9CA3AF; margin-left: 6px;">${weight}%</span>
                  </td>
                  <td width="60" style="text-align: right; font-size: 14px; font-weight: 700; color: ${color};">
                    ${pct}%
                  </td>
                </tr>
              </table>
              <!-- Progress bar -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
                <tr>
                  <td style="background: #E5E7EB; border-radius: 4px; height: 6px; padding: 0;">
                    <div style="background: ${color}; width: ${pct}%; height: 6px; border-radius: 4px;"></div>
                  </td>
                </tr>
              </table>
              <!-- Items -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${itemRows}
              </table>
            </td>
          </tr>
        </table>`;
    })
    .join("");

  // Build suggestions
  const suggestionRows = displaySuggestions
    .map(
      (s, i) => `
      <tr>
        <td width="28" style="vertical-align: top; padding: 4px 0;">
          <div style="width: 22px; height: 22px; border-radius: 6px; background: linear-gradient(135deg, #EEF2FF, #E0E7FF); color: #0112AA; font-size: 11px; font-weight: 700; text-align: center; line-height: 22px;">${i + 1}</div>
        </td>
        <td style="vertical-align: top; padding: 4px 0 4px 8px; font-size: 13px; line-height: 1.6; color: #374151;">
          ${escapeHtml(s)}
        </td>
      </tr>`
    )
    .join("");

  // Build highlights
  const positiveHighlights = displayHighlights.filter((h) => h.type === "positive");
  const negativeHighlights = displayHighlights.filter((h) => h.type === "negative");

  const highlightList = (items: SessionHighlight[], color: string) =>
    items
      .map(
        (h) => `
      <tr>
        <td width="14" style="vertical-align: top; padding: 6px 0;">
          <div style="width: 6px; height: 6px; border-radius: 50%; background: ${color}; margin-top: 5px;"></div>
        </td>
        <td style="vertical-align: top; padding: 6px 0 6px 6px; font-size: 13px; line-height: 1.5; color: #374151;">
          ${escapeHtml(h.text)}
        </td>
      </tr>`
      )
      .join("");

  return `<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Training Feedback</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f5f7; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color: #0112AA; background: linear-gradient(135deg, #0112AA, #2563EB); padding: 32px 40px; text-align: center;">
              <div style="font-size: 32px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">O2 Trainer</div>
              <div style="font-size: 13px; color: rgba(255, 255, 255, 0.7); margin-top: 4px; letter-spacing: 0.5px;">${escapeHtml(l.trainingFeedback)}</div>
            </td>
          </tr>

          <!-- Score Hero Section -->
          <tr>
            <td style="padding: 32px 40px 24px; text-align: center; background: linear-gradient(180deg, #F8F9FF 0%, #FFFFFF 100%);">
              <!-- Score circle -->
              <div style="display: inline-block; width: 80px; height: 80px; border-radius: 50%; border: 4px solid ${scoreColor(score)}; line-height: 80px; font-size: 28px; font-weight: 800; color: ${scoreColor(score)}; margin-bottom: 8px;">
                ${score}
              </div>
              <div style="font-size: 24px; color: #D4A017; letter-spacing: 2px; margin-bottom: 12px;">
                ${stars(starRating)}
              </div>
              ${wauBonus > 0 ? `<div style="display: inline-block; padding: 4px 12px; background: linear-gradient(135deg, #FFFBEB, #FEF3C7); color: #B45309; font-size: 11px; font-weight: 600; border-radius: 6px; margin-bottom: 12px;">&#127775; WAU Bonus: +${wauBonus}%</div>` : ""}
            </td>
          </tr>

          <!-- Session Info -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #F8F9FA; border-radius: 12px; padding: 16px 20px;">
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #6B7280;">
                    <strong style="color: #1a1a2e;">${escapeHtml(l.trainee)}:</strong> ${escapeHtml(userName)}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #6B7280;">
                    <strong style="color: #1a1a2e;">${escapeHtml(l.scenario)}:</strong> ${escapeHtml(scenarioName)}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #6B7280;">
                    <strong style="color: #1a1a2e;">${escapeHtml(l.difficulty)}:</strong> ${escapeHtml(difficultyName)}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #6B7280;">
                    <strong style="color: #1a1a2e;">${escapeHtml(l.date)}:</strong> ${formatDateSlovak(completedAt)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Feedback Summary -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <div style="font-size: 15px; font-weight: 600; color: #1a1a2e; margin-bottom: 8px;">${escapeHtml(l.summary)}</div>
              <div style="font-size: 14px; line-height: 1.7; color: #374151;">
                ${escapeHtml(displaySummary)}
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="height: 1px; background: #E5E7EB;"></div>
            </td>
          </tr>

          <!-- Category Breakdown -->
          <tr>
            <td style="padding: 24px 40px;">
              <div style="font-size: 15px; font-weight: 600; color: #1a1a2e; margin-bottom: 16px;">${escapeHtml(l.detailedBreakdown)}</div>
              ${categoryRows}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="height: 1px; background: #E5E7EB;"></div>
            </td>
          </tr>

          <!-- Suggestions -->
          ${displaySuggestions.length > 0 ? `
          <tr>
            <td style="padding: 24px 40px;">
              <div style="font-size: 15px; font-weight: 600; color: #1a1a2e; margin-bottom: 12px;">${escapeHtml(l.suggestionsForImprovement)}</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${suggestionRows}
              </table>
            </td>
          </tr>
          ` : ""}

          <!-- Highlights -->
          ${positiveHighlights.length > 0 || negativeHighlights.length > 0 ? `
          <tr>
            <td style="padding: 0 40px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  ${positiveHighlights.length > 0 ? `
                  <td width="48%" style="vertical-align: top;">
                    <div style="font-size: 13px; font-weight: 600; color: #059669; margin-bottom: 8px;">&#10003; ${escapeHtml(l.strengths)}</div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${highlightList(positiveHighlights, "#059669")}
                    </table>
                  </td>
                  ` : ""}
                  ${positiveHighlights.length > 0 && negativeHighlights.length > 0 ? `<td width="4%"></td>` : ""}
                  ${negativeHighlights.length > 0 ? `
                  <td width="48%" style="vertical-align: top;">
                    <div style="font-size: 13px; font-weight: 600; color: #EF4444; margin-bottom: 8px;">&#10007; ${escapeHtml(l.areasToImprove)}</div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${highlightList(negativeHighlights, "#EF4444")}
                    </table>
                  </td>
                  ` : ""}
                </tr>
              </table>
            </td>
          </tr>
          ` : ""}

          <!-- CTA Button -->
          <tr>
            <td style="padding: 8px 40px 32px; text-align: center;">
              <a href="${escapeHtml(sessionUrl)}"
                 style="display: inline-block; padding: 14px 40px; background-color: #0112AA; background: linear-gradient(135deg, #0112AA, #2563EB); color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 12px; box-shadow: 0 4px 16px rgba(1, 18, 170, 0.3);">
                ${escapeHtml(l.viewFullReport)}
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 28px; border-top: 1px solid #f0f0f0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #C0C0C0;">O2 Trainer Platform</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
