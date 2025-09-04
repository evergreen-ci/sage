import { TestUser } from 'evals/constants';

export type TestInput = {
  content: string;
  user: TestUser;
};

export type Thresholds = {
  factuality: number;
  toolUsage: number;
};

export type Scores = {
  Factuality: number;
  'Tool Usage': number;
};

export type TestMetadata = {
  description: string;
  testName: string;
  scoreThresholds: Thresholds;
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
