import { TestInput, TestResult } from './types';

// https://www.braintrust.dev/docs/guides/experiments/write#define-your-own-scorers

/**
 * This custom scorer evaluates whether the correct tools were used in the evaluation.
 * @param args - Object containing the following:
 * @param args.input - Input (originally given in test case)
 * @param args.output - Output from LLM
 * @param args.expected - Expected (originally given in test case)
 * @returns score (1 being correct, 0 being incorrect) along with metadata
 */
export const toolUsage = (args: {
  input: TestInput;
  output: TestResult;
  expected: TestResult;
}) => {
  const expectedTools = args.expected.toolsUsed;
  const actualTools = args.output.toolsUsed;
  const correctToolsUsed = expectedTools.every(tool =>
    actualTools.includes(tool)
  );
  return {
    name: 'Tool Usage',
    score: correctToolsUsed ? 1 : 0,
    metadata: {
      expected_tools: expectedTools,
      actual_tools: actualTools,
      correct: correctToolsUsed,
    },
  };
};
