import { decrypt, encrypt } from '@/db/encryption';
import {
  EMAIL_UNIQUE_INDEX_NAME,
  USER_CREDENTIALS_COLLECTION_NAME,
} from '@/db/repositories/constants';
import { getCollection } from '@/db/repositories/helpers';
import { CreateUserCredentialsInput, UserCredentials } from '@/db/types';
import logger from '@/utils/logger';

/**
 * Ensures indexes are created for the user_credentials collection
 * Should be called once during application startup
 */
export const ensureIndexes = async (): Promise<void> => {
  const collection = getCollection<UserCredentials>(
    USER_CREDENTIALS_COLLECTION_NAME
  );

  // Create unique index on email for fast lookups and uniqueness constraint
  await collection.createIndex(
    { email: 1 },
    { unique: true, name: EMAIL_UNIQUE_INDEX_NAME }
  );

  logger.info(
    `Indexes created for ${USER_CREDENTIALS_COLLECTION_NAME} collection`
  );
};

/**
 * Finds user credentials by email
 * Note: The cursorApiKey in the returned object is encrypted
 * @param email - The user's email address
 * @returns The user credentials document, or null if not found
 */
export const findUserCredentialsByEmail = async (
  email: string
): Promise<UserCredentials | null> => {
  const collection = getCollection<UserCredentials>(
    USER_CREDENTIALS_COLLECTION_NAME
  );
  return collection.findOne({ email: email.toLowerCase() });
};

/**
 * Gets the decrypted API key for a user
 * @param email - The user's email address
 * @returns The decrypted API key, or null if no credentials exist for the email
 */
export const getDecryptedApiKey = async (
  email: string
): Promise<string | null> => {
  const credentials = await findUserCredentialsByEmail(email);

  if (!credentials) {
    return null;
  }

  return decrypt(credentials.cursorApiKey);
};

/**
 * Creates or updates user credentials (upsert operation)
 * If credentials exist for the email, updates them; otherwise creates new
 * @param input - The input data for creating/updating credentials
 * @returns The created or updated user credentials document
 */
export const upsertUserCredentials = async (
  input: CreateUserCredentialsInput
): Promise<UserCredentials> => {
  const collection = getCollection<UserCredentials>(
    USER_CREDENTIALS_COLLECTION_NAME
  );
  const normalizedEmail = input.email.toLowerCase();
  const now = new Date();

  const encryptedApiKey = encrypt(input.cursorApiKey);
  // Store last 4 characters of the key for display purposes
  const keyLastFour = input.cursorApiKey.slice(-4);

  const result = await collection.findOneAndUpdate(
    { email: normalizedEmail },
    {
      $set: {
        cursorApiKey: encryptedApiKey,
        keyLastFour,
        updatedAt: now,
      },
      $setOnInsert: {
        email: normalizedEmail,
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  if (result) {
    logger.info(`Upserted credentials for user ${input.email}`);
    return result;
  }

  // This shouldn't happen with upsert: true, but TypeScript requires handling
  throw new Error('Failed to upsert user credentials');
};

/**
 * Deletes user credentials by email
 * @param email - The user's email address
 * @returns True if credentials were deleted, false if not found
 */
export const deleteUserCredentials = async (
  email: string
): Promise<boolean> => {
  const collection = getCollection<UserCredentials>(
    USER_CREDENTIALS_COLLECTION_NAME
  );

  const result = await collection.deleteOne({ email: email.toLowerCase() });

  if (result.deletedCount > 0) {
    logger.info(`Deleted credentials for user ${email}`);
    return true;
  }

  return false;
};

/**
 * Checks if credentials exist for a given email
 * @param email - The user's email address
 * @returns True if credentials exist, false otherwise
 */
export const credentialsExist = async (email: string): Promise<boolean> => {
  const collection = getCollection<UserCredentials>(
    USER_CREDENTIALS_COLLECTION_NAME
  );
  const count = await collection.countDocuments({ email: email.toLowerCase() });
  return count > 0;
};
