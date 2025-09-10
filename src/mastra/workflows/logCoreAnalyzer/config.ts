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
    maxSize: 20_000, // Maximum chunk size in tokens
    overlapTokens: 800, // Overlap to maintain context between chunks
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
    // Max file size in MB, defaults to 50.
    maxFileSizeMB: parseInt(
      process.env.LOG_ANALYZER_MAX_FILE_SIZE_MB || '50',
      10
    ),
    // Max text length in characters, defaults to 10000000.
    maxTextLength: parseInt(
      process.env.LOG_ANALYZER_MAX_TEXT_LENGTH || '10000000',
      10
    ),
    // Max size for URL fetches in MB, defaults to 50.
    maxUrlSizeMB: parseInt(
      process.env.LOG_ANALYZER_MAX_URL_SIZE_MB || '50',
      10
    ),
    // Max estimated tokens to process, defaults to 2000000.
    maxTokens: parseInt(process.env.LOG_ANALYZER_MAX_TOKENS || '2000000', 10),
    // URL fetch timeout, defaults to 30 seconds.
    urlTimeoutMs: parseInt(
      process.env.LOG_ANALYZER_URL_TIMEOUT_MS || '30000',
      10
    ),
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
