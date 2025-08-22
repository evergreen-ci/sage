import { TABLE_THREADS, TABLE_MESSAGES } from '@mastra/core/storage';
import request from 'supertest';
import { LogTypes } from 'types/parsley';
import { TaskLogOrigin } from 'types/task';
import { memoryStore } from '../../../mastra/utils/memory';
import setupTestAppServer from '../../setup';
import { getMessageContent } from '../../utils';

const app = setupTestAppServer();

const chatEndpoint = '/completions/parsley/conversations/chat';

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

  it('sending a message will return a completion and create a new thread and store the log metadata', async () => {
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
    expect(thread?.metadata?.log_type).toBe(logMetadata.log_type);
    expect(thread?.metadata?.task_id).toBe(logMetadata.task_id);
    expect(thread?.metadata?.execution).toBe(logMetadata.execution);
    expect(thread?.metadata?.origin).toBe(logMetadata.origin);
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

describe('completions/parsley/conversations/:conversationId/messages with taskWorkflow', () => {
  const taskId =
    'evg_lint_generate_lint_ecbbf17f49224235d43416ea55566f3b1894bbf7_25_03_21_21_09_20';
  it('should use taskWorkflow to fetch task details from evergreenClient and return information to the user', async () => {
    const { GraphQLClient } = await import('../../../utils/graphql/client');
    const executeQuerySpy = vi.spyOn(GraphQLClient.prototype, 'executeQuery');
    executeQuerySpy.mockResolvedValue({
      task: {
        id: taskId,
        status: 'failed',
        displayName: 'Test Task',
        details: {
          status: 'failed',
          type: 'test',
        },
      },
    });

    const id = '456';

    try {
      const response = await request(app)
        .post(chatEndpoint)
        .send({
          id,
          message: `Get task ${taskId} and tell me its status`,
          logMetadata: {
            task_id: taskId,
            execution: 0,
            log_type: LogTypes.EVERGREEN_TASK_LOGS,
            origin: TaskLogOrigin.Task,
          },
        })
        .timeout(30000);

      expect(response.status).toBe(200);
      expect(response.text).toBeTruthy();
      const responseMessage = response.text.toLowerCase();
      expect(responseMessage.length).toBeGreaterThan(0);
    } finally {
      executeQuerySpy.mockRestore();
    }
  }, 30000);
});
