import { Attachment } from 'braintrust';
import { BaseTestCase, BaseScores } from '@/evals/types';

export type TestInput = {
  file: Attachment;
  analysisContext: string;
};

export type LineReference = {
  line: number;
  description: string;
  evidence: string;
};

export type TestResult = {
  markdown: string;
  summary: string;
  lineReferences: Array<LineReference>;
};

export type Scores = BaseScores & {
  Factuality: number;
  TechnicalAccuracy: number;
  CoreErrorLinesPresent: number;
};

export type TestCase = BaseTestCase<TestInput, TestResult, Scores>;
