import { encode } from 'gpt-tokenizer';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../../../config';
import { logger } from '../../../utils/logger';
import { logAnalyzerConfig } from './config';
import { SOURCE_TYPE, type SourceType } from './constants';

export interface LoadResult {
  text: string;
  metadata: {
    source: SourceType;
    originalSize: number;
    estimatedTokens: number;
  };
}

/**
 * Simple validation to check size limits
 * @param size - Size in bytes or characters to validate
 * @param source - Source type (file, url, or text)
 */
function validateSize(size: number, source: SourceType): void {
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
}

/**
 * Quick token estimation without full tokenization
 * Tokenization can be expensive, so we use a simple heuristic here.
 * @param text - Text to estimate tokens for
 * @returns Estimated number of tokens
 */
function estimateTokens(text: string): number {
  // Sample first 100k characters for accurate estimation
  const sampleSize = Math.min(text.length, 100_000);
  const sample = text.slice(0, sampleSize);
  const sampleTokens = encode(sample).length;

  if (text.length <= sampleSize) {
    return sampleTokens;
  }

  // Extrapolate for larger texts
  const tokensPerChar = sampleTokens / sample.length;
  return Math.ceil(text.length * tokensPerChar);
}

/**
 * Validate token count against configured limits
 * @param text - Text to validate token count for
 * @returns Estimated number of tokens
 * @throws Error if token count exceeds limit
 */
function validateTokenLimit(text: string): number {
  const estimatedTokens = estimateTokens(text);

  if (estimatedTokens > logAnalyzerConfig.limits.maxTokens) {
    throw new Error(
      `Content has ~${estimatedTokens.toLocaleString()} tokens, exceeds limit of ${logAnalyzerConfig.limits.maxTokens.toLocaleString()}`
    );
  }

  return estimatedTokens;
}

/**
 * Load from file with size validation
 * @param filePath - Path to the file to load
 * @returns Loaded text and metadata
 */
export async function loadFromFile(filePath: string): Promise<LoadResult> {
  const resolvedPath = path.resolve(filePath);

  // Check file size first
  const stats = await fs.stat(resolvedPath);
  validateSize(stats.size, SOURCE_TYPE.FILE);

  // Read file
  const buffer = await fs.readFile(resolvedPath);
  const text = buffer.toString('utf8');

  // Check token limit
  const estimatedTokens = validateTokenLimit(text);

  logger.debug('File loaded successfully', {
    path: filePath,
    sizeMB: (stats.size / 1024 / 1024).toFixed(2),
    estimatedTokens,
  });

  return {
    text,
    metadata: {
      source: SOURCE_TYPE.FILE,
      originalSize: stats.size,
      estimatedTokens,
    },
  };
}

/**
 * Load from URL with size validation
 * @param url - URL to load content from
 * @returns Loaded text and metadata
 */
export async function loadFromUrl(url: string): Promise<LoadResult> {
  // Build headers
  const headers = new Headers();
  headers.set('Accept', 'text/plain,application/json');

  if (config.evergreen.apiUser && config.evergreen.apiKey) {
    headers.set('Api-User', config.evergreen.apiUser);
    headers.set('Api-Key', config.evergreen.apiKey);
  } else {
    logger.debug('No Evergreen API credentials configured for URL fetch', {
      url,
    });
  }

  // Fetch with timeout
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    logAnalyzerConfig.limits.urlTimeoutMs
  );

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch URL: ${response.status} ${response.statusText}`
      );
    }

    // Check content length if available
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      validateSize(size, SOURCE_TYPE.URL);
    }

    const text = await response.text();

    // Validate actual size
    const actualSize = Buffer.byteLength(text, 'utf8');
    validateSize(actualSize, SOURCE_TYPE.URL);

    // Check token limit
    const estimatedTokens = validateTokenLimit(text);

    logger.debug('URL loaded successfully', {
      url,
      sizeMB: (actualSize / 1024 / 1024).toFixed(2),
      estimatedTokens,
    });

    return {
      text,
      metadata: {
        source: SOURCE_TYPE.URL,
        originalSize: actualSize,
        estimatedTokens,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        `URL fetch timed out after ${logAnalyzerConfig.limits.urlTimeoutMs}ms`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Validate raw text input
 * @param text - Raw text to validate and load
 * @returns Loaded text and metadata
 */
export async function loadFromText(text: string): Promise<LoadResult> {
  const size = text.length;
  validateSize(size, SOURCE_TYPE.TEXT);

  // Check token limit
  const estimatedTokens = validateTokenLimit(text);

  logger.debug('Text validated successfully', {
    size,
    estimatedTokens,
  });

  return {
    text,
    metadata: {
      source: SOURCE_TYPE.TEXT,
      originalSize: size,
      estimatedTokens,
    },
  };
}

/**
 * Normalize text by standardizing line endings
 * @param text - Text to normalize
 * @returns Normalized text
 */
export function normalizeText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n{4,}/g, '\n\n\n');
}
