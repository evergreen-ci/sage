import { RuntimeContext } from '@mastra/core/runtime-context';
import { z } from 'zod';
import { GraphQLClientError } from '../../../utils/graphql/client';
import logger from '../../../utils/logger';
import { createGraphQLTool } from './createGraphQLTool';

const mockExecuteQuery = vi.fn();

const mockClient = {
  executeQuery: mockExecuteQuery,
};

const inputSchema = z.object({
  taskId: z.string(),
});

const query = `
  query GetTask($taskId: String!) {
    task(id: $taskId) {
      id
    }
  }
`;

const context = { taskId: 'abc123' };

const makeRuntimeContext = (userID?: string) => {
  const runtimeContext = new RuntimeContext();
  runtimeContext.set('userId', userID);
  return runtimeContext;
};

vi.mock('../../../utils/logger', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('createGraphQLTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteQuery.mockReset();
  });

  it('executes query successfully with userID', async () => {
    mockExecuteQuery.mockResolvedValueOnce({ data: 'mockData' });

    const tool = createGraphQLTool({
      id: 'get-task',
      description: 'Get task by ID',
      query,
      inputSchema,
      client: mockClient as any,
    });

    const result = await tool.execute?.({
      context,
      runtimeContext: makeRuntimeContext('user-123'),
    });

    expect(result).toEqual({ data: 'mockData' });
    expect(mockExecuteQuery).toHaveBeenCalledWith(
      query,
      context,
      expect.objectContaining({
        userID: 'user-123',
      })
    );
  });

  it('throws error when userID is missing', async () => {
    const tool = createGraphQLTool({
      id: 'get-task',
      description: 'Get task by ID',
      query,
      inputSchema,
      client: mockClient as any,
    });

    await expect(
      tool.execute?.({
        context,
        runtimeContext: makeRuntimeContext(undefined),
      })
    ).rejects.toThrow(
      'User ID not available in RuntimeContext unable to execute query'
    );
  });

  it('throws GraphQLClientError on GraphQL errors', async () => {
    const graphQLError = new GraphQLClientError('GraphQL error', {
      statusCode: 400,
      errors: [{ message: 'bad' }],
    });

    mockExecuteQuery.mockRejectedValueOnce(graphQLError);

    const tool = createGraphQLTool({
      id: 'get-task',
      description: 'Get task by ID',
      query,
      inputSchema,
      client: mockClient as any,
    });

    await expect(
      tool.execute?.({
        context,
        runtimeContext: makeRuntimeContext('user-456'),
      })
    ).rejects.toThrow(GraphQLClientError);

    expect(logger.error).toHaveBeenCalledWith(
      'GraphQLClientError during tool execution',
      expect.objectContaining({
        id: 'get-task',
        userID: 'user-456',
        statusCode: 400,
        graphqlErrors: [{ message: 'bad' }],
      })
    );
  });

  it('throws error on unknown exception', async () => {
    const unknownError = new Error('Oops');
    mockExecuteQuery.mockRejectedValueOnce(unknownError);

    const tool = createGraphQLTool({
      id: 'get-task',
      description: 'Get task by ID',
      query,
      inputSchema,
      client: mockClient as any,
    });

    await expect(
      tool.execute?.({
        context,
        runtimeContext: makeRuntimeContext('user-789'),
      })
    ).rejects.toThrow('Oops');

    expect(logger.error).toHaveBeenCalledWith(
      'Unexpected error during GraphQL tool execution',
      expect.objectContaining({
        id: 'get-task',
        error: 'Oops',
        userID: 'user-789',
      })
    );
  });
});
