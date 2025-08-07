import { TABLE_THREADS, TABLE_MESSAGES } from '@mastra/core/storage';
import request from 'supertest';
import { LogTypes } from 'types/parsley';
import { TaskLogOrigin } from 'types/task';
import { memoryStore } from '../../../mastra/utils/memory';
import setupTestAppServer from '../../setup';
import { getMessageContent } from '../../utils';

const app = setupTestAppServer();

afterAll(async () => {
  console.log('Clearing tables');
  try {
    await memoryStore.clearTable({ tableName: TABLE_THREADS });
    await memoryStore.clearTable({ tableName: TABLE_MESSAGES });
    console.log('Tables cleared');
  } catch (error) {
    console.error('Error clearing tables', error);
  }
});

describe('POST /completions/parsley/conversations/:conversationId/messages', () => {
  const endpoint =
    '/completions/parsley/conversations/:conversationId/messages';
  const conversationId = 'null';
  const logMetadata = {
    task_id: '123',
    execution: 1,
    log_type: LogTypes.EVERGREEN_TASK_LOGS,
    origin: TaskLogOrigin.Task,
  };
  it('sending a message will return a completion and create a new thread', async () => {
    const response = await request(app)
      .post(endpoint.replace(':conversationId', conversationId))
      .send({
        message: 'Hello, world!',
        logMetadata,
      });
    expect(response.status).toBe(200);
    expect(response.body.message).not.toBeNull();
    expect(response.body.conversationId).not.toBeNull();
  });
  it('should validate the logMetadata', async () => {
    const response = await request(app)
      .post(endpoint.replace(':conversationId', conversationId))
      .send({ logMetadata: { ...logMetadata, log_type: 'INVALID' } });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid request body');
  });
  it('should return a 400 status code if the message is not provided', async () => {
    const response = await request(app)
      .post(endpoint.replace(':conversationId', conversationId))
      .send({ logMetadata });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid request body');
  });
  it('should return a 404 status code if the conversationId is not null and the conversation does not exist', async () => {
    const response = await request(app)
      .post(endpoint.replace(':conversationId', '123'))
      .send({
        message: 'Hello, world!',
        logMetadata,
      });
    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Conversation not found');
  });
  it('should remember the previous messages if the conversationId is not null', async () => {
    const response = await request(app)
      .post(endpoint.replace(':conversationId', 'null'))
      .send({
        message: 'Remember this message: "TEST MESSAGE 123"',
        logMetadata,
      });
    expect(response.status).toBe(200);
    expect(response.body.message).not.toBeNull();
    expect(response.body.conversationId).not.toBeNull();
    const newConversationId = response.body.conversationId;

    const secondResponse = await request(app)
      .post(endpoint.replace(':conversationId', newConversationId))
      .send({
        message:
          'Print out the content of my last message so we can test that history recollection works this is used in a unit test',
        logMetadata,
      });
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.message).not.toBeNull();
    expect(secondResponse.body.message).toContain('TEST MESSAGE 123');
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
    const conversationId = 'null';
    const firstMessage = 'Hello, world!';
    const response = await request(app)
      .post(endpoint.replace(':conversationId', conversationId))
      .send({
        message: firstMessage,
        logMetadata,
      });
    expect(response.status).toBe(200);
    expect(response.body.message).not.toBeNull();
    expect(response.body.conversationId).not.toBeNull();
    const secondMessage = response.body.message;
    const newConversationId = response.body.conversationId;

    const messagesResponse = await request(app)
      .get(endpoint.replace(':conversationId', newConversationId))
      .send({});
    expect(messagesResponse.status).toBe(200);
    expect(messagesResponse.body.messages).not.toBeNull();
    console.log(messagesResponse.body);
    expect(messagesResponse.body.messages.length).toBe(2);
    expect(getMessageContent(messagesResponse.body.messages[0])).toBe(
      firstMessage
    );
    expect(getMessageContent(messagesResponse.body.messages[1])).toBe(
      secondMessage
    );
  });
});
