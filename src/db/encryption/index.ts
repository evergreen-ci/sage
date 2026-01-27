import crypto from 'crypto';
import { config } from '@/config';

/**
 * Encryption utilities for sensitive data stored in MongoDB.
 *
 * This module provides AES-256-GCM encryption for sensitive fields like API keys.
 * We use application-level encryption rather than MongoDB Queryable Encryption (QE)
 * because we don't need to query on encrypted fields—lookup is by user email.
 *
 * Environment variable required:
 * - ENCRYPTION_KEY: 32-byte hex string (64 characters) for AES-256 encryption
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // AES-GCM standard IV size
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

/**
 * Gets the encryption key from config/environment
 * @returns The encryption key as a Buffer
 * @throws {Error} If ENCRYPTION_KEY is not configured or invalid
 */
const getEncryptionKey = (): Buffer => {
  const keyHex = config.encryption?.key;

  if (!keyHex) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is required for encrypting sensitive data'
    );
  }

  if (keyHex.length !== KEY_LENGTH * 2) {
    throw new Error(
      `ENCRYPTION_KEY must be a ${KEY_LENGTH * 2}-character hex string (${KEY_LENGTH} bytes)`
    );
  }

  return Buffer.from(keyHex, 'hex');
};

/**
 * Encrypts a plaintext string using AES-256-GCM
 * @param plaintext The string to encrypt
 * @returns Base64-encoded string containing IV + encrypted data + auth tag
 */
export const encrypt = (plaintext: string): string => {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Combine IV + encrypted data + auth tag
  const combined = Buffer.concat([iv, encrypted, authTag]);

  return combined.toString('base64');
};

/**
 * Decrypts a string that was encrypted with the encrypt function
 * @param encryptedData Base64-encoded string containing IV + encrypted data + auth tag
 * @returns The decrypted plaintext string
 */
export const decrypt = (encryptedData: string): string => {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, 'base64');

  // Extract IV, encrypted data, and auth tag
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(
    IV_LENGTH,
    combined.length - AUTH_TAG_LENGTH
  );

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
};

/**
 * Checks if encryption is properly configured
 * @returns true if encryption is available, false otherwise
 */
export const isEncryptionConfigured = (): boolean => {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
};
