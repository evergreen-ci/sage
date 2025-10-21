import request from 'supertest';
import setupTestAppServer from '@/e2e/setup';
import { extractSpanIdFromStream } from '@/e2e/utils/streamParser';
import { braintrustLogger } from '@/mastra';
import { LogTypes } from '@/types/parsley';
import { TaskLogOrigin } from '@/types/task';
import * as braintrustUtils from '@/utils/braintrust';

const app = setupTestAppServer();

const rateEndpoint = '/completions/parsley/conversations/rate';
const chatEndpoint = '/completions/parsley/conversations/chat';

describe('POST /completions/parsley/conversations/rate', () => {
  it('catches a Braintrust error', async () => {
    vi.spyOn(braintrustUtils, 'resolveRowIdByTraceId').mockResolvedValue(
      'mock-row-id'
    );
    const logFeedbackSpy = vi.spyOn(braintrustLogger, 'logFeedback');
    logFeedbackSpy.mockImplementationOnce(() => {
      throw new Error('Braintrust error');
    });
    const response = await request(app)
      .post(rateEndpoint)
      .send({ spanId: '123', rating: 1 });
    expect(response.status).toBe(503);
    vi.restoreAllMocks();
  });

  // Sequential because we want to ensure the rating is applied one after the other to the same spanId.
  describe.sequential('sends a rating to Braintrust', () => {
    let spanId: string;
    beforeAll(async () => {
      const logMetadata = {
        task_id: '123',
        execution: 1,
        log_type: LogTypes.EVERGREEN_TASK_LOGS,
        origin: TaskLogOrigin.Task,
      };
      const id = `rate-test-${Math.random().toString(36).substring(7)}`;
      const chatResponse = await request(app).post(chatEndpoint).send({
        id,
        message: 'Hello, world!',
        logMetadata,
      });
      expect(chatResponse.status).toBe(200);
      spanId = extractSpanIdFromStream(chatResponse.text, true) as string;
      expect(spanId).toBeTruthy();
    });
    it('sends a 0 rating to Braintrust', async () => {
      expect(spanId).toBeDefined();
      const response = await request(app)
        .post(rateEndpoint)
        .send({ spanId, rating: 0 });
      expect(response.status).toBe(204);
    });

    it('sends a 1 rating to Braintrust', async () => {
      expect(spanId).toBeDefined();
      const response = await request(app)
        .post(rateEndpoint)
        .send({ spanId, rating: 1 });
      expect(response.status).toBe(204);
    });

    it('catches an input error', async () => {
      expect(spanId).toBeDefined();
      const response = await request(app)
        .post(rateEndpoint)
        .send({ spanId: spanId, rating: -1 });
      expect(response.status).toBe(400);
    });
  });
});
