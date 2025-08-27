/**
 * These are the users declared in the local Evergreen database.
 */
export enum TestUser {
  Regular = 'regular',
  Privileged = 'privileged',
  Admin = 'admin',
}

export type TestMetadata = {
  user: TestUser;
  description: string;
  testName: string;
};

export type TestResult = {
  text: string;
  toolsUsed: string[];
};

export type TestCase = {
  input: string;
  expected: TestResult;
  metadata: TestMetadata;
};

export interface CustomEvalResult {
  input: string;
  output: TestResult & { duration: number };
  metadata: TestMetadata;
  scores: Record<string, number>;
  error?: Error;
}
