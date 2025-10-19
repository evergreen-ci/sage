import Braintrust from 'braintrust';
import request from 'supertest';
import setupTestAppServer from '@/e2e/setup';

const app = setupTestAppServer();

const rateEndpoint = '/completions/parsley/conversations/rate';

vi.mock('@/utils/braintrust', () => ({
  resolveRowIdByTraceId: vi.fn().mockResolvedValue('mock-row-id'),
}));

vi.mock('braintrust', async importOriginal => {
  const actual = await importOriginal<typeof Braintrust>();
  return {
    ...actual,
    initLogger: vi.fn().mockReturnValue({
      logFeedback: vi
        .fn()
        .mockImplementationOnce(() => {
          throw new Error('Braintrust error');
        })
        .mockImplementation(() => {}),
    }),
  };
});

describe('POST /completions/parsley/conversations/rate', () => {
  it('catches a Braintrust error', async () => {
    const response = await request(app)
      .post(rateEndpoint)
      .send({ spanId: '123', rating: 1 });
    expect(response.status).toBe(503);
  });

  it('sends a 0 rating to Braintrust', async () => {
    const response = await request(app)
      .post(rateEndpoint)
      .send({ spanId: '123', rating: 0 });
    expect(response.status).toBe(204);
  });

  it('sends a 1 rating to Braintrust', async () => {
    const response = await request(app)
      .post(rateEndpoint)
      .send({ spanId: '123', rating: 1 });
    expect(response.status).toBe(204);
  });

  it('catches an input error', async () => {
    const response = await request(app)
      .post(rateEndpoint)
      .send({ spanId: '123', rating: -1 });
    expect(response.status).toBe(400);
  });
});
