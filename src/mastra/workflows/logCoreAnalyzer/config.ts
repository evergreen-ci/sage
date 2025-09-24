import { gpt41, gpt41Nano } from '../../models/openAI/gpt41';

/**
 * Configuration for the Log Core Analyzer workflow. Some of these parameters may be moved to
 * environment variables in the future.
 */
export const logAnalyzerConfig = {
  /**
   * Chunking configuration
   */
  chunking: {
    maxSize: 60000, // Maximum chunk size in tokens
    overlapTokens: 6000, // Overlap to maintain context between chunks (~10% of maxSize is a good rule of thumb)
    tokenizer: 'o200k_base' as const, // Tokenizer for GPT-4
  },

  /**
   * Model assignments for different stages
   */
  models: {
    initial: gpt41, // Used for initial analysis (first chunk)
    refinement: gpt41Nano, // Used for iterative refinement (subsequent chunks, smaller model)
    formatter: gpt41, // Used for final report generation
  },

  /**
   * Input limits
   */
  limits: {
    // Limits for loading
    maxFileSizeMB: 500, // Max file size in MB
    maxTextLength: 500_000_000, // Max text length in characters (500M)
    maxUrlSizeMB: 500, // Max size for URL fetches in MB
    urlTimeoutMs: 30000, // URL fetch timeout in milliseconds (30s)
    // Limit for processing
    maxChars: 10_000_000, // Max estimated characters to process (10M)
    maxTokens: 10_000_000, // Max estimated tokens to process (10M)
  },

  /**
   * Logging configuration
   */
  logging: {
    name: 'LogCoreAnalyzerWorkflow',
    level: 'debug' as const,
  },
} as const;

export type LogAnalyzerConfig = typeof logAnalyzerConfig;
