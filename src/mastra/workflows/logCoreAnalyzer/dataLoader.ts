import fs from 'fs/promises';
import path from 'path';
import { authenticatedEvergreenFetch } from '../../../utils/fetch';
import { logger } from '../../../utils/logger';
import { logAnalyzerConfig } from './config';
import { SOURCE_TYPE } from './constants';
import { validateSize, validateTokenLimit } from './utils';

export interface LoadResult {
  text: string;
  metadata: {
    source: SOURCE_TYPE;
    originalSize: number;
    estimatedTokens: number;
  };
}

/**
 * Load from file with size validation
 * @param filePath - Path to the file to load
 * @returns Loaded text and metadata
 */
export const loadFromFile = async (filePath: string): Promise<LoadResult> => {
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
};

/**
 * Load from URL with size validation
 * @param url - URL to load content from
 * @returns Loaded text and metadata
 */
export const loadFromUrl = async (url: string): Promise<LoadResult> => {
  // Fetch with timeout
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    logAnalyzerConfig.limits.urlTimeoutMs
  );

  try {
    const response = await authenticatedEvergreenFetch(url, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `URL fetch operation failed: ${response.status} ${response.statusText}`
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
};

/**
 * Validate raw text input
 * @param text - Raw text to validate and load
 * @returns Loaded text and metadata
 */
export const loadFromText = (text: string | null | undefined): LoadResult => {
  if (text === null || text === undefined) {
    throw new Error('Text cannot be null or undefined');
  }

  if (text.length === 0) {
    throw new Error('Text cannot be empty');
  }

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
};
