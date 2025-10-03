import fs from 'fs/promises';
import path from 'path';
import { authenticatedEvergreenFetch } from '../../../utils/fetch';
import { logger } from '../../../utils/logger';
import { logAnalyzerConfig } from './config';
import { SOURCE_TYPE, MB_TO_BYTES } from './constants';
import { validateSize, validateTokenLimit } from './utils';

export interface LoadResult {
  text: string;
  metadata: {
    source: SOURCE_TYPE;
    originalSize: number;
    estimatedTokens: number;
    truncated?: boolean;
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
  validateSize(stats.size, SOURCE_TYPE.File);

  // Read file
  const buffer = await fs.readFile(resolvedPath);
  const text = buffer.toString('utf8');

  // Check token limit
  const estimatedTokens = validateTokenLimit(text);

  logger.debug('File loaded successfully', {
    path: filePath,
    sizeMB: (stats.size / MB_TO_BYTES).toFixed(2),
    estimatedTokens,
  });

  return {
    text,
    metadata: {
      source: SOURCE_TYPE.File,
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

    // Stream download with size limit enforcement
    const maxSizeBytes = logAnalyzerConfig.limits.maxSizeMB * MB_TO_BYTES;
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    let truncated = false;

    while (true) {
      // eslint-disable-next-line no-await-in-loop
      const { done, value } = await reader.read();
      if (done) break;

      totalSize += value.length;

      // Stop downloading if size limit exceeded
      if (totalSize > maxSizeBytes) {
        truncated = true;
        reader.cancel();
        logger.warn('URL content truncated due to size limit', {
          url,
          limitMB: logAnalyzerConfig.limits.maxSizeMB,
          downloadedMB: (totalSize / MB_TO_BYTES).toFixed(2),
        });
        break;
      }

      chunks.push(value);
    }

    // Combine chunks into text
    const buffer = Buffer.concat(chunks);
    const text = buffer.toString('utf8');

    // Check token limit
    const estimatedTokens = validateTokenLimit(text);

    logger.debug('URL loaded successfully', {
      url,
      sizeMB: (totalSize / MB_TO_BYTES).toFixed(2),
      estimatedTokens,
      truncated,
    });

    return {
      text,
      metadata: {
        source: SOURCE_TYPE.URL,
        originalSize: totalSize,
        estimatedTokens,
        truncated,
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
  validateSize(size, SOURCE_TYPE.Text);

  // Check token limit
  const estimatedTokens = validateTokenLimit(text);

  logger.debug('Text validated successfully', {
    size,
    estimatedTokens,
  });

  return {
    text,
    metadata: {
      source: SOURCE_TYPE.Text,
      originalSize: size,
      estimatedTokens,
    },
  };
};
