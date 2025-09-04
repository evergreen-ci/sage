import { encode } from 'gpt-tokenizer';
import { logAnalyzerConfig } from './config';
import { SOURCE_TYPE, type SourceType } from './constants';

/**
 * Normalize text by standardizing line endings
 * @param text - Text to normalize
 * @returns Normalized text
 */
export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n{4,}/g, '\n\n\n');
}

/**
 * Simple validation to check size limits
 * @param size - Size in bytes or characters to validate
 * @param source - Source type (file, url, or text)
 */
export const validateSize = (size: number, source: SourceType): void => {
  const { limits } = logAnalyzerConfig;

  let maxSize: number;
  let label: string;
  switch (source) {
    case SOURCE_TYPE.FILE:
      maxSize = limits.maxFileSizeMB * 1024 * 1024;
      label = `${limits.maxFileSizeMB}MB`;
      break;
    case SOURCE_TYPE.URL:
      maxSize = limits.maxUrlSizeMB * 1024 * 1024;
      label = `${limits.maxUrlSizeMB}MB`;
      break;
    case SOURCE_TYPE.TEXT:
      maxSize = limits.maxTextLength;
      label = `${limits.maxTextLength} characters`;
      break;
    default:
      throw new Error(`Unknown source type: ${source}`);
  }

  if (size > maxSize) {
    const sizeLabel =
      source === SOURCE_TYPE.TEXT
        ? `${size} characters`
        : `${(size / 1024 / 1024).toFixed(2)}MB`;
    throw new Error(
      `Input too large: ${sizeLabel} exceeds limit of ${label} for ${source}`
    );
  }
};

/**
 * Quick token estimation without full tokenization
 * Tokenization can be expensive, so we use a simple heuristic here.
 * @param text - Text to estimate tokens for
 * @returns Estimated number of tokens
 */
export const estimateTokens = (text: string): number => {
  // Sample first 100k characters for accurate estimation
  const sampleSize = Math.min(text.length, 100_000);
  const sample = text.slice(0, sampleSize);
  const sampleTokens = countTokens(sample);

  if (text.length <= sampleSize) {
    return sampleTokens;
  }

  // Extrapolate for larger texts
  const tokensPerChar = sampleTokens / sample.length;
  return Math.ceil(text.length * tokensPerChar);
};

// Count tokens in text
/**
 *
 * @param text
 */
export function countTokens(text: string): number {
  return encode(text).length;
}

/**
 * Validate token count against configured limits
 * @param text - Text to validate token count for
 * @returns Estimated number of tokens
 * @throws Error if token count exceeds limit
 */
export function validateTokenLimit(text: string): number {
  const estimatedTokens = estimateTokens(text);

  if (estimatedTokens > logAnalyzerConfig.limits.maxTokens) {
    throw new Error(
      `Content has ~${estimatedTokens.toLocaleString()} tokens, exceeds limit of ${logAnalyzerConfig.limits.maxTokens.toLocaleString()}`
    );
  }

  return estimatedTokens;
}

/**
 * Crop text to a maximum length, keeping portions from head and tail
 * @param text - Text to crop
 * @param maxLength - Maximum length in characters
 * @param headRatio - Ratio of head to keep (0.0 to 1.0, default 0.5)
 * @param separator - Separator to insert between head and tail (default '...\n[content truncated]\n...')
 * @returns Cropped text with head and tail portions
 */
export function cropMiddle(
  text: string,
  maxLength: number,
  headRatio: number = 0.5,
  separator: string = '...\n[content truncated]\n...'
): string {
  // If text fits, return as-is
  if (text.length <= maxLength) {
    return text;
  }

  // Validate headRatio
  if (headRatio < 0 || headRatio > 1) {
    throw new Error('headRatio must be between 0 and 1');
  }

  // Reserve space for separator
  const availableLength = maxLength - separator.length;
  if (availableLength <= 0) {
    throw new Error('maxLength too small to accommodate separator');
  }

  // Extract head and tail
  const headLength = Math.floor(availableLength * headRatio);
  const tailLength = availableLength - headLength;
  const head = text.substring(0, headLength);
  const tail = tailLength > 0 ? text.substring(text.length - tailLength) : '';

  return head + separator + tail;
}
