import { getCollection } from '@/db/repositories/helpers';
import { CreateJobRunInput, JobRun, UserCredentials } from '@/db/types';

const JOB_RUNS_COLLECTION = 'job_runs';
const USER_CREDENTIALS_COLLECTION = 'user_credentials';

/**
 * Test data prefixes for identification and cleanup
 */
export const TEST_PREFIX = {
  ticketKey: 'E2ETEST-',
  email: 'e2e.repository.test.',
};

/**
 * Generates a unique test ticket key
 * @param suffix - Optional suffix to append
 * @returns A unique ticket key string
 */
export const generateTestTicketKey = (suffix?: string): string => {
  const random = Math.random().toString(36).substring(7);
  return `${TEST_PREFIX.ticketKey}${suffix || random}`;
};

/**
 * Generates a unique test email
 * @param suffix - Optional suffix to append
 * @returns A unique email string
 */
export const generateTestEmail = (suffix?: string): string => {
  const random = Math.random().toString(36).substring(7);
  return `${TEST_PREFIX.email}${suffix || random}@mongodb.com`;
};

/**
 * Cleans up all test job runs created during E2E tests
 */
export const cleanupTestJobRuns = async (): Promise<void> => {
  const collection = getCollection<JobRun>(JOB_RUNS_COLLECTION);
  await collection.deleteMany({
    jiraTicketKey: { $regex: `^${TEST_PREFIX.ticketKey}` },
  });
};

/**
 * Cleans up all test user credentials created during E2E tests
 */
export const cleanupTestUserCredentials = async (): Promise<void> => {
  const collection = getCollection<UserCredentials>(
    USER_CREDENTIALS_COLLECTION
  );
  await collection.deleteMany({
    email: { $regex: `^${TEST_PREFIX.email}` },
  });
};

/**
 * Cleans up all test data from both collections
 */
export const cleanupAllTestData = async (): Promise<void> => {
  await Promise.all([cleanupTestJobRuns(), cleanupTestUserCredentials()]);
};

/**
 * Drops all indexes on a collection (except _id)
 * Useful for testing ensureIndexes() from a clean state
 * @param collectionName - The name of the collection
 */
export const dropCollectionIndexes = async (
  collectionName: string
): Promise<void> => {
  const collection = getCollection(collectionName);
  try {
    await collection.dropIndexes();
  } catch {
    // Collection may not exist yet, ignore error
  }
};

/**
 * Gets all non-default indexes on a collection
 * @param collectionName - The name of the collection
 * @returns Array of index names
 */
export const getCollectionIndexes = async (
  collectionName: string
): Promise<string[]> => {
  const collection = getCollection(collectionName);
  const indexes = await collection.indexes();
  return indexes
    .map(idx => idx.name)
    .filter((name): name is string => name !== undefined && name !== '_id_');
};

/**
 * Creates a factory for test job run data
 * @param overrides - Optional overrides for the default values
 * @returns A CreateJobRunInput object
 */
export const createTestJobRunInput = (
  overrides?: Partial<CreateJobRunInput>
): CreateJobRunInput => ({
  jiraTicketKey: generateTestTicketKey(),
  initiatedBy: 'test.initiator@mongodb.com',
  assignee: 'test.assignee@mongodb.com',
  ...overrides,
});

/**
 * Creates a factory for test user credentials input
 * @param overrides - Optional overrides for email and cursorApiKey
 * @returns An object with email and cursorApiKey
 */
export const createTestUserCredentialsInput = (
  overrides?: Partial<{
    email: string;
    cursorApiKey: string;
  }>
): { email: string; cursorApiKey: string } => ({
  email: generateTestEmail(),
  cursorApiKey: 'test_cursor_api_key_12345678',
  ...overrides,
});
