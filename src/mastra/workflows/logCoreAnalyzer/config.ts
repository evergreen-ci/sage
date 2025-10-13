import { gpt41, gpt41Nano } from '@/mastra/models/openAI/gpt41';

/**
 * Configuration for the Log Core Analyzer workflow. Some of these parameters may be moved to
 * environment variables in the future.
 */
export const logAnalyzerConfig = {
  /**
   * Chunking configuration
   */
  chunking: {
    maxSize: 300_000, // Maximum chunk size in tokens
    overlapTokens: 30_000, // Overlap to maintain context between chunks (~10% of maxSize is a good rule of thumb)
    tokenizer: 'o200k_base' as const, // Tokenizer for GPT-4
  },

  /**
   * Model assignments for different stages
   */
  models: {
    initial: gpt41, // Used for initial analysis (first chunk)
    refinement: gpt41Nano, // Used for iterative refinement (subsequent chunks, smaller model)
    formatter: gpt41, // Used for final report generation
    schemaFormatter: gpt41Nano, // Used for output schema formatting
  },

  /**
   * Input limits - centralized configuration
   */
  limits: {
    // Central size limit for all input sources (file, URL, text)
    maxSizeMB: 100,
    maxTextLength: 100 * 1024 * 1024, // Max text length in characters (100MB)

    // URL-specific settings
    urlTimeoutMs: 30_000, // 30 seconds

    // Processing limits
    maxChars: 100_000_000,
    maxTokens: 100_000_000,
  },

  /**
   * Logging configuration
   */
  logging: {
    name: 'LogCoreAnalyzerWorkflow',
    level: 'debug' as const,
  },
} as const;
