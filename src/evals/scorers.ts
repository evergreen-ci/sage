// https://www.braintrust.dev/docs/guides/experiments/write#define-your-own-scorers
// See existing scorers at https://github.com/braintrustdata/autoevals/blob/main/js/manifest.ts.

import {
  Factuality as FactualityScorer,
  LLMClassifierFromTemplate,
} from 'autoevals';
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

export enum ToolUsageMode {
  // Use this if you can't predict exactly what tools the agent will use, but know that specific tools should be called.
  Subset = 'subset',
  // Use if you can predict exactly what tools the agent will use.
  ExactMatch = 'exactMatch',
}

/**
 * Custom scorer to evaluate whether the correct tools were used in the evaluation.
 * @param args - Arguments for tool usage evaluation
 * @param args.output - Tools used in the actual output
 * @param args.expected - Expected tools to be used
 * @param args.mode - Mode that describes how the scorer should be evaluated
 * @returns Scoring result with metadata
 */
export const ToolUsage = (args: {
  output: string[];
  expected: string[];
  mode: ToolUsageMode;
}) => {
  const expectedTools = args.expected;
  const actualTools = args.output;

  let correctToolsUsed = false;

  if (args.mode === ToolUsageMode.Subset) {
    correctToolsUsed =
      expectedTools.length <= actualTools.length &&
      expectedTools.every(tool => actualTools.includes(tool));
  } else if (args.mode === ToolUsageMode.ExactMatch) {
    correctToolsUsed =
      expectedTools.length === actualTools.length &&
      expectedTools.every(tool => actualTools.includes(tool));
  }

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

/**
 * Custom scorer to evaluate the technical accuracy of an agent's response.
 * For example, it can be used to evaluate whether a log analysis seems correct.
 * @param args - Arguments for technical accuracy evaluation
 * @param args.output - Actual output from the agent
 * @param args.expected - Expected output
 * @returns Score result
 */
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

/**
 * Safe wrapper for the Factuality scorer that handles JSON parsing errors.
 * The Factuality scorer from autoevals uses an LLM internally and sometimes
 * returns malformed JSON that causes parsing errors. This wrapper catches those
 * errors and retries before returning a default score.
 *
 * This function wraps the scorer call with error handling and retry logic.
 * It should be used in the same way as the Factuality scorer from autoevals.
 * @param args - Arguments for factuality evaluation
 * @param args.expected - Expected output
 * @param args.output - Actual output
 * @param args.input - Input context (optional)
 * @param args.maxRetries - Maximum number of retries (default: 1)
 * @returns Score result with error handling
 */
export const SafeFactuality = async (args: {
  expected: string;
  output: string;
  input?: string;
  maxRetries?: number;
}): Promise<{
  name: string;
  score: number;
  metadata?: Record<string, unknown>;
}> => {
  const maxRetries = args.maxRetries ?? 1;
  let lastError: Error | unknown;

  // Check if this is a JSON parsing error (common issue with autoevals Factuality scorer)
  const isJsonError = (error: unknown): boolean =>
    error instanceof SyntaxError ||
    (error instanceof Error &&
      (error.message.includes('JSON') ||
        error.message.includes('parse') ||
        error.message.includes('Unterminated string') ||
        error.message.includes('Unexpected token')));

  // Helper function to attempt scoring with retry logic
  const attemptScoring = async (
    attempt: number
  ): Promise<{
    name: string;
    score: number;
    metadata?: Record<string, unknown>;
  }> => {
    try {
      // Call the Factuality scorer - autoevals will use the global client if initialized
      // Type assertion needed because LLMClassifierArgs requires auth, but autoevals
      // handles this automatically via the global client when used in Braintrust evals
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (FactualityScorer as any)({
        output: args.output,
        expected: args.expected,
        input: args.input,
      });
      return result;
    } catch (error) {
      lastError = error;

      // Only retry on JSON parsing errors
      if (isJsonError(error) && attempt < maxRetries) {
        // Wait a bit before retrying (exponential backoff)
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return attemptScoring(attempt + 1);
      }

      // If not a JSON error or out of retries, throw to be caught by outer handler
      throw error;
    }
  };

  // Try the scorer with retries
  try {
    return await attemptScoring(0);
  } catch {
    // Error already captured in lastError, continue to error handling below
  }

  // Handle the error after all retries exhausted
  const isJsonErr = isJsonError(lastError);

  if (isJsonErr) {
    console.warn(
      `[SafeFactuality] Factuality scorer encountered a JSON parsing error after ${maxRetries + 1} attempt(s). This may be due to malformed LLM response from the scorer itself. Returning default score of 0.`,
      {
        error:
          lastError instanceof Error ? lastError.message : String(lastError),
        inputLength: args.input?.length ?? 0,
        expectedLength: args.expected.length,
        outputLength: args.output.length,
        attempts: maxRetries + 1,
      }
    );
  } else {
    console.error(
      '[SafeFactuality] Factuality scorer encountered an unexpected error:',
      lastError
    );
  }

  // Return a default score of 0 with metadata indicating the error
  return {
    name: 'Factuality',
    score: 0,
    metadata: {
      error: lastError instanceof Error ? lastError.message : String(lastError),
      error_type: isJsonErr ? 'json_parsing_error' : 'unknown_error',
      note: `Factuality scorer failed after ${maxRetries + 1} attempt(s), defaulting to score of 0`,
      attempts: maxRetries + 1,
    },
  };
};
