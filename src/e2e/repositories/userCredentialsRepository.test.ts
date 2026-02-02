import { db } from '@/db/connection';
import { getCollection } from '@/db/repositories/helpers';
import {
  credentialsExist,
  deleteUserCredentials,
  ensureIndexes,
  findUserCredentialsByEmail,
  getDecryptedApiKey,
  upsertUserCredentials,
} from '@/db/repositories/userCredentialsRepository';
import { UserCredentials } from '@/db/types';
import {
  cleanupTestUserCredentials,
  createTestUserCredentialsInput,
  dropCollectionIndexes,
  EMAIL_UNIQUE_INDEX_NAME,
  generateTestEmail,
  getCollectionIndexes,
  USER_CREDENTIALS_COLLECTION_NAME,
} from './helpers';

beforeAll(async () => {
  await db.connect();
});

afterAll(async () => {
  await cleanupTestUserCredentials();
  await db.disconnect();
});

afterEach(async () => {
  await cleanupTestUserCredentials();
});

describe('userCredentialsRepository', () => {
  describe('ensureIndexes', () => {
    it('should create unique email index and enforce uniqueness', async () => {
      await dropCollectionIndexes(USER_CREDENTIALS_COLLECTION_NAME);
      await ensureIndexes();

      const indexes = await getCollectionIndexes(
        USER_CREDENTIALS_COLLECTION_NAME
      );
      expect(indexes).toContain(EMAIL_UNIQUE_INDEX_NAME);

      // Test uniqueness constraint
      const email = generateTestEmail();
      const collection = getCollection<UserCredentials>(
        USER_CREDENTIALS_COLLECTION_NAME
      );
      await collection.insertOne({
        email,
        cursorApiKey: 'key1',
        keyLastFour: '1111',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        collection.insertOne({
          email,
          cursorApiKey: 'key2',
          keyLastFour: '2222',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      ).rejects.toThrow(/duplicate key error/);
    });
  });

  describe('upsertUserCredentials', () => {
    it('should create credentials with encryption and email normalization', async () => {
      const input = {
        email: 'E2E.REPOSITORY.TEST.UPPER@MongoDB.COM',
        cursorApiKey: 'my_secret_api_key_ABCD',
      };

      const result = await upsertUserCredentials(input);

      expect(result._id).toBeDefined();
      expect(result.email).toBe(input.email.toLowerCase());
      expect(result.cursorApiKey).not.toBe(input.cursorApiKey); // Encrypted
      expect(result.keyLastFour).toBe('ABCD');
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should update existing credentials preserving createdAt', async () => {
      const email = generateTestEmail();

      const first = await upsertUserCredentials({
        email,
        cursorApiKey: 'first_key_1111',
      });
      await new Promise(resolve => setTimeout(resolve, 10));
      const second = await upsertUserCredentials({
        email,
        cursorApiKey: 'second_key_2222',
      });

      expect(second._id!.toString()).toBe(first._id!.toString());
      expect(second.createdAt.getTime()).toBe(first.createdAt.getTime());
      expect(second.updatedAt.getTime()).toBeGreaterThan(
        first.updatedAt.getTime()
      );
      expect(second.keyLastFour).toBe('2222');
    });
  });

  describe('findUserCredentialsByEmail', () => {
    it('should find credentials case-insensitively', async () => {
      const email = generateTestEmail();
      await upsertUserCredentials({
        email: email.toLowerCase(),
        cursorApiKey: 'test_key_1234',
      });

      const found = await findUserCredentialsByEmail(email.toUpperCase());

      expect(found).not.toBeNull();
      expect(found!.email).toBe(email.toLowerCase());
    });

    it('should return null for non-existent email', async () => {
      const found = await findUserCredentialsByEmail('nonexistent@mongodb.com');
      expect(found).toBeNull();
    });
  });

  describe('getDecryptedApiKey', () => {
    it('should decrypt API key correctly', async () => {
      const originalKey = 'my_super_secret_api_key_12345678';
      const input = createTestUserCredentialsInput({
        cursorApiKey: originalKey,
      });
      await upsertUserCredentials(input);

      const decryptedKey = await getDecryptedApiKey(input.email);

      expect(decryptedKey).toBe(originalKey);
    });

    it('should return latest key after multiple upserts', async () => {
      const email = generateTestEmail();

      await upsertUserCredentials({ email, cursorApiKey: 'first_key_1111' });
      await upsertUserCredentials({ email, cursorApiKey: 'second_key_2222' });

      const decryptedKey = await getDecryptedApiKey(email);
      expect(decryptedKey).toBe('second_key_2222');
    });

    it('should return null for non-existent email', async () => {
      const decryptedKey = await getDecryptedApiKey('nonexistent@mongodb.com');
      expect(decryptedKey).toBeNull();
    });
  });

  describe('deleteUserCredentials', () => {
    it('should delete existing credentials', async () => {
      const input = createTestUserCredentialsInput();
      await upsertUserCredentials(input);

      const deleted = await deleteUserCredentials(input.email);

      expect(deleted).toBe(true);
      expect(await findUserCredentialsByEmail(input.email)).toBeNull();
    });

    it('should return false for non-existent email', async () => {
      const deleted = await deleteUserCredentials('nonexistent@mongodb.com');
      expect(deleted).toBe(false);
    });
  });

  describe('credentialsExist', () => {
    it('should correctly report existence', async () => {
      const input = createTestUserCredentialsInput();

      expect(await credentialsExist(input.email)).toBe(false);

      await upsertUserCredentials(input);
      expect(await credentialsExist(input.email)).toBe(true);

      await deleteUserCredentials(input.email);
      expect(await credentialsExist(input.email)).toBe(false);
    });
  });
});
