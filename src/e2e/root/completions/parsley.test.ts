import request from 'supertest';
import setupTestAppServer from '../../setup';
import { getMessageContent } from '../../utils';

const app = setupTestAppServer();

describe('completions/parsley/conversations/:conversationId/messages', () => {
  const endpoint =
    '/completions/parsley/conversations/:conversationId/messages';
  const conversationId = 'null';
  it('sending a message will return a completion and create a new thread', async () => {
    const response = await request(app)
      .post(endpoint.replace(':conversationId', conversationId))
      .send({
        message: 'Hello, world!',
      });
    expect(response.status).toBe(200);
    expect(response.body.message).not.toBeNull();
    expect(response.body.conversationId).not.toBeNull();
  });
  it('should return a 400 status code if the message is not provided', async () => {
    const response = await request(app)
      .post(endpoint.replace(':conversationId', conversationId))
      .send({});
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid request body');
  });
  it('should return a 400 status code if the conversationId is not null and the conversation does not exist', async () => {
    const response = await request(app)
      .post(endpoint.replace(':conversationId', '123'))
      .send({
        message: 'Hello, world!',
      });
    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Conversation not found');
  });
  it('should remember the previous messages if the conversationId is not null', async () => {
    const response = await request(app)
      .post(endpoint.replace(':conversationId', 'null'))
      .send({
        message: 'Hello, world!',
      });
    expect(response.status).toBe(200);
    expect(response.body.message).not.toBeNull();
    expect(response.body.conversationId).not.toBeNull();
    const newConversationId = response.body.conversationId;

    const secondResponse = await request(app)
      .post(endpoint.replace(':conversationId', newConversationId))
      .send({
        message: 'Tell me EXACTLY what the last message I sent was',
      });
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.message).not.toBeNull();
    expect(secondResponse.body.message).toContain('Hello, world!');
  });
});
describe('completions/parsley/conversations/:conversationId/messages', () => {
  const endpoint =
    '/completions/parsley/conversations/:conversationId/messages';
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
