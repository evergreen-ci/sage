import { gpt41, gpt41Nano } from '../../models/openAI/gpt41';

/**
 * Configuration for the Log Core Analyzer workflow, some of these parameters may be moved to
 * environment variables in the future
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
    maxFileSizeMB: parseInt(
      process.env.LOG_ANALYZER_MAX_FILE_SIZE_MB || '10',
      10
    ), // Max file size in MB
    maxTextLength: parseInt(
      process.env.LOG_ANALYZER_MAX_TEXT_LENGTH || '10000000',
      10
    ), // Max text length in characters (10M default)
    maxUrlSizeMB: parseInt(
      process.env.LOG_ANALYZER_MAX_URL_SIZE_MB || '10',
      10
    ), // Max size for URL fetches in MB
    maxTokens: parseInt(process.env.LOG_ANALYZER_MAX_TOKENS || '200000', 10), // Max estimated tokens to process
    urlTimeoutMs: parseInt(
      process.env.LOG_ANALYZER_URL_TIMEOUT_MS || '30000',
      10
    ), // URL fetch timeout (30s default)
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
