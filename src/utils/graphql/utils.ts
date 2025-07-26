import { readFileSync } from 'fs';
import { getMastraResolvedPath } from '../file';
import { logger } from '../logger';

/**
 * Loads a GraphQL file from the given path
 * @param path - The path to the GraphQL file
 * @returns The contents of the GraphQL file
 */
export const loadGraphQLFile = (path: string) => {
  const resolvedPath = getMastraResolvedPath(path);
  let file = '';
  try {
    file = readFileSync(resolvedPath, 'utf8');
  } catch (error) {
    logger.error(`Failed to load GraphQL file from ${resolvedPath}`);
    throw error;
  }
  logger.info(`Loaded GraphQL file from ${resolvedPath}`);

  return file;
};
