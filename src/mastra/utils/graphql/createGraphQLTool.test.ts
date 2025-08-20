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

  it('logs a warning when userID is missing', async () => {
    mockExecuteQuery.mockResolvedValueOnce({ data: 'mockData' });

    const tool = createGraphQLTool({
      id: 'get-task',
      description: 'Get task by ID',
      query,
      inputSchema,
      client: mockClient as any,
    });

    await tool.execute?.({
      context,
      runtimeContext: makeRuntimeContext(undefined),
    });

    expect(logger.warn).toHaveBeenCalledWith(
      'User ID not available in RuntimeContext provided to GraphQL tool',
      expect.objectContaining({ id: 'get-task' })
    );
  });

  it('returns structured error on GraphQLClientError', async () => {
    const graphQLError = new GraphQLClientError(
      'GraphQL error',
      [{ message: 'bad' }],
      400
    );

    mockExecuteQuery.mockRejectedValueOnce(graphQLError);

    const tool = createGraphQLTool({
      id: 'get-task',
      description: 'Get task by ID',
      query,
      inputSchema,
      client: mockClient as any,
    });

    const result = await tool.execute?.({
      context,
      runtimeContext: makeRuntimeContext('user-456'),
    });

    expect(result).toEqual({
      error: 'GraphQL error',
      graphqlErrors: [{ message: 'bad' }],
      statusCode: 400,
    });

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

  it('returns fallback error on unknown exception', async () => {
    mockExecuteQuery.mockRejectedValueOnce(new Error('Oops'));

    const tool = createGraphQLTool({
      id: 'get-task',
      description: 'Get task by ID',
      query,
      inputSchema,
      client: mockClient as any,
    });

    const result = await tool.execute?.({
      context,
      runtimeContext: makeRuntimeContext('user-789'),
    });

    expect(result).toEqual({ error: 'Oops' });

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
