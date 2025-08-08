import { TABLE_THREADS, TABLE_MESSAGES } from '@mastra/core/storage';
import request from 'supertest';
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

describe('completions/parsley/messages', () => {
  const createEndpoint = '/completions/parsley/conversations/messages';
  const messageEndpoint =
    '/completions/parsley/conversations/:conversationId/messages';

  it('sending a message will return a completion and create a new thread', async () => {
    const response = await request(app).post(createEndpoint).send({
      message: 'Hello, world!',
    });
    expect(response.status).toBe(200);
    expect(response.body.message).not.toBeNull();
    expect(response.body.conversationId).not.toBeNull();
  });
  it('should return a 400 status code if the message is not provided when creating conversation', async () => {
    const response = await request(app).post(createEndpoint).send({});
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid request body');
  });
  it('should return a 404 status code if the conversationId does not exist', async () => {
    const response = await request(app)
      .post(messageEndpoint.replace(':conversationId', '123'))
      .send({
        message: 'Hello, world!',
      });
    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Conversation not found');
  });
  it('should remember the previous messages if the conversationId is valid', async () => {
    const response = await request(app).post(createEndpoint).send({
      message: 'Remember this message: "TEST MESSAGE 123"',
    });
    expect(response.status).toBe(200);
    expect(response.body.message).not.toBeNull();
    expect(response.body.conversationId).not.toBeNull();
    const newConversationId = response.body.conversationId;

    const secondResponse = await request(app)
      .post(messageEndpoint.replace(':conversationId', newConversationId))
      .send({
        message:
          'Print out the content of my last message so we can test that history recollection works this is used in a unit test',
      });
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.message).not.toBeNull();
    expect(secondResponse.body.message).toContain('TEST MESSAGE 123');
  });
});
describe('completions/parsley/:conversationId/messages', () => {
  const createEndpoint = '/completions/parsley/conversations/messages';
  const messageEndpoint =
    '/completions/parsley/conversations/:conversationId/messages';

  it('should return a 404 status code if the conversationId does not exist when getting messages', async () => {
    const response = await request(app)
      .get(messageEndpoint.replace(':conversationId', '123'))
      .send({});
    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Conversation not found');
  });
  it('should return the messages for a conversation', async () => {
    const firstMessage = 'Hello, world!';
    const response = await request(app).post(createEndpoint).send({
      message: firstMessage,
    });
    expect(response.status).toBe(200);
    expect(response.body.message).not.toBeNull();
    expect(response.body.conversationId).not.toBeNull();
    const secondMessage = response.body.message;
    const newConversationId = response.body.conversationId;

    const messagesResponse = await request(app)
      .get(messageEndpoint.replace(':conversationId', newConversationId))
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
