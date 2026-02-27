import { BaseTestCase, BaseScores } from '@/evals/types';

export type TestInput = {
  content: string;
};

export type Scores = BaseScores & {
  Factuality: number;
  ToolUsage: number;
};

export type TestResult = {
  text: string;
  toolsUsed: string[];
};

export type TestCase = BaseTestCase<TestInput, TestResult, Scores>;
