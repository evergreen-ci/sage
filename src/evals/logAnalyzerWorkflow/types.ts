import { Attachment } from 'braintrust';
import { BaseTestCase } from 'evals/types';

export type TestInput = {
  file: Attachment;
  analysisContext: string;
};

export type TestResult = {
  markdown: string;
  summary: string;
};

export type Scores = {
  Factuality: number;
};

export type TestCase = BaseTestCase<TestInput, TestResult, Scores>;
