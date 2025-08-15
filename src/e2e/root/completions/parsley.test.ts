import { TABLE_THREADS, TABLE_MESSAGES } from '@mastra/core/storage';
import request from 'supertest';
import { vi } from 'vitest';
import { memoryStore } from '../../../mastra/utils/memory';
import setupTestAppServer from '../../setup';
import { getMessageContent } from '../../utils';

const app = setupTestAppServer();

afterAll(async () => {
  console.log('Clearing tables for network tests');
  try {
    await memoryStore.clearTable({ tableName: TABLE_THREADS });
    await memoryStore.clearTable({ tableName: TABLE_MESSAGES });
    console.log('Tables cleared');
  } catch (error) {
    console.error('Error clearing tables', error);
  }
}, 30000);

describe('completions/parsley-network/conversations/:conversationId/messages', () => {
  const endpoint =
    '/completions/parsley-network/conversations/:conversationId/messages';
  const conversationId = 'null';

  it('sending a message will return a completion and create a new thread', async () => {
    const response = await request(app)
      .post(endpoint.replace(':conversationId', conversationId))
      .send({
        message: 'Hello from network!',
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

  it('should return a 404 status code if the conversationId is not null and the conversation does not exist', async () => {
    const response = await request(app)
      .post(endpoint.replace(':conversationId', 'non-existent-123'))
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
        message: 'Remember this message: "NETWORK TEST 456"',
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
      });
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.message).not.toBeNull();
    expect(secondResponse.body.message).toContain('NETWORK TEST 456');
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

describe('completions/parsley-network/conversations/:conversationId/messages GET', () => {
  const endpoint =
    '/completions/parsley-network/conversations/:conversationId/messages';

  it('should return a 404 status code if the conversationId does not exist', async () => {
    const response = await request(app)
      .get(endpoint.replace(':conversationId', 'non-existent-456'))
      .send({});
    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Conversation not found');
  });

  it('should return the messages for a conversation', async () => {
    const conversationId = 'null';
    const firstMessage = 'Hello from network GET test!';
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
    expect(messagesResponse.body.messages.length).toBe(2);
    expect(getMessageContent(messagesResponse.body.messages[0])).toBe(
      firstMessage
    );
    expect(getMessageContent(messagesResponse.body.messages[1])).toBe(
      secondMessage
    );
  });
});

describe('completions/parsley-network with taskWorkflow through network routing', () => {
  const endpoint =
    '/completions/parsley-network/conversations/:conversationId/messages';

  it('should route through network to use taskWorkflow and fetch task details', async () => {
    // Mock the evergreenClient's executeQuery method
    const mockTaskData = {
      task: {
        id: 'network_task_789',
        displayName: 'Network Test Task',
        displayStatus: 'succeeded',
        execution: 0,
        patchNumber: 54321,
        buildVariant: 'ubuntu2204',
        projectIdentifier: 'network-test-project',
        versionMetadata: {
          id: 'version_789',
          isPatch: false,
          message: 'Network test commit message',
          projectIdentifier: 'network-test-project',
          projectMetadata: {
            id: 'project_789',
          },
          revision: 'fedcba654321',
        },
        details: {
          description: 'Network task completed successfully',
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
          message: 'Use taskWorkflow to get task network_task_789',
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
          taskId: 'network_task_789',
        });
      }

      const responseMessage = response.body.message.toLowerCase();
      expect(responseMessage).toContain('task');
    } finally {
      GraphQLClient.prototype.executeQuery = originalExecuteQuery;
    }
  }, 30000);
});
