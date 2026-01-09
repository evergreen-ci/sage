import express, { Application } from 'express';
import request from 'supertest';
import {
  upsertUserCredentials,
  deleteUserCredentials,
} from '@/db/repositories/userCredentialsRepository';
import cursorKeyRouter from './cursorKey';

// Mock dependencies
vi.mock('@/db/repositories/userCredentialsRepository', () => ({
  upsertUserCredentials: vi.fn(),
  deleteUserCredentials: vi.fn(),
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockUpsertUserCredentials = vi.mocked(upsertUserCredentials);
const mockDeleteUserCredentials = vi.mocked(deleteUserCredentials);

describe('User Cursor Key Routes', () => {
  let app: Application;
  const testUserId = 'test.user@mongodb.com';
  const testRequestId = 'test-request-id';

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a test Express app
    app = express();
    app.use(express.json());
    // Mock the authentication middleware by setting res.locals
    app.use((req, res, next) => {
      res.locals.userId = testUserId;
      res.locals.requestId = testRequestId;
      next();
    });
    app.use('/pr-bot/user', cursorKeyRouter);
  });

  describe('POST /cursor-key', () => {
    it('should store a new API key successfully', async () => {
      const apiKey = 'cursor_api_key_1234567890';
      mockUpsertUserCredentials.mockResolvedValueOnce({
        email: testUserId,
        cursorApiKey: 'encrypted_key',
        keyLastFour: '7890',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .post('/pr-bot/user/cursor-key')
        .send({ apiKey });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.keyLastFour).toBe('7890');
      expect(mockUpsertUserCredentials).toHaveBeenCalledWith({
        email: testUserId,
        cursorApiKey: apiKey,
      });
    });

    it('should return 400 for missing API key', async () => {
      const response = await request(app)
        .post('/pr-bot/user/cursor-key')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request body');
    });

    it('should return 400 for empty API key', async () => {
      const response = await request(app)
        .post('/pr-bot/user/cursor-key')
        .send({ apiKey: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request body');
    });

    it('should return 500 on database error', async () => {
      mockUpsertUserCredentials.mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app)
        .post('/pr-bot/user/cursor-key')
        .send({ apiKey: 'valid_key' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to store API key');
    });
  });

  describe('DELETE /cursor-key', () => {
    it('should delete API key successfully', async () => {
      mockDeleteUserCredentials.mockResolvedValueOnce(true);

      const response = await request(app).delete('/pr-bot/user/cursor-key');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockDeleteUserCredentials).toHaveBeenCalledWith(testUserId);
    });

    it('should return 404 when no key exists', async () => {
      mockDeleteUserCredentials.mockResolvedValueOnce(false);

      const response = await request(app).delete('/pr-bot/user/cursor-key');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('No API key found');
    });

    it('should return 500 on database error', async () => {
      mockDeleteUserCredentials.mockRejectedValueOnce(new Error('DB Error'));

      const response = await request(app).delete('/pr-bot/user/cursor-key');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to delete API key');
    });
  });
});
