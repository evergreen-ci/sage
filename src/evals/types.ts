import { AISDKV5OutputStream, OutputSchema } from '@mastra/core/dist/stream';

type MastraAgentOutput = Awaited<
  ReturnType<AISDKV5OutputStream<OutputSchema>['getFullOutput']>
>;

export type ModelOutput<TInput, TOutput> = Promise<
  MastraAgentOutput & { input: TInput; output: TOutput }
>;

export type WorkflowOutput<TInput, TOutput> = Promise<{
  input: TInput;
  output: TOutput;
}>;

export type Scores = {
  Factuality?: number;
  ToolUsage?: number;
  ExactMatch?: number;
};

type TestMetadata<TScores extends Scores> = {
  description: string;
  testName: string;
  scoreThresholds: TScores;
};

export interface ReporterEvalResult<TInput, TOutput, TScores extends Scores> {
  input: TInput;
  output: TOutput & { duration: number };
  expected: TOutput;
  metadata: TestMetadata<TScores>;
  scores: TScores;
  error?: Error;
}

/**
 * Base test case type that all test cases should extend.
 * @param TInput - The input type for the test case.
 * @param TExpected - The expected output type for the test case.
 * @param Tscores - The scores type for the test case. This is a map of score names to their thresholds.
 * @returns The base test case type.
 */
export type BaseTestCase<TInput, TExpected, TScores extends Scores> = {
  input: TInput;
  expected: TExpected;
  metadata: TestMetadata<TScores>;
};
