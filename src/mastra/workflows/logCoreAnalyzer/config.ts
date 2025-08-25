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
    maxSize: 20_000,        // Optimal size for GPT-4 models
    overlapTokens: 800,     // Overlap to maintain context between chunks
    tokenizer: 'o200k_base' as const,  // Tokenizer for GPT-4
  },

  /**
   * Model assignments for different stages
   */
  models: {
    initial: gpt41,         // Used for initial analysis (first chunk)
    refinement: gpt41Nano,  // Used for iterative refinement (subsequent chunks, smaller model)
    formatter: gpt41,       // Used for final report generation
  },

  /**
   * Output configuration
   */
  output: {
    reportsDir: 'reports',  // Directory where reports are saved
    filePrefix: 'report',   // Prefix for report filenames
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