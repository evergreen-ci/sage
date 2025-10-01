import { encode } from 'gpt-tokenizer';
import { logAnalyzerConfig } from './config';
import { SOURCE_TYPE } from './constants';

// Constants for size and token estimation
const SMALL_TEXT_THRESHOLD = 8_192; // chars
const SAMPLING_WINDOW_SIZE = 4_096; // chars per window

/**
 * Normalize text by standardizing line endings
 * @param text - Text to normalize
 * @returns Normalized text
 */
export const normalizeLineEndings = (text: string): string =>
  text.replace(/\r\n/g, '\n').replace(/\n{4,}/g, '\n\n\n');

/**
 * Simple validation to check size limits
 * @param size - Size in bytes or characters to validate
 * @param source - Source type (file, url, or text)
 */
/**
 * Create a size limit error message
 * @param size Actual size of the input
 * @param maxSize Maximum allowed size
 * @param source Source type (file, url, text)
 * @returns Formatted error message
 */
const createSizeLimitError = (
  size: number,
  maxSize: number,
  source: SOURCE_TYPE
): Error => {
  const sizeLabel =
    source === SOURCE_TYPE.TEXT
      ? `${size} characters`
      : `${(size / 1024 / 1024).toFixed(2)}MB`;
  const maxSizeLabel =
    source === SOURCE_TYPE.TEXT
      ? `${maxSize} characters`
      : `${(maxSize / 1024 / 1024).toFixed(2)}MB`;

  return new Error(
    `Content size constraint exceeded: Received ${sizeLabel}, which surpasses the configured limit of ${maxSizeLabel} for ${source} input`
  );
};

export const validateSize = (size: number, source: SOURCE_TYPE): void => {
  const { limits } = logAnalyzerConfig;

  let maxSize: number;
  switch (source) {
    case SOURCE_TYPE.FILE:
      maxSize = limits.maxFileSizeMB * 1024 * 1024;
      break;
    case SOURCE_TYPE.URL:
      maxSize = limits.maxUrlSizeMB * 1024 * 1024;
      break;
    case SOURCE_TYPE.TEXT:
      maxSize = limits.maxTextLength;
      break;
    default:
      throw new Error(
        `Unrecognized input source type: ${source}. Please provide a valid source type.`
      );
  }

  if (size > maxSize) {
    throw createSizeLimitError(size, maxSize, source);
  }
};

/**
 * Fast token estimate using stratified sampling (head/middle/tail).
 * Keeps work roughly constant regardless of input size.
 * @param text - Text to estimate tokens for
 * @returns Estimated number of tokens
 */
export const estimateTokens = (text: string): number => {
  const len = text.length;
  if (len === 0) return 0;

  // For small texts just do the real count. It's cheap and exact.
  if (len <= SMALL_TEXT_THRESHOLD) return countTokens(text);

  // Sample three windows to reduce bias (head/mid/tail).
  const half = Math.floor(SAMPLING_WINDOW_SIZE / 2);

  const startStart = 0;
  const midCenter = Math.floor(len / 2);
  const endEnd = len;

  const head = text.slice(startStart, Math.min(SAMPLING_WINDOW_SIZE, len));
  const mid = text.slice(
    Math.max(0, midCenter - half),
    Math.min(len, midCenter + half)
  );
  const tail = text.slice(Math.max(0, endEnd - SAMPLING_WINDOW_SIZE), endEnd);

  // Tokenize each window (small, fixed cost).
  const headTokens = countTokens(head);
  const midTokens = countTokens(mid);
  const tailTokens = countTokens(tail);

  const sampledChars = head.length + mid.length + tail.length;
  const sampledTokens = headTokens + midTokens + tailTokens;

  // Guard against division by zero (shouldn't happen, but be safe).
  if (sampledChars === 0) return 0;

  const tokensPerChar = sampledTokens / sampledChars;
  return Math.ceil(len * tokensPerChar);
};

/**
 * Exact token count for a given text (uses your tokenizer).
 * @param text - Text to count tokens for
 * @returns Number of tokens
 */
export const countTokens = (text: string): number => encode(text).length;

/**
 * Validate token count against configured limits
 * @param text - Text to validate token count for
 * @returns Estimated number of tokens
 * @throws Error if token count exceeds limit
 */
/**
 * Create a token limit error message
 * @param estimatedTokens Actual number of tokens
 * @param maxTokens Maximum allowed tokens
 * @returns Formatted error message
 */
const createTokenLimitError = (
  estimatedTokens: number,
  maxTokens: number
): Error =>
  new Error(
    `Token limit constraint violated: Estimated ~${estimatedTokens.toLocaleString()} tokens, which exceeds the configured maximum of ${maxTokens.toLocaleString()} tokens`
  );

export const validateTokenLimit = (text: string): number => {
  const estimatedTokens = estimateTokens(text);
  const { maxTokens } = logAnalyzerConfig.limits;

  if (estimatedTokens > maxTokens) {
    throw createTokenLimitError(estimatedTokens, maxTokens);
  }

  return estimatedTokens;
};

/**
 * Crop text to a maximum length, keeping portions from head and tail
 * @param text - Text to crop
 * @param maxLength - Maximum length in characters
 * @param headRatio - Ratio of head to keep (0.0 to 1.0, default 0.5)
 * @param separator - Separator to insert between head and tail (default '...\n[content truncated]\n...')
 * @returns Cropped text with head and tail portions
 */
export const cropMiddle = (
  text: string,
  maxLength: number,
  headRatio: number = 0.5,
  separator: string = '...\n[content truncated]\n...'
): string => {
  // If text fits, return as-is
  if (text.length <= maxLength) {
    return text;
  }

  // Validate headRatio
  if (headRatio < 0 || headRatio > 1) {
    throw new Error(
      'Invalid head ratio: Must be a decimal value between 0 and 1 (inclusive)'
    );
  }

  // Reserve space for separator
  const availableLength = maxLength - separator.length;
  if (availableLength <= 0) {
    throw new Error(
      'Insufficient maximum length: Unable to apply truncation with the specified separator'
    );
  }

  // Extract head and tail
  const headLength = Math.floor(availableLength * headRatio);
  const tailLength = availableLength - headLength;
  const head = text.substring(0, headLength);
  const tail = tailLength > 0 ? text.substring(text.length - tailLength) : '';

  return head + separator + tail;
};
