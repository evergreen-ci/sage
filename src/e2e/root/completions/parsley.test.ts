import { TABLE_THREADS, TABLE_MESSAGES } from '@mastra/core/storage';
import request from 'supertest';
import { LogTypes } from 'types/parsley';
import { TaskLogOrigin } from 'types/task';
import { memoryStore } from '../../../mastra/utils/memory';
import setupTestAppServer from '../../setup';
import { getMessageContent } from '../../utils';

const app = setupTestAppServer();

const chatEndpoint = '/completions/parsley/conversations/chat';
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

describe('POST /completions/parsley/conversations/chat', () => {
  const logMetadata = {
    task_id: '123',
    execution: 1,
    log_type: LogTypes.EVERGREEN_TASK_LOGS,
    origin: TaskLogOrigin.Task,
  };
  it('should validate the logMetadata', async () => {
    const response = await request(app)
      .post(chatEndpoint)
      .send({ logMetadata: { ...logMetadata, log_type: 'INVALID' } });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid request body');
  });

  it('sending a message will return a completion and create a new thread and store the log metadata and logURL', async () => {
    const id = '1';
    const response = await request(app).post(chatEndpoint).send({
      id,
      message: 'Hello, world!',
      logMetadata,
    });

    expect(response.status).toBe(200);
    expect(response.text).toBeTruthy();

    const thread = await memoryStore.getThreadById({
      threadId: id,
    });
    expect(thread).toBeTruthy();
    const logMetadataObj = thread?.metadata?.logMetadata as
      | typeof logMetadata
      | undefined;
    expect(logMetadataObj?.log_type).toBe(logMetadata.log_type);
    expect(logMetadataObj?.task_id).toBe(logMetadata.task_id);
    expect(logMetadataObj?.execution).toBe(logMetadata.execution);
    expect(logMetadataObj?.origin).toBe(logMetadata.origin);
    console.log(thread?.metadata?.logURL);
    expect(thread?.metadata?.logURL).toEqual(
      'http://localhost:9090/task_log_raw/123/1?text=true&type=T'
    );
  });

  it('should return a 400 status code if the id is not provided', async () => {
    const response = await request(app)
      .post(chatEndpoint)
      .send({ logMetadata, message: 'Hello, world!' });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid request body');
  });

  it('should return a 400 status code if the message is not provided', async () => {
    const response = await request(app)
      .post(chatEndpoint)
      .send({ id: '2', logMetadata });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid request body');
  });
});

describe('GET /completions/parsley/conversations/:conversationId/messages', () => {
  const endpoint =
    '/completions/parsley/conversations/:conversationId/messages';
  const logMetadata = {
    task_id: '123',
    execution: 1,
    log_type: LogTypes.EVERGREEN_TASK_LOGS,
    origin: TaskLogOrigin.Task,
  };

  it('should return a 404 status code if the conversationId is not null and the conversation does not exist', async () => {
    const response = await request(app)
      .get(endpoint.replace(':conversationId', '123'))
      .send({
        message: 'Hello, world!',
      });
    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Conversation not found');
  });

  it('should return the messages for a conversation', async () => {
    const id = '789';
    const firstMessage = 'Hello, world!';
    const response = await request(app).post(chatEndpoint).send({
      id,
      message: firstMessage,
      logMetadata,
    });
    expect(response.status).toBe(200);
    expect(response.text).toBeTruthy();

    const messagesResponse = await request(app)
      .get(endpoint.replace(':conversationId', id))
      .send({});
    expect(messagesResponse.status).toBe(200);
    expect(messagesResponse.body.messages).not.toBeNull();
    expect(messagesResponse.body.messages.length).toBe(2);
    expect(getMessageContent(messagesResponse.body.messages[0])).toBe(
      firstMessage
    );
    expect(messagesResponse.body.messages[0].role).toBe('user');
    expect(messagesResponse.body.messages[1].role).toBe('assistant');
  });
});

vi.mock('braintrust', () => ({
  initLogger: vi.fn().mockReturnValue({
    logFeedback: vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('Braintrust error');
      })
      .mockImplementation(() => {}),
  }),
}));

describe('POST /completions/parsley/conversations/rate', () => {
  it('catches a Braintrust error', async () => {
    const response = await request(app)
      .post(rateEndpoint)
      .send({ messageId: '123', rating: 1 });
    expect(response.status).toBe(503);
  });

  it('sends a rating to Braintrust', async () => {
    const response = await request(app)
      .post(rateEndpoint)
      .send({ messageId: '123', rating: 1 });
    expect(response.status).toBe(204);
  });

  it('catches an input error', async () => {
    const response = await request(app)
      .post(rateEndpoint)
      .send({ messageId: '123', rating: -1 });
    expect(response.status).toBe(400);
  });
});
