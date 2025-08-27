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
