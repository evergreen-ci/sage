import { Workflow } from '@mastra/core';
import { AISDKV5OutputStream, OutputSchema } from '@mastra/core/dist/stream';

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
type MastraAgentOutput = Awaited<
  ReturnType<AISDKV5OutputStream<OutputSchema>['getFullOutput']>
>;

export type ModelOutput<TInput, TOutput> = Promise<
  MastraAgentOutput & { input: TInput; output: TOutput }
>;

export type WorkflowOutput<Input, Output> = {
  input: Input;
  output: Output;
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
