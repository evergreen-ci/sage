import { gpt41, gpt41Nano } from '@/mastra/models/openAI/gpt41';

export const prefilterAnalyzerConfig = {
  scanner: {
    contextLinesBefore: 3,
    contextLinesAfter: 3,
    maxTopTerms: 30,
  },

  chunking: {
    maxSize: 300_000,
    overlapTokens: 30_000,
    tokenizer: 'o200k_base' as const,
  },

  models: {
    initial: gpt41,
    refinement: gpt41Nano,
    formatter: gpt41,
    schemaFormatter: gpt41Nano,
  },

  logging: {
    name: 'LogPrefilterAnalyzerWorkflow',
    level: 'debug' as const,
  },
} as const;
