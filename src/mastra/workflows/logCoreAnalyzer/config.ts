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
    maxSize: 60_000, // Maximum chunk size in tokens
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
    schemaFormatter: gpt41Nano, // Used for output schema formatting
  },

  /**
   * Input limits - centralized configuration
   */
  limits: {
    // Central size limit for all input sources (file, URL, text)
    maxSizeMB: 250, // Max size in MB for files and URLs
    maxTextLength: 250 * 1024 * 1024, // Max text length in characters (250MB)

    // URL-specific settings
    urlTimeoutMs: 30_000, // URL fetch timeout in milliseconds (30s)

    // Processing limits
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
