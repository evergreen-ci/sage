import request from 'supertest';
import sageServer from '../../../index';

// Mock dependencies
vi.mock('config', async () => {
  const { createMockConfig } = await import('../../../../test-utils/mocks');
  return createMockConfig();
});

vi.mock('mastra', async () => {
  const { createMockMastraAgent } = await import(
    '../../../../test-utils/mocks'
  );
  return createMockMastraAgent();
});

vi.mock('utils/logger', async () => {
  const { createMockLogger } = await import('../../../../test-utils/mocks');
  return createMockLogger();
});

const app = sageServer.getApp();

describe('Parsley Completions Route', () => {
  it('should successfully generate a completion', async () => {
    const { mastra } = await import('mastra');
    const mockGenerate = vi.fn().mockResolvedValue({
      text: 'Test response',
      usage: { tokens: 15 },
    });
    vi.mocked(mastra.getAgent('parsleyAgent').generate).mockImplementation(
      mockGenerate
    );

    const response = await request(app)
      .post('/completions/parsley')
      .send({ message: 'Test prompt' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('message', 'Test response');
    expect(response.body).toHaveProperty('requestId');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('completionUsage', { tokens: 15 });
  });

  it('should reject empty message', async () => {
    const response = await request(app)
      .post('/completions/parsley')
      .send({ message: '' });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: 'Invalid request body',
    });
  });

  it('should reject missing message', async () => {
    const response = await request(app).post('/completions/parsley').send({});

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: 'Invalid request body',
    });
  });

  it('should handle agent generation errors', async () => {
    const { mastra } = await import('mastra');
    const mockGenerate = vi
      .fn()
      .mockRejectedValue(new Error('Agent generation failed'));
    vi.mocked(mastra.getAgent('parsleyAgent').generate).mockImplementation(
      mockGenerate
    );

    const response = await request(app)
      .post('/completions/parsley')
      .send({ message: 'Error test prompt' });

    expect(response.statusCode).toBe(500);
    expect(response.body).toHaveProperty('message');
  });
});
