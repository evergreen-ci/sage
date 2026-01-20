import request from 'supertest';
import { db } from '@/db/connection';
import { getCollection } from '@/db/repositories/helpers';
import { UserCredentials } from '@/db/types';
import setupTestAppServer from '@/e2e/setup';

const app = setupTestAppServer();

const testUserId = 'e2e.test.user@mongodb.com';

// Create a valid JWT-like header with the test user as subject
const createAuthHeader = (userId: string): string => {
  const payload = { sub: userId };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    'base64'
  );
  return `header.${encodedPayload}.signature`;
};

const authHeader = createAuthHeader(testUserId);

const cleanupTestData = async () => {
  try {
    const collection = getCollection<UserCredentials>('user_credentials');
    await collection.deleteOne({ email: testUserId.toLowerCase() });
  } catch {
    // Ignore cleanup errors - database may already be disconnected
  }
};

beforeAll(async () => {
  await db.connect();
});

afterAll(async () => {
  await cleanupTestData();
  await db.disconnect();
});

describe('POST /pr-bot/user/cursor-key', () => {
  afterEach(async () => {
    await cleanupTestData();
  });

  it('should store a new API key successfully', async () => {
    const apiKey = 'cursor_api_key_1234567890';

    const response = await request(app)
      .post('/pr-bot/user/cursor-key')
      .set('x-kanopy-internal-authorization', authHeader)
      .send({ apiKey });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.keyLastFour).toBe('7890');

    // Verify the key was stored in the database
    const collection = getCollection<UserCredentials>('user_credentials');
    const storedCredentials = await collection.findOne({
      email: testUserId.toLowerCase(),
    });
    expect(storedCredentials).not.toBeNull();
    expect(storedCredentials?.keyLastFour).toBe('7890');
  });

  it('should update an existing API key', async () => {
    // First create a key
    await request(app)
      .post('/pr-bot/user/cursor-key')
      .set('x-kanopy-internal-authorization', authHeader)
      .send({ apiKey: 'first_key_1111' });

    // Then update it
    const response = await request(app)
      .post('/pr-bot/user/cursor-key')
      .set('x-kanopy-internal-authorization', authHeader)
      .send({ apiKey: 'second_key_2222' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.keyLastFour).toBe('2222');

    // Verify only one record exists
    const collection = getCollection<UserCredentials>('user_credentials');
    const count = await collection.countDocuments({
      email: testUserId.toLowerCase(),
    });
    expect(count).toBe(1);
  });

  it('should return 400 for missing API key', async () => {
    const response = await request(app)
      .post('/pr-bot/user/cursor-key')
      .set('x-kanopy-internal-authorization', authHeader)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid request body');
  });

  it('should return 400 for empty API key', async () => {
    const response = await request(app)
      .post('/pr-bot/user/cursor-key')
      .set('x-kanopy-internal-authorization', authHeader)
      .send({ apiKey: '' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid request body');
  });
});

describe('GET /pr-bot/user/cursor-key', () => {
  afterEach(async () => {
    await cleanupTestData();
  });

  it('should return hasKey: false when no key exists', async () => {
    const response = await request(app)
      .get('/pr-bot/user/cursor-key')
      .set('x-kanopy-internal-authorization', authHeader);

    expect(response.status).toBe(200);
    expect(response.body.hasKey).toBe(false);
    expect(response.body.keyLastFour).toBeUndefined();
  });

  it('should return key info when a key exists', async () => {
    // First create a key
    await request(app)
      .post('/pr-bot/user/cursor-key')
      .set('x-kanopy-internal-authorization', authHeader)
      .send({ apiKey: 'cursor_api_key_abcd' });

    const response = await request(app)
      .get('/pr-bot/user/cursor-key')
      .set('x-kanopy-internal-authorization', authHeader);

    expect(response.status).toBe(200);
    expect(response.body.hasKey).toBe(true);
    expect(response.body.keyLastFour).toBe('abcd');
    expect(response.body.createdAt).toBeDefined();
    expect(response.body.updatedAt).toBeDefined();
  });

  it('should return updated info after key update', async () => {
    // Create initial key
    await request(app)
      .post('/pr-bot/user/cursor-key')
      .set('x-kanopy-internal-authorization', authHeader)
      .send({ apiKey: 'first_key_1111' });

    // Update the key
    await request(app)
      .post('/pr-bot/user/cursor-key')
      .set('x-kanopy-internal-authorization', authHeader)
      .send({ apiKey: 'second_key_2222' });

    const response = await request(app)
      .get('/pr-bot/user/cursor-key')
      .set('x-kanopy-internal-authorization', authHeader);

    expect(response.status).toBe(200);
    expect(response.body.hasKey).toBe(true);
    expect(response.body.keyLastFour).toBe('2222');
  });
});

describe('DELETE /pr-bot/user/cursor-key', () => {
  beforeEach(async () => {
    // Create a key to delete
    await request(app)
      .post('/pr-bot/user/cursor-key')
      .set('x-kanopy-internal-authorization', authHeader)
      .send({ apiKey: 'key_to_delete' });
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it('should delete API key successfully', async () => {
    const response = await request(app)
      .delete('/pr-bot/user/cursor-key')
      .set('x-kanopy-internal-authorization', authHeader);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify the key was deleted
    const collection = getCollection<UserCredentials>('user_credentials');
    const storedCredentials = await collection.findOne({
      email: testUserId.toLowerCase(),
    });
    expect(storedCredentials).toBeNull();
  });

  it('should return 404 when no key exists', async () => {
    // Delete the key first
    await request(app)
      .delete('/pr-bot/user/cursor-key')
      .set('x-kanopy-internal-authorization', authHeader);

    // Try to delete again
    const response = await request(app)
      .delete('/pr-bot/user/cursor-key')
      .set('x-kanopy-internal-authorization', authHeader);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('No API key found');
  });
});
