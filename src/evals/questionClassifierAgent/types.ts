export type TestInput = string;

export type TestResult = {
  questionClass: string;
  nextAction: string;
};

export type Scores = {
  ExactMatch: number;
};

export type TestMetadata = {
  description: string;
  testName: string;
  scoreThresholds: Scores;
};

export type TestCase = {
  input: TestInput;
  expected: TestResult;
  metadata: TestMetadata;
};
