import { BaseTestCase, BaseScores } from '@/evals/types';

export type TestInput = string;

export type TestResult = {
  text: string;
};

export type Scores = BaseScores & {
  ExactMatch: number;
};

export type TestCase = BaseTestCase<TestInput, TestResult, Scores>;
