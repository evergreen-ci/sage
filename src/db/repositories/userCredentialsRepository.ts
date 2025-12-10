import { Collection } from 'mongodb';
import { config } from '@/config';
import { db } from '@/db/connection';
import { encrypt, decrypt } from '@/db/encryption';
import { UserCredentials, CreateUserCredentialsInput } from '@/db/types';
import logger from '@/utils/logger';

const COLLECTION_NAME = 'user_credentials';

/**
 * Gets the user_credentials collection
 * @returns The MongoDB collection for user credentials
 */
function getCollection(): Collection<UserCredentials> {
  return db
    .getClient()
    .db(config.db.dbName)
    .collection<UserCredentials>(COLLECTION_NAME);
}

/**
 * Ensures indexes are created for the user_credentials collection
 * Should be called once during application startup
 */
export async function ensureIndexes(): Promise<void> {
  const collection = getCollection();

  // Create unique index on email for fast lookups and uniqueness constraint
  await collection.createIndex(
    { email: 1 },
    { unique: true, name: 'email_unique_idx' }
  );

  logger.info(`Indexes created for ${COLLECTION_NAME} collection`);
}

/**
 * Finds user credentials by email
 * Note: The cursorApiKey in the returned object is encrypted
 * @param email - The user's email address
 * @returns The user credentials document, or null if not found
 */
export async function findUserCredentialsByEmail(
  email: string
): Promise<UserCredentials | null> {
  const collection = getCollection();
  return collection.findOne({ email: email.toLowerCase() });
}

/**
 * Gets the decrypted API key for a user
 * @param email - The user's email address
 * @returns The decrypted API key, or null if no credentials exist for the email
 */
export async function getDecryptedApiKey(
  email: string
): Promise<string | null> {
  const credentials = await findUserCredentialsByEmail(email);

  if (!credentials) {
    return null;
  }

  return decrypt(credentials.cursorApiKey);
}

/**
 * Creates or updates user credentials (upsert operation)
 * If credentials exist for the email, updates them; otherwise creates new
 * @param input - The input data for creating/updating credentials
 * @returns The created or updated user credentials document
 */
export async function upsertUserCredentials(
  input: CreateUserCredentialsInput
): Promise<UserCredentials> {
  const collection = getCollection();
  const normalizedEmail = input.email.toLowerCase();
  const now = new Date();

  const encryptedApiKey = encrypt(input.cursorApiKey);

  const result = await collection.findOneAndUpdate(
    { email: normalizedEmail },
    {
      $set: {
        cursorApiKey: encryptedApiKey,
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
}

/**
 * Deletes user credentials by email
 * @param email - The user's email address
 * @returns True if credentials were deleted, false if not found
 */
export async function deleteUserCredentials(email: string): Promise<boolean> {
  const collection = getCollection();

  const result = await collection.deleteOne({ email: email.toLowerCase() });

  if (result.deletedCount > 0) {
    logger.info(`Deleted credentials for user ${email}`);
    return true;
  }

  return false;
}

/**
 * Checks if credentials exist for a given email
 * @param email - The user's email address
 * @returns True if credentials exist, false otherwise
 */
export async function credentialsExist(email: string): Promise<boolean> {
  const collection = getCollection();
  const count = await collection.countDocuments({ email: email.toLowerCase() });
  return count > 0;
}
