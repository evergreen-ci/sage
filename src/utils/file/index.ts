import { resolve } from 'path';
import { logger } from '../logger';

// TODO: This is a hack to get the correct path to the GraphQL file
// When running in the mastra directory, we need to go up 2 levels to get to the src directory
// This is required due to a mismatch in how mastra and the express server handle module resolution

/**
 * `isMastra` is a boolean that is true if the current working directory is a mastra project
 * This is used to determine if we are running in the mastra web app or the express server
 * @returns `true` if the current working directory is a mastra project, `false` otherwise
 */
export const isMastra = process.cwd().includes('.mastra');
logger.info(isMastra ? 'Started in mastra' : 'Started in express');

/**
 * @description Returns the path to the src directory based on the current working directory
 * @param path - The path to the file in the src directory
 * @returns The path to the src directory in the mastra project
 */
export const getMastraResolvedPath = (path: string) =>
  isMastra ? resolve('../../src/', path) : resolve('./src/', path);
