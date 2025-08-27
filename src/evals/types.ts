/**
 * These are the users declared in the local Evergreen database.
 */
export enum TestUser {
  Regular = 'regular',
  Privileged = 'privileged',
  Admin = 'admin',
}

export type TestInput = {
  content: string;
  user: TestUser;
};

export type Thresholds = {
  factuality: number;
  toolUsage: number;
};

export type TestMetadata = {
  description: string;
  testName: string;
  thresholds: Thresholds;
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

export interface CustomEvalResult {
  input: TestInput;
  output: TestResult & { duration: number };
  metadata: TestMetadata;
  scores: Record<string, number>;
  error?: Error;
}
