import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'yaml';
import logger from '@/utils/logger';
import { repositoriesConfigSchema, RepositoriesConfig } from './types';

let cachedConfig: RepositoriesConfig | null = null;

/**
 * Load and parse the repositories.yaml config file
 * Results are cached after first load
 * @returns The parsed repository configuration
 */
export const loadRepositoriesConfig = (): RepositoriesConfig => {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Use import.meta.url for ESM compatibility
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const configPath = path.join(currentDir, 'repositories.yaml');

  logger.debug('Loading repositories config', { configPath });

  if (!fs.existsSync(configPath)) {
    throw new Error(`Repository config file not found: ${configPath}`);
  }

  const fileContents = fs.readFileSync(configPath, 'utf8');
  const parsed = parse(fileContents);
  cachedConfig = repositoriesConfigSchema.parse(parsed);

  logger.info('Repositories config loaded successfully', {
    repositoryCount: Object.keys(cachedConfig.repositories).length,
  });

  return cachedConfig;
};

/**
 * Get the default branch for a repository from config
 * @param repository - Repository in org/repo format
 * @returns The default branch or null if not configured
 */
export const getDefaultBranch = (repository: string): string | null => {
  const config = loadRepositoriesConfig();
  const repoConfig = config.repositories[repository];
  return repoConfig?.defaultBranch ?? null;
};

/**
 * Check if a repository is configured
 * @param repository - Repository in org/repo format
 * @returns True if the repository has configuration
 */
export const isRepositoryConfigured = (repository: string): boolean => {
  const config = loadRepositoriesConfig();
  return repository in config.repositories;
};

/**
 * Clear the cached config (useful for testing)
 */
export const clearConfigCache = (): void => {
  cachedConfig = null;
};
