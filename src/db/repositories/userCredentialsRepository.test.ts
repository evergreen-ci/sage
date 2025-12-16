import { ObjectId } from 'mongodb';
import { decrypt } from '@/db/encryption';
import * as userCredentialsRepository from './userCredentialsRepository';

// Mock the encryption module
vi.mock('@/db/encryption', () => ({
  encrypt: vi.fn((text: string) => `encrypted:${text}`),
  decrypt: vi.fn((text: string) => text.replace('encrypted:', '')),
}));

// Mock the db module
const mockCollection = {
  createIndex: vi.fn().mockResolvedValue('index_name'),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  deleteOne: vi.fn(),
  countDocuments: vi.fn(),
};

vi.mock('@/db/connection', () => ({
  db: {
    getClient: () => ({
      db: () => ({
        collection: () => mockCollection,
      }),
    }),
  },
}));

vi.mock('@/config', () => ({
  config: {
    db: {
      dbName: 'test_db',
    },
    encryption: {
      key: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    },
  },
}));

vi.mock('@/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('userCredentialsRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ensureIndexes', () => {
    it('creates a unique index on email', async () => {
      await userCredentialsRepository.ensureIndexes();

      expect(mockCollection.createIndex).toHaveBeenCalledWith(
        { email: 1 },
        { unique: true, name: 'email_unique_idx' }
      );
    });
  });

  describe('findUserCredentialsByEmail', () => {
    it('finds credentials by email (case-insensitive)', async () => {
      const credentials = {
        _id: new ObjectId(),
        email: 'user@example.com',
        cursorApiKey: 'encrypted:key',
      };
      mockCollection.findOne.mockResolvedValueOnce(credentials);

      const result =
        await userCredentialsRepository.findUserCredentialsByEmail(
          'USER@Example.COM'
        );

      expect(result).toEqual(credentials);
      expect(mockCollection.findOne).toHaveBeenCalledWith({
        email: 'user@example.com',
      });
    });

    it('returns null if not found', async () => {
      mockCollection.findOne.mockResolvedValueOnce(null);

      const result = await userCredentialsRepository.findUserCredentialsByEmail(
        'notfound@example.com'
      );

      expect(result).toBeNull();
    });
  });

  describe('getDecryptedApiKey', () => {
    it('returns decrypted API key for existing user', async () => {
      mockCollection.findOne.mockResolvedValueOnce({
        email: 'user@example.com',
        cursorApiKey: 'encrypted:my-secret-key',
      });

      const result =
        await userCredentialsRepository.getDecryptedApiKey('user@example.com');

      expect(result).toBe('my-secret-key');
      expect(decrypt).toHaveBeenCalledWith('encrypted:my-secret-key');
    });

    it('returns null if user not found', async () => {
      mockCollection.findOne.mockResolvedValueOnce(null);

      const result = await userCredentialsRepository.getDecryptedApiKey(
        'notfound@example.com'
      );

      expect(result).toBeNull();
      expect(decrypt).not.toHaveBeenCalled();
    });
  });

  describe('upsertUserCredentials', () => {
    it('creates new credentials if not exists', async () => {
      const credentials = {
        email: 'new@example.com',
        cursorApiKey: 'encrypted:key',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockCollection.findOneAndUpdate.mockResolvedValueOnce(credentials);

      const result = await userCredentialsRepository.upsertUserCredentials({
        email: 'new@example.com',
        cursorApiKey: 'key',
      });

      expect(result).toEqual(credentials);
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { email: 'new@example.com' },
        {
          $set: expect.objectContaining({
            cursorApiKey: 'encrypted:key',
            updatedAt: expect.any(Date),
          }),
          $setOnInsert: expect.objectContaining({
            email: 'new@example.com',
            createdAt: expect.any(Date),
          }),
        },
        { upsert: true, returnDocument: 'after' }
      );
    });
  });

  describe('deleteUserCredentials', () => {
    it('deletes credentials by email', async () => {
      mockCollection.deleteOne.mockResolvedValueOnce({ deletedCount: 1 });

      const result =
        await userCredentialsRepository.deleteUserCredentials(
          'user@example.com'
        );

      expect(result).toBe(true);
      expect(mockCollection.deleteOne).toHaveBeenCalledWith({
        email: 'user@example.com',
      });
    });

    it('returns false if credentials not found', async () => {
      mockCollection.deleteOne.mockResolvedValueOnce({ deletedCount: 0 });

      const result = await userCredentialsRepository.deleteUserCredentials(
        'notfound@example.com'
      );

      expect(result).toBe(false);
    });
  });

  describe('credentialsExist', () => {
    it('returns true if credentials exist', async () => {
      mockCollection.countDocuments.mockResolvedValueOnce(1);

      const result =
        await userCredentialsRepository.credentialsExist('user@example.com');

      expect(result).toBe(true);
      expect(mockCollection.countDocuments).toHaveBeenCalledWith({
        email: 'user@example.com',
      });
    });

    it('returns false if credentials do not exist', async () => {
      mockCollection.countDocuments.mockResolvedValueOnce(0);

      const result = await userCredentialsRepository.credentialsExist(
        'notfound@example.com'
      );

      expect(result).toBe(false);
    });
  });
});
