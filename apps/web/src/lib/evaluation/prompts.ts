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
      return `    { "key": "${item.key}", "score": <${scores}>, "feedback": "<1-2 sentence explanation citing specific transcript moments>" }`;
    })
    .join(",\n");

  return `${SHARED_CONTEXT}

The scenario is "${context.scenarioName}" at difficulty level "${context.difficultyName}".${scenarioSection}

You are evaluating ONLY the category: **${category.emoji} ${category.name}**
${category.description}

Evaluate each of the following items:

${itemsSection}

For each item, score it based on the assessment question. Cite specific moments from the transcript in your feedback.

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
    { "key": "wau_initiative", "score": "passed" | "partially_passed" | "failed", "feedback": "<explanation>" }
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
