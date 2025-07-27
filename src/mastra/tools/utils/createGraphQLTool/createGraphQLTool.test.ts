import { RuntimeContext } from '@mastra/core/runtime-context';
import { vi } from 'vitest';
import { z } from 'zod';
import { createGraphQLTool } from './index';

// Mock the GraphQL client
vi.mock('../../../../utils/graphql/evergreenGraphQLClient', () => ({
  evergreenGraphQLClient: {
    executeQuery: vi.fn(),
  },
}));

describe('createGraphQLTool', () => {
  it('should create a graphql tool', () => {
    const tool = createGraphQLTool({
      query: 'query { hello }',
      id: 'test',
      inputSchema: z.object({}),
      description: 'test',
    });
    expect(tool).toBeDefined();
    expect(tool.id).toBe('test');
    expect(tool.description).toBe('test');
    expect(tool.execute).toBeDefined();
    expect(tool.execute).toBeInstanceOf(Function);
  });

  it('should execute a graphql query when execute is called', async () => {
    const tool = createGraphQLTool({
      query: 'query { hello(name: $name) }',
      id: 'test',
      inputSchema: z.object({
        name: z.string(),
      }),
      description: 'test',
    });
    const runtimeContext = new RuntimeContext();

    // Get the mocked function and set up its return value
    const { evergreenGraphQLClient } = await import(
      '../../../../utils/graphql/evergreenGraphQLClient'
    );
    const mockExecuteQuery = vi.mocked(evergreenGraphQLClient.executeQuery);
    mockExecuteQuery.mockResolvedValue({ hello: 'world' });

    const result = await tool.execute?.(
      { context: { name: 'test' }, runtimeContext },
      { toolCallId: 'test-id', messages: [] }
    );

    expect(mockExecuteQuery).toHaveBeenCalledWith(
      'query { hello(name: $name) }',
      { name: 'test' },
      { userID: undefined }
    );
    expect(result).toEqual({ hello: 'world' });
  });
  it('should pass the userID to the graphql client', async () => {
    const tool = createGraphQLTool({
      query: 'query { hello(name: $name) }',
      id: 'test',
      inputSchema: z.object({}),
      description: 'test',
    });
    const runtimeContext = new RuntimeContext();
    runtimeContext.set('userID', 'test-user-id');
    const { evergreenGraphQLClient } = await import(
      '../../../../utils/graphql/evergreenGraphQLClient'
    );
    const mockExecuteQuery = vi.mocked(evergreenGraphQLClient.executeQuery);
    mockExecuteQuery.mockResolvedValue({ hello: 'world' });
    const result = await tool.execute?.(
      { context: { name: 'test' }, runtimeContext },
      { toolCallId: 'test-id', messages: [] }
    );
    expect(result).toEqual({ hello: 'world' });
    expect(mockExecuteQuery).toHaveBeenCalledWith(
      'query { hello(name: $name) }',
      { name: 'test' },
      { userID: 'test-user-id' }
    );
  });
});
