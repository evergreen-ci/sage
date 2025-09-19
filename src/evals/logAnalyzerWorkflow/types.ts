import { Attachment } from 'braintrust';
import { BaseTestCase, BaseScores } from 'evals/types';

export type TestInput = {
  file: Attachment;
  analysisContext: string;
};

export type TestResult = {
  markdown: string;
  summary: string;
};

export type Scores = BaseScores & {
  Factuality: number;
  TechnicalAccuracy: number;
};

export type TestCase = BaseTestCase<TestInput, TestResult, Scores>;
