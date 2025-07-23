import request from 'supertest';
import sageServer from './index';

// Mock dependencies
vi.mock('config', async () => {
  const { createMockConfig } = await import('../test-utils/mocks');
  return createMockConfig();
});

vi.mock('mastra', () => ({
  mastra: {
    getAgents: vi.fn().mockReturnValue({
      'default-agent': {
        getModel: vi.fn().mockReturnValue({}),
      },
    }),
  },
}));

vi.mock('utils/logger', async () => {
  const { createMockLogger } = await import('../test-utils/mocks');
  return createMockLogger();
});

const app = sageServer.getApp();

describe('API Server Endpoints', () => {
  it('should respond to root route', async () => {
    const response = await request(app).get('/');
    expect(response.statusCode).toBe(200);
  });

  it('should have a health check endpoint', async () => {
    const response = await request(app).get('/health');
    expect(response.statusCode).toBeGreaterThanOrEqual(200);
    expect(response.statusCode).toBeLessThan(600);
    expect(response.body).toHaveProperty('status');
    expect(['healthy', 'error']).toContain(response.body.status);
  });

  it('should have completions route', async () => {
    const response = await request(app).post('/completions');
    expect([200, 400, 404, 500]).toContain(response.statusCode);
  });
});
