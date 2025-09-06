import { AISDKV5OutputStream, OutputSchema } from '@mastra/core/dist/stream';

export type MastraAgentOutput = Awaited<
  ReturnType<AISDKV5OutputStream<OutputSchema>['getFullOutput']>
>;

export type ModelOutput<Input, Output> = Promise<
  MastraAgentOutput & { input: Input; output: Output }
>;

export interface ReporterEvalResult<Input, Output, Metadata, Scores> {
  input: Input;
  output: Output & { duration: number };
  metadata: Metadata & {
    description: string;
    testName: string;
    scoreThresholds: Scores;
  };
  scores: Scores;
  error?: Error;
}
