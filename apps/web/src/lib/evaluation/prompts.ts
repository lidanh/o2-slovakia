import type { EvaluationCategoryDef, EvaluationContext } from "./types";

const SHARED_CONTEXT = `You are an expert training evaluator for O2 Slovakia's conversation training platform.

IMPORTANT CONTEXT:
- This is a TRAINING platform where a real user (trainee) practices customer service conversations.
- An AI agent plays a ROLE (e.g. an upset customer) as described in the scenario below.
- In the transcript, "customer" is the real USER being evaluated, and "agent" is the AI playing a role.
- Your evaluation MUST focus entirely on THE USER's (customer's) performance — NOT the AI agent.
- Be constructive, specific, and actionable. Cite specific moments from the conversation.`;

export function buildCategoryPrompt(
  category: EvaluationCategoryDef,
  context: EvaluationContext
): string {
  const scenarioSection = context.scenarioPrompt
    ? `\n\nSCENARIO CONTEXT:\n"""\n${context.scenarioPrompt}\n"""`
    : "";

  const itemsSection = category.items
    .map((item, i) => {
      const scoringOptions = item.allowPartial
        ? `"passed" (2 points), "partially_passed" (1 point), or "failed" (0 points)`
        : `"passed" (2 points) or "failed" (0 points)`;
      return `${i + 1}. **${item.label}**
   Assessment question: ${item.question}
   Scoring: ${scoringOptions}`;
    })
    .join("\n");

  const jsonItems = category.items
    .map((item) => {
      const scores = item.allowPartial
        ? `"passed" | "partially_passed" | "failed"`
        : `"passed" | "failed"`;
      return `    {
      "key": "${item.key}",
      "score": <${scores}>,
      "feedback": "<1 compact sentence summary>",
      "verdict": "<'This criterion was met.' | 'This criterion was not met.' | 'This criterion was partially met.'>",
      "evidence": "<2-3 sentences citing specific moments — quote or paraphrase what the trainee said/did>"${item.allowPartial ? `,
      "improvements": ["<concrete actionable bullet>", ...],
      "example": "<a realistic sample phrase the trainee could say>"` : `,
      "improvements": ["<concrete actionable bullet>", ...],
      "example": "<a realistic sample phrase the trainee could say>"`}
    }`;
    })
    .join(",\n");

  return `${SHARED_CONTEXT}

The scenario is "${context.scenarioName}" at difficulty level "${context.difficultyName}".${scenarioSection}

You are evaluating ONLY the category: **${category.emoji} ${category.name}**
${category.description}

Evaluate each of the following items:

${itemsSection}

For each item, score it based on the assessment question.

IMPORTANT per-item output rules:
- "feedback": A single compact sentence (kept for summaries and emails).
- "verdict": Exactly one of: "This criterion was met.", "This criterion was not met.", or "This criterion was partially met."
- "evidence": 2-3 sentences grounded in the actual transcript. Quote or paraphrase specific things the trainee said or did.
- "improvements": (ONLY for "failed" or "partially_passed") An array of 2-4 concrete, actionable bullet points specific to this scenario.
- "example": (ONLY for "failed" or "partially_passed") A realistic sample phrase in quotes the trainee could use in this conversation.
- For "passed" items, OMIT "improvements" and "example" entirely.

Also identify:
- **highlights**: Specific positive or negative moments related to this category
- **suggestions**: Actionable improvement suggestions for this category (1-3 suggestions max)

Return a JSON object with exactly this structure:
{
  "items": [
${jsonItems}
  ],
  "highlights": [
    { "type": "positive" | "negative", "text": "<specific moment from the transcript>" }
  ],
  "suggestions": ["<actionable suggestion>"]
}`;
}

export function buildWauPrompt(context: EvaluationContext): string {
  const scenarioSection = context.scenarioPrompt
    ? `\n\nSCENARIO CONTEXT:\n"""\n${context.scenarioPrompt}\n"""`
    : "";

  return `${SHARED_CONTEXT}

The scenario is "${context.scenarioName}" at difficulty level "${context.difficultyName}".${scenarioSection}

You are evaluating the **🌟 WAU Effect** — whether the user created an above-standard, memorable experience.

Consider these aspects:
- Did the user do something extra that the customer did not expect?
- Did they offer a solution that added value beyond standard procedures?
- Did they end the interaction with a positive emotion that left an above-standard impression?
- Did they share a practical tip or advice beyond what was required?
- Was there genuine initiative and proactivity?

Return a JSON object:
{
  "items": [
    {
      "key": "wau_initiative",
      "score": "passed" | "partially_passed" | "failed",
      "feedback": "<1 compact sentence summary>",
      "verdict": "<'This criterion was met.' | 'This criterion was not met.' | 'This criterion was partially met.'>",
      "evidence": "<2-3 sentences citing specific moments from the transcript>",
      "improvements": ["<only for failed/partially_passed>"],
      "example": "<only for failed/partially_passed — a sample phrase>"
    }
  ],
  "wau_bonus_percentage": <number 0-20>,
  "highlights": [
    { "type": "positive", "text": "<specific above-standard moment>" }
  ],
  "suggestions": []
}

The wau_bonus_percentage should be:
- 0 if the user showed no above-standard initiative
- 5-10 if there was some proactivity or added value
- 10-15 if the user went noticeably above and beyond
- 15-20 if the interaction was truly exceptional and memorable`;
}
