/**
 * Constants for the Log Core Analyzer workflow
 */

/**
 * Input source types
 */
export const SOURCE_TYPE = {
  FILE: 'file',
  URL: 'url',
  TEXT: 'text',
} as const;

export type SourceType = (typeof SOURCE_TYPE)[keyof typeof SOURCE_TYPE];

// Constants
export const MAX_FINAL_SUMMARY_TOKENS = 2048;
