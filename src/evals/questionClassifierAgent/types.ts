export type TestInput = string;

export type TestResult = {
  questionClass: string;
  nextAction: string;
};

export type Scores = {
  ExactMatch: number;
};

export type Thresholds = {
  exactMatch: number;
};

export type TestMetadata = {
  description: string;
  testName: string;
  scoreThresholds: Thresholds;
};

export type TestCase = {
  input: TestInput;
  expected: TestResult;
  metadata: TestMetadata;
};
