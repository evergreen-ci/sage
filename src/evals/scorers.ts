// https://www.braintrust.dev/docs/guides/experiments/write#define-your-own-scorers
// See existing scorers at https://github.com/braintrustdata/autoevals/blob/main/js/manifest.ts.

import { LLMClassifierFromTemplate } from 'autoevals';

/**
 * This custom scorer evaluates whether the correct tools were used in the evaluation.
 * @param args - Object containing the following:
 * @param args.output - Output from LLM
 * @param args.expected - Expected (originally given in test case)
 * @returns score (1 being correct, 0 being incorrect) along with metadata
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

export const TechnicalAccuracy = (args: {
  output: string;
  expected: string;
}) => {
  console.log('technicalAccuracy', args);
  const technicalAccuracyClassifier = LLMClassifierFromTemplate({
    name: 'TechnicalAccuracy',
    promptTemplate: `
      You are an expert technical reviewer. You are given a list of expected results. Evaluate the technical accuracy of the following response based on the input context and the expected results.
      `,
    choiceScores: {
      'Not Accurate': 0.0,
      'Somewhat Accurate': 0.25,
      'Partially Accurate': 0.5,
      'Mostly Accurate': 0.75,
      Accurate: 1.0,
    },
  });
  return technicalAccuracyClassifier({
    output: args.output,
    expected: args.expected,
  });
};
