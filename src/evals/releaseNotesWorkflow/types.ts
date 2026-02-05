import { z } from 'zod';
import { BaseTestCase, BaseScores } from '@/evals/types';
import {
  releaseNotesInputSchema,
  ReleaseNotesOutput,
} from '@/mastra/agents/releaseNotesAgent';

export type TestInput = z.infer<typeof releaseNotesInputSchema>;

export type TestResult = ReleaseNotesOutput;

export type Scores = BaseScores & {
  Faithfulness: number;
  TechnicalAccuracy: number;
};

export type TestCase = BaseTestCase<TestInput, TestResult, Scores>;
