import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encrypt, decrypt, isEncryptionConfigured } from './encryption';

// Valid 32-byte hex key (64 characters)
const TEST_ENCRYPTION_KEY =
  'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

// Mock the config module
vi.mock('@/config', () => ({
  config: {
    encryption: {
      key: '',
    },
  },
}));

describe('encryption', () => {
  let configMock: { config: { encryption: { key: string } } };

  beforeEach(async () => {
    // Get the mocked config and set the key
    configMock = await import('@/config');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isEncryptionConfigured', () => {
    it('returns false when encryption key is not configured', () => {
      configMock.config.encryption.key = '';
      expect(isEncryptionConfigured()).toBe(false);
    });

    it('returns false when encryption key has invalid length', () => {
      configMock.config.encryption.key = 'tooshort';
      expect(isEncryptionConfigured()).toBe(false);
    });

    it('returns true when encryption key is properly configured', () => {
      configMock.config.encryption.key = TEST_ENCRYPTION_KEY;
      expect(isEncryptionConfigured()).toBe(true);
    });
  });

  describe('encrypt and decrypt', () => {
    beforeEach(() => {
      configMock.config.encryption.key = TEST_ENCRYPTION_KEY;
    });

    it('encrypts and decrypts a string successfully', () => {
      const plaintext = 'my-secret-api-key-12345';

      const encrypted = encrypt(plaintext);
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+$/); // Base64 format

      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertext for same plaintext (due to random IV)', () => {
      const plaintext = 'same-secret';

      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);

      // Both should decrypt to the same value
      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
    });

    it('handles empty strings', () => {
      const plaintext = '';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('handles special characters and unicode', () => {
      const plaintext = '🔑 API-Key!@#$%^&*() with spaces and unicode: äöü';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('handles long strings', () => {
      const plaintext = 'a'.repeat(10000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('throws error when encryption key is not configured', () => {
      configMock.config.encryption.key = '';
      expect(() => encrypt('test')).toThrow(
        /ENCRYPTION_KEY environment variable/
      );
    });

    it('throws error when encryption key has wrong length', () => {
      configMock.config.encryption.key = 'invalidkey';
      expect(() => encrypt('test')).toThrow(/64-character hex string/);
    });

    it('throws error when decrypting tampered data', () => {
      configMock.config.encryption.key = TEST_ENCRYPTION_KEY;
      const encrypted = encrypt('original');

      // Tamper with the encrypted data
      const tamperedData = `${encrypted.slice(0, -4)}XXXX`;

      expect(() => decrypt(tamperedData)).toThrow();
    });

    it('throws error when decrypting with wrong key', () => {
      configMock.config.encryption.key = TEST_ENCRYPTION_KEY;
      const encrypted = encrypt('secret');

      // Change to a different key
      configMock.config.encryption.key =
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

      expect(() => decrypt(encrypted)).toThrow();
    });
  });
});
