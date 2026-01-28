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

// Evergreen service account SPIFFE identity
const EVERGREEN_SPIFFE_IDENTITY =
  'spiffe://cluster.local/ns/devprod-evergreen/sa/evergreen-sa';

// Create a valid X-Forwarded-Client-Cert header with SPIFFE URI
const createXfccHeader = (spiffeUri: string): string => {
  return `By=spiffe://cluster.local/ns/test/sa/test;Hash=abc123;Subject="";URI=${spiffeUri}`;
};

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

describe('Evergreen service-to-service authentication', () => {
  const evergreenTestUserId = 'evergreen.test.user';

  afterEach(async () => {
    // Clean up test data for Evergreen user
    try {
      const collection = getCollection<UserCredentials>('user_credentials');
      await collection.deleteOne({
        email: `${evergreenTestUserId}@mongodb.com`.toLowerCase(),
      });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should authenticate with X-Evergreen-User-ID header when caller is Evergreen service account', async () => {
    const apiKey = 'evergreen_service_key_1234';

    const response = await request(app)
      .post('/pr-bot/user/cursor-key')
      .set(
        'x-forwarded-client-cert',
        createXfccHeader(EVERGREEN_SPIFFE_IDENTITY)
      )
      .set('x-evergreen-user-id', evergreenTestUserId)
      .send({ apiKey });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.keyLastFour).toBe('1234');

    // Verify the key was stored for the correct user
    const collection = getCollection<UserCredentials>('user_credentials');
    const storedCredentials = await collection.findOne({
      email: `${evergreenTestUserId}@mongodb.com`.toLowerCase(),
    });
    expect(storedCredentials).not.toBeNull();
  });

  it('should reject X-Evergreen-User-ID header from untrusted caller', async () => {
    const apiKey = 'malicious_key_5678';

    // Send request without XFCC header (untrusted caller)
    const response = await request(app)
      .post('/pr-bot/user/cursor-key')
      .set('x-evergreen-user-id', evergreenTestUserId)
      .send({ apiKey });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('No authentication provided');
  });

  it('should reject X-Evergreen-User-ID header from non-Evergreen service account', async () => {
    const apiKey = 'malicious_key_5678';
    const untrustedSpiffeId =
      'spiffe://cluster.local/ns/other-namespace/sa/other-sa';

    const response = await request(app)
      .post('/pr-bot/user/cursor-key')
      .set('x-forwarded-client-cert', createXfccHeader(untrustedSpiffeId))
      .set('x-evergreen-user-id', evergreenTestUserId)
      .send({ apiKey });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('No authentication provided');
  });

  it('should reject Evergreen service account request without X-Evergreen-User-ID header', async () => {
    const apiKey = 'missing_user_key_9999';

    const response = await request(app)
      .post('/pr-bot/user/cursor-key')
      .set(
        'x-forwarded-client-cert',
        createXfccHeader(EVERGREEN_SPIFFE_IDENTITY)
      )
      // Missing x-evergreen-user-id header
      .send({ apiKey });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('No authentication provided');
  });

  it('should allow GET request with Evergreen service-to-service auth', async () => {
    // First create a key using Evergreen auth
    await request(app)
      .post('/pr-bot/user/cursor-key')
      .set(
        'x-forwarded-client-cert',
        createXfccHeader(EVERGREEN_SPIFFE_IDENTITY)
      )
      .set('x-evergreen-user-id', evergreenTestUserId)
      .send({ apiKey: 'evergreen_get_test_key' });

    // Then retrieve it
    const response = await request(app)
      .get('/pr-bot/user/cursor-key')
      .set(
        'x-forwarded-client-cert',
        createXfccHeader(EVERGREEN_SPIFFE_IDENTITY)
      )
      .set('x-evergreen-user-id', evergreenTestUserId);

    expect(response.status).toBe(200);
    expect(response.body.hasKey).toBe(true);
    expect(response.body.keyLastFour).toBe('_key');
  });

  it('should allow DELETE request with Evergreen service-to-service auth', async () => {
    // First create a key using Evergreen auth
    await request(app)
      .post('/pr-bot/user/cursor-key')
      .set(
        'x-forwarded-client-cert',
        createXfccHeader(EVERGREEN_SPIFFE_IDENTITY)
      )
      .set('x-evergreen-user-id', evergreenTestUserId)
      .send({ apiKey: 'evergreen_delete_test' });

    // Then delete it
    const response = await request(app)
      .delete('/pr-bot/user/cursor-key')
      .set(
        'x-forwarded-client-cert',
        createXfccHeader(EVERGREEN_SPIFFE_IDENTITY)
      )
      .set('x-evergreen-user-id', evergreenTestUserId);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
