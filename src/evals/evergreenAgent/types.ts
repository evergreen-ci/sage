import { TestUser } from 'evals/constants';

export type TestInput = {
  content: string;
  user: TestUser;
};

export type Scores = {
  Factuality: number;
  ToolUsage: number;
};

export type TestMetadata = {
  description: string;
  testName: string;
  scoreThresholds: Scores;
};

export type TestResult = {
  text: string;
  toolsUsed: string[];
};

export type TestCase = {
  input: TestInput;
  expected: TestResult;
  metadata: TestMetadata;
};
