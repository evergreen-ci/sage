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
}, 30000);

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

describe('completions/parsley/conversations/:conversationId/messages with taskWorkflow', () => {
  const endpoint =
    '/completions/parsley/conversations/:conversationId/messages';

  it('should use taskWorkflow to fetch task details from evergreenClient and return information to the user', async () => {
    // Mock the evergreenClient's executeQuery method
    const mockTaskData = {
      task: {
        id: 'task_123',
        displayName: 'Test Task',
        displayStatus: 'succeeded',
        execution: 0,
        patchNumber: 12345,
        buildVariant: 'ubuntu2204',
        projectIdentifier: 'test-project',
        versionMetadata: {
          id: 'version_123',
          isPatch: false,
          message: 'Test commit message',
          projectIdentifier: 'test-project',
          projectMetadata: {
            id: 'project_123',
          },
          revision: 'abcdef123456',
        },
        details: {
          description: 'Task completed successfully',
          failingCommand: null,
          status: 'success',
        },
      },
    };

    const { GraphQLClient } = await import('../../../utils/graphql/client');
    const originalExecuteQuery = GraphQLClient.prototype.executeQuery;

    const executeQueryMock = vi.fn().mockImplementation(async query => {
      if (query.includes('query GetTask')) {
        return mockTaskData;
      }
      return {};
    });

    GraphQLClient.prototype.executeQuery = executeQueryMock;

    try {
      const response = await request(app)
        .post(endpoint.replace(':conversationId', 'null'))
        .send({
          message: 'Use taskWorkflow to get task task_123',
        })
        .timeout(30000);

      if (response.status !== 200) {
        console.log('Response error:', response.body);
      }

      expect(response.status).toBe(200);
      expect(response.body.message).not.toBeNull();
      expect(response.body.conversationId).not.toBeNull();
      expect(executeQueryMock).toHaveBeenCalled();

      const { calls } = executeQueryMock.mock;
      const taskQueryCall = calls.find(
        call => call[0] && call[0].includes('query GetTask')
      );

      expect(taskQueryCall).toBeDefined();
      if (taskQueryCall) {
        expect(taskQueryCall[1]).toMatchObject({
          taskId: 'task_123',
        });
      }

      const responseMessage = response.body.message.toLowerCase();
      expect(responseMessage).toContain('task');
    } finally {
      GraphQLClient.prototype.executeQuery = originalExecuteQuery;
    }
  }, 30000);
});
