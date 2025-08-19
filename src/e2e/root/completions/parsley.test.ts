import { TABLE_THREADS, TABLE_MESSAGES } from '@mastra/core/storage';
import request from 'supertest';
import { LogTypes } from 'types/parsley';
import { TaskLogOrigin } from 'types/task';
import { memoryStore } from '../../../mastra/utils/memory';
import setupTestAppServer from '../../setup';
import { getMessageContent } from '../../utils';

const app = setupTestAppServer();

afterAll(async () => {
  console.log('Clearing tables for tests');
  try {
    await memoryStore.clearTable({ tableName: TABLE_THREADS });
    await memoryStore.clearTable({ tableName: TABLE_MESSAGES });
    console.log('Tables cleared');
  } catch (error) {
    console.error('Error clearing tables', error);
  }
}, 30000);

describe('completions/parsley/conversations/:conversationId/messages', () => {
  const endpoint =
    '/completions/parsley/conversations/:conversationId/messages';
  const conversationId = 'null';
  const logMetadata = {
    task_id: '123',
    execution: 1,
    log_type: LogTypes.EVERGREEN_TASK_LOGS,
    origin: TaskLogOrigin.Task,
  };
  it('should validate the logMetadata', async () => {
    const response = await request(app)
      .post(endpoint.replace(':conversationId', conversationId))
      .send({ logMetadata: { ...logMetadata, log_type: 'INVALID' } });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid request body');
  });
  it('sending a message will return a completion and create a new thread and store the log metadata', async () => {
    const response = await request(app)
      .post(endpoint.replace(':conversationId', conversationId))
      .send({
        message: 'Hello, world!',
        logMetadata,
      });
    expect(response.status).toBe(200);

    expect(response.body.message).not.toBeNull();
    expect(response.body.conversationId).not.toBeNull();
    const thread = await memoryStore.getThreadById({
      threadId: response.body.conversationId,
    });
    expect(thread).not.toBeNull();
    expect(thread?.metadata?.log_type).toBe(logMetadata.log_type);
    expect(thread?.metadata?.task_id).toBe(logMetadata.task_id);
    expect(thread?.metadata?.execution).toBe(logMetadata.execution);
    expect(thread?.metadata?.origin).toBe(logMetadata.origin);
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
      .post(endpoint.replace(':conversationId', 'non-existent-123'))
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
    expect(secondResponse.body.message).toContain('TEST 456');
  });

  it('should optionally include agent interaction summary', async () => {
    const response = await request(app)
      .post(endpoint.replace(':conversationId', 'null'))
      .send({
        message: 'What tasks are available?',
      });
    expect(response.status).toBe(200);
    expect(response.body.message).not.toBeNull();
    // Agent interaction summary may or may not be present
    if (response.body.agentInteractionSummary) {
      expect(typeof response.body.agentInteractionSummary).toBe('string');
    }
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
      .get(endpoint.replace(':conversationId', 'non-existent-456'))
      .send({});
    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Conversation not found');
  });

  it('should return the messages for a conversation', async () => {
    const conversationId = 'null';
    const firstMessage = 'Hello from GET test!';
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
    expect(messagesResponse.body.messages.length).toBe(2);
    expect(getMessageContent(messagesResponse.body.messages[0])).toBe(
      firstMessage
    );
    expect(getMessageContent(messagesResponse.body.messages[1])).toBe(
      secondMessage
    );
  });
});

describe('completions/parsley with taskWorkflow through routing', () => {
  const endpoint =
    '/completions/parsley/conversations/:conversationId/messages';
  const taskId =
    'evg_lint_generate_lint_ecbbf17f49224235d43416ea55566f3b1894bbf7_25_03_21_21_09_20';
  it('should use taskWorkflow to fetch task details from evergreenClient and return information to the user', async () => {
    const { GraphQLClient } = await import('../../../utils/graphql/client');
    const executeQuerySpy = vi.spyOn(GraphQLClient.prototype, 'executeQuery');

    try {
      const response = await request(app)
        .post(endpoint.replace(':conversationId', 'null'))
        .send({
          message: `In this test, use taskWorkflow to fetch the task ${taskId}. Return only the task status as the output, with no extra text.`,
          logMetadata: {
            task_id: taskId,
            execution: 0,
            log_type: LogTypes.EVERGREEN_TASK_LOGS,
            origin: TaskLogOrigin.Task,
          },
        })
        .timeout(30000);

      if (response.status !== 200) {
        console.log('Response error:', response.body);
      }

      expect(response.status).toBe(200);
      expect(response.body.message).not.toBeNull();
      expect(response.body.conversationId).not.toBeNull();
      expect(executeQuerySpy).toHaveBeenCalled();

      const { calls } = executeQuerySpy.mock;
      const taskQueryCall = calls.find(
        (call: any) => call[0] && call[0].includes('query GetTask')
      );

      expect(taskQueryCall).toBeDefined();
      if (taskQueryCall) {
        expect(taskQueryCall[1]).toMatchObject({
          taskId,
        });
      }

      const responseMessage = response.body.message.toLowerCase();

      expect(responseMessage).toContain('failed');
    } finally {
      executeQuerySpy.mockRestore();
    }
  }, 30000);
});
