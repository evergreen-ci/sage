import { TABLE_THREADS, TABLE_MESSAGES } from '@mastra/core/storage';
import request from 'supertest';
import { memoryStore } from '../../../mastra/utils/memory';
import setupTestAppServer from '../../setup';

const app = setupTestAppServer();

const rateEndpoint = '/completions/parsley/conversations/rate';

afterAll(async () => {
  console.log('Clearing tables');
  try {
    await memoryStore.clearTable({ tableName: TABLE_THREADS });
    await memoryStore.clearTable({ tableName: TABLE_MESSAGES });
    console.log('Tables cleared');
  } catch (error) {
    console.error('Error clearing tables', error);
  }
}, 30000);

vi.mock('braintrust', async importOriginal => {
  const actual = await importOriginal();
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
