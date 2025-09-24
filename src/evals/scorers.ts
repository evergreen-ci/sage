// https://www.braintrust.dev/docs/guides/experiments/write#define-your-own-scorers
// See existing scorers at https://github.com/braintrustdata/autoevals/blob/main/js/manifest.ts.

import { LLMClassifierFromTemplate } from 'autoevals';
import { ScorerFunction, BaseScores } from './types';

/**
 * Create a generic score checker function
 * @param scores - A map of score names to their values
 * @param scoreThresholds - A map of score names to their thresholds
 * @param results - A map of score names to their expected and actual values
 * @returns A function that checks if scores meet their thresholds
 */
export const createScoreChecker: ScorerFunction<BaseScores, object> = (
  scores,
  scoreThresholds,
  results
) => {
  const messages: string[] = [];

  Object.entries(scoreThresholds).forEach(([key, threshold]) => {
    const score = scores[key] ?? 0; // Default to 0 if undefined
    if (score < threshold) {
      if (results?.output && results?.expected) {
        // Remove 'duration' property from output if present
        let outputWithoutDuration = results.output as object;
        if (
          outputWithoutDuration &&
          typeof outputWithoutDuration === 'object' &&
          'duration' in outputWithoutDuration
        ) {
          // Create a shallow copy without 'duration'
          const { duration, ...rest } = outputWithoutDuration as Record<
            string,
            unknown
          >;
          outputWithoutDuration = rest;
        }
        messages.push(
          `${key} score ${score} is below threshold ${threshold}.\n Expected: ${JSON.stringify(results.expected)}.\n Output: ${JSON.stringify(outputWithoutDuration)}.`
        );
      } else {
        messages.push(`${key} score ${score} is below threshold ${threshold}.`);
      }
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

export const TechnicalAccuracy = (args: {
  output: string;
  expected: string;
}) => {
  const technicalAccuracyClassifier = LLMClassifierFromTemplate({
    name: 'TechnicalAccuracy',
    promptTemplate: `
      You are comparing a submitted answer to an expert answer on a given question. Here is the data:
      [BEGIN DATA]
      ************
      [Question]: {{input}}
      ************
      [Expert]: {{expected}}
      ************
      [Submission]: {{output}}
      ************
      [END DATA]

      You are an expert technical reviewer. You are given a expected output and an output. Evaluate the technical accuracy of the following response based on the input context and the expected results.
      Ignore any differences in style, grammar, or punctuation. Focus on the technical accuracy of the response.

      Return the score based on the following scale:
      (Not Accurate) The submitted answer is not accurate or does make sense.
      (Somewhat Accurate) The submitted answer is somewhat accurate but there are some minor inaccuracies.
      (Partially Accurate) The submitted answer is partially accurate but there are some major inaccuracies.
      (Mostly Accurate) The submitted answer is mostly accurate but there are some minor inaccuracies.
      (Accurate) The submitted answer is accurate and makes sense.
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
  });
};
