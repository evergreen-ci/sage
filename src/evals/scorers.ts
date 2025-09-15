// https://www.braintrust.dev/docs/guides/experiments/write#define-your-own-scorers
// See existing scorers at https://github.com/braintrustdata/autoevals/blob/main/js/manifest.ts.

/**
 * Create a generic score checker function
 * @param scoreThresholds - A map of score names to their thresholds
 * @returns A function that checks if scores meet their thresholds
 */
export const createScoreChecker =
  (scoreThresholds: Record<string, number>) =>
  (scores: Record<string, number>): string[] => {
    const messages: string[] = [];

    Object.entries(scoreThresholds).forEach(([key, threshold]) => {
      const score = scores[key] ?? 0; // Default to 0 if undefined
      if (score < threshold) {
        messages.push(`${key} score ${score} is below threshold ${threshold}.`);
      }
    });

    return messages;
  };

/**
 * Custom scorer to evaluate whether the correct tools were used in the evaluation
 * @param args - Arguments for tool usage evaluation
 * @param args.output - Tools used in the actual output
 * @param args.expected - Expected tools to be used
 * @returns Scoring result with metadata
 */
export const toolUsage = (args: { output: string[]; expected: string[] }) => {
  const expectedTools = args.expected;
  const actualTools = args.output;

  const correctToolsUsed: boolean =
    expectedTools.length === actualTools.length &&
    expectedTools.every(tool => actualTools.includes(tool));

  return {
    name: 'ToolUsage',
    score: correctToolsUsed ? 1 : 0,
    metadata: {
      expected_tools: expectedTools,
      actual_tools: actualTools,
      correct: correctToolsUsed,
    },
  };
};
