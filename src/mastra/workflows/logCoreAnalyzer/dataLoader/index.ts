import fs from 'fs/promises';
import path from 'path';
import { authenticatedEvergreenFetch } from '@/utils/fetch';
import { logger } from '@/utils/logger';
import { logAnalyzerConfig } from '../config';
import { SourceType, MB_TO_BYTES } from '../constants';
import { appendLineNumbers } from '../stream';
import { validateSize, validateTokenLimit } from '../utils';

export interface LoadResult {
  text: string;
  metadata: {
    source: SourceType;
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
  validateSize(stats.size, SourceType.File);

  // Read file
  const buffer = await fs.readFile(resolvedPath);
  const { text: textWithLineNumbers } = await appendLineNumbers(buffer);

  const estimatedTokens = validateTokenLimit(textWithLineNumbers);

  logger.debug('File loaded successfully', {
    path: filePath,
    sizeMB: (stats.size / MB_TO_BYTES).toFixed(2),
    estimatedTokens,
  });

  return {
    text: textWithLineNumbers,
    metadata: {
      source: SourceType.File,
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

    if (!response.body) {
      throw new Error('Response body is not defined');
    }

    const {
      text: textWithLineNumbers,
      totalSize,
      truncated,
    } = await appendLineNumbers(response.body, {
      maxSizeBytes: logAnalyzerConfig.limits.maxSizeMB * MB_TO_BYTES,
    });

    const estimatedTokens = validateTokenLimit(textWithLineNumbers);

    logger.debug('URL loaded successfully', {
      url,
      sizeMB: (totalSize / MB_TO_BYTES).toFixed(2),
      estimatedTokens,
      truncated,
    });

    return {
      text: textWithLineNumbers,
      metadata: {
        source: SourceType.URL,
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
export const loadFromText = async (
  text: string | null | undefined
): Promise<LoadResult> => {
  if (text === null || text === undefined) {
    throw new Error('Text cannot be null or undefined');
  }

  if (text.length === 0) {
    throw new Error('Text cannot be empty');
  }

  const size = text.length;
  validateSize(size, SourceType.Text);

  const { text: textWithLineNumbers } = await appendLineNumbers(text);
  const estimatedTokens = validateTokenLimit(textWithLineNumbers);

  logger.debug('Text validated successfully', {
    size,
    estimatedTokens,
  });

  return {
    text: textWithLineNumbers,
    metadata: {
      source: SourceType.Text,
      originalSize: size,
      estimatedTokens,
    },
  };
};
