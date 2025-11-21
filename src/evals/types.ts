import { MastraModelOutput } from '@mastra/core/dist/stream';
// Base types
export type BaseScores = {
  [key: string]: number;
};

// Metadata types
type TestMetadata<TScores extends BaseScores> = {
  description: string;
  testName: string;
  scoreThresholds: TScores;
};

// Test-related types
/**
 * Base test case type that all test cases should extend.
 * @param TInput - The input type for the test case.
 * @param TExpected - The expected output type for the test case.
 * @param Tscores - The scores type for the test case. This is a map of score names to their thresholds.
 * @returns The base test case type.
 */
export type BaseTestCase<TInput, TExpected, TScores extends BaseScores> = {
  input: TInput;
  expected: TExpected;
  metadata: TestMetadata<TScores>;
};

export type ResolvedTestCase<
  TInput,
  TExpected,
  TScores extends BaseScores,
> = BaseTestCase<TInput, TExpected, TScores> & {
  received: TExpected;
};

// Result types
export interface ReporterEvalResult<
  TestCase extends BaseTestCase<unknown, object, BaseScores>,
> {
  input: TestCase['input'];
  output: TestCase['expected'] & { duration: number };
  expected: TestCase['expected'];
  metadata: TestMetadata<TestCase['metadata']['scoreThresholds']>;
  scores: TestCase['metadata']['scoreThresholds'];
  error?: Error;
}

// Output types
/**
 * This is what the generate call to the agent returns
 */
export type AgentOutput = Awaited<
  ReturnType<MastraModelOutput['getFullOutput']>
>;
export type AgentEvalOutput<TInput, TOutput> = {
  agentMetadata: AgentOutput;
  input: TInput;
  output: TOutput;
  duration: number;
};

export type WorkflowEvalOutput<TInput, TOutput> = {
  input: TInput;
  output: TOutput;
  duration: number;
};

// Utility types
export type ScorerFunction<
  TScores extends BaseScores,
  TExpected extends object,
> = (
  scores: TScores,
  scoreThresholds: TScores,
  results?: { output?: TExpected & { duration: number }; expected?: TExpected }
) => string[];
