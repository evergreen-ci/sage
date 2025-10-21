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

  it('sends a 0 rating to Braintrust', async () => {
    const logMetadata = {
      task_id: '123',
      execution: 1,
      log_type: LogTypes.EVERGREEN_TASK_LOGS,
      origin: TaskLogOrigin.Task,
    };
    const id = 'rate-test-0';
    const chatResponse = await request(app).post(chatEndpoint).send({
      id,
      message: 'Hello, world!',
      logMetadata,
    });
    expect(chatResponse.status).toBe(200);
    const spanId = extractSpanIdFromStream(chatResponse.text);
    expect(spanId).toBeTruthy();
    const response = await request(app)
      .post(rateEndpoint)
      .send({ spanId, rating: 0 });
    expect(response.status).toBe(204);
  });

  it('sends a 1 rating to Braintrust', async () => {
    const logMetadata = {
      task_id: '456',
      execution: 1,
      log_type: LogTypes.EVERGREEN_TASK_LOGS,
      origin: TaskLogOrigin.Task,
    };
    const id = 'rate-test-1';
    const chatResponse = await request(app).post(chatEndpoint).send({
      id,
      message: 'Test message',
      logMetadata,
    });
    expect(chatResponse.status).toBe(200);
    const spanId = extractSpanIdFromStream(chatResponse.text);
    expect(spanId).toBeTruthy();
    const response = await request(app)
      .post(rateEndpoint)
      .send({ spanId, rating: 1 });
    expect(response.status).toBe(204);
  });

  it('catches an input error', async () => {
    const response = await request(app)
      .post(rateEndpoint)
      .send({ spanId: '123', rating: -1 });
    expect(response.status).toBe(400);
  });
});
