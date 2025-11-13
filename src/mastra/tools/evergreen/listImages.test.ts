import { RuntimeContext } from '@mastra/core/runtime-context';
import { USER_ID } from '@/mastra/agents/constants';
import { GraphQLClientError } from '@/utils/graphql/client';
import logger from '@/utils/logger';
import evergreenClient from './graphql/evergreenClient';
import listImagesTool from './listImages';

vi.mock('./graphql/evergreenClient', () => ({
  default: {
    executeQuery: vi.fn(),
  },
}));

vi.mock('@/utils/logger', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const makeRuntimeContext = (userID?: string) => {
  const runtimeContext = new RuntimeContext();
  runtimeContext.set(USER_ID, userID);
  return runtimeContext;
};

const tracingContext = {};

describe('listImagesTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(evergreenClient.executeQuery).mockReset();
  });

  it('executes query successfully and returns list of image IDs', async () => {
    const mockImagesData = {
      images: ['image-1', 'image-2', 'image-3', 'ubuntu2204-small-image'],
    };

    vi.mocked(evergreenClient.executeQuery).mockResolvedValueOnce(
      mockImagesData
    );

    const result = await listImagesTool.execute?.({
      context: {},
      runtimeContext: makeRuntimeContext('user-123'),
      tracingContext,
    });

    expect(result).toEqual(mockImagesData);
    expect(result?.images).toHaveLength(4);
    expect(result?.images).toContain('image-1');
    expect(evergreenClient.executeQuery).toHaveBeenCalledWith(
      expect.anything(),
      {},
      expect.objectContaining({
        userID: 'user-123',
      })
    );
  });

  it('handles empty image list', async () => {
    const mockImagesData = {
      images: [],
    };

    vi.mocked(evergreenClient.executeQuery).mockResolvedValueOnce(
      mockImagesData
    );

    const result = await listImagesTool.execute?.({
      context: {},
      runtimeContext: makeRuntimeContext('user-123'),
      tracingContext,
    });

    expect(result).toEqual(mockImagesData);
    expect(result?.images).toHaveLength(0);
  });

  it('throws error when userID is missing', async () => {
    await expect(
      listImagesTool.execute?.({
        context: {},
        runtimeContext: makeRuntimeContext(undefined),
        tracingContext,
      })
    ).rejects.toThrow(
      'User ID not available in RuntimeContext unable to execute query'
    );
  });

  it('throws GraphQLClientError on GraphQL errors', async () => {
    const graphQLError = new GraphQLClientError('GraphQL error', {
      statusCode: 500,
      errors: [{ message: 'Internal server error' }],
    });

    vi.mocked(evergreenClient.executeQuery).mockRejectedValueOnce(graphQLError);

    await expect(
      listImagesTool.execute?.({
        context: {},
        runtimeContext: makeRuntimeContext('user-456'),
        tracingContext,
      })
    ).rejects.toThrow(GraphQLClientError);

    expect(logger.error).toHaveBeenCalledWith(
      'GraphQLClientError during tool execution',
      expect.objectContaining({
        id: 'listImages',
        userID: 'user-456',
        statusCode: 500,
        graphqlErrors: [{ message: 'Internal server error' }],
      })
    );
  });

  it('throws error on unknown exception', async () => {
    const unknownError = new Error('Connection timeout');
    vi.mocked(evergreenClient.executeQuery).mockRejectedValueOnce(unknownError);

    await expect(
      listImagesTool.execute?.({
        context: {},
        runtimeContext: makeRuntimeContext('user-789'),
        tracingContext,
      })
    ).rejects.toThrow('Connection timeout');

    expect(logger.error).toHaveBeenCalledWith(
      'Unexpected error during GraphQL tool execution',
      expect.objectContaining({
        id: 'listImages',
        error: 'Connection timeout',
        userID: 'user-789',
      })
    );
  });

  it('validates input schema correctly - accepts empty object', () => {
    const validInput = {};

    expect(() => listImagesTool.inputSchema.parse(validInput)).not.toThrow();
  });

  it('validates output schema correctly', () => {
    const validOutput = {
      images: ['image-1', 'image-2'],
    };
    const invalidOutput = {
      images: 'not-an-array',
    };

    expect(() => listImagesTool.outputSchema.parse(validOutput)).not.toThrow();
    expect(() => listImagesTool.outputSchema.parse(invalidOutput)).toThrow();
  });
});
