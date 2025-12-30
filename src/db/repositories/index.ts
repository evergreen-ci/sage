import { ensureVectorIndexes } from '@/mastra/utils/memory';
import logger from '@/utils/logger';
import { ensureIndexes as ensureJobRunIndexes } from './jobRunsRepository';
import { ensureIndexes as ensureUserCredentialsIndexes } from './userCredentialsRepository';

export * as jobRunsRepository from './jobRunsRepository';
export * as userCredentialsRepository from './userCredentialsRepository';

/**
 * Ensures all repository indexes are created.
 * Should be called once during application startup after database connection.
 */
export const ensureAllIndexes = async (): Promise<void> => {
  logger.info('Creating database indexes...');

  await Promise.all([
    ensureJobRunIndexes(),
    ensureUserCredentialsIndexes(),
    ensureVectorIndexes(),
  ]);

  logger.info('All database indexes created successfully');
};
