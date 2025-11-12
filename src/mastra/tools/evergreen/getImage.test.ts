import { RuntimeContext } from '@mastra/core/runtime-context';
import { USER_ID } from '@/mastra/agents/constants';
import { GraphQLClientError } from '@/utils/graphql/client';
import logger from '@/utils/logger';
import getImageTool from './getImage';
import evergreenClient from './graphql/evergreenClient';

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

describe('getImageTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(evergreenClient.executeQuery).mockReset();
  });

  it('executes query successfully with valid imageId', async () => {
    const mockImageData = {
      image: {
        id: 'image-123',
        ami: 'ami-abc123',
        lastDeployed: new Date('2024-01-15T10:00:00Z'),
        distros: [{ name: 'ubuntu2204-small', arch: 'linux_amd64' }],
        events: {
          count: 2,
          eventLogEntries: [
            {
              timestamp: new Date('2024-01-15T10:00:00Z'),
              amiAfter: 'ami-abc123',
              amiBefore: 'ami-xyz789',
              entries: [
                {
                  type: 'PACKAGE',
                  action: 'UPDATED',
                  name: 'nodejs',
                  before: '18.0.0',
                  after: '20.0.0',
                },
              ],
            },
          ],
        },
        packages: {
          data: [
            { name: 'nodejs', manager: 'apt', version: '20.0.0' },
            { name: 'python', manager: 'apt', version: '3.10.0' },
          ],
          filteredCount: 2,
          totalCount: 2,
        },
        toolchains: {
          data: [{ name: 'gcc', path: '/usr/bin/gcc', version: '11.2.0' }],
          filteredCount: 1,
          totalCount: 1,
        },
        operatingSystem: {
          data: [{ name: 'Ubuntu', version: '22.04' }],
          filteredCount: 1,
          totalCount: 1,
        },
      },
    };

    vi.mocked(evergreenClient.executeQuery).mockResolvedValueOnce(
      mockImageData
    );

    const result = await getImageTool.execute?.({
      context: { imageId: 'image-123' },
      runtimeContext: makeRuntimeContext('user-123'),
      tracingContext,
    });

    expect(result).toEqual(mockImageData);
    expect(evergreenClient.executeQuery).toHaveBeenCalledWith(
      expect.anything(),
      { imageId: 'image-123' },
      expect.objectContaining({
        userID: 'user-123',
      })
    );
  });

  it('throws error when userID is missing', async () => {
    await expect(
      getImageTool.execute?.({
        context: { imageId: 'image-123' },
        runtimeContext: makeRuntimeContext(undefined),
        tracingContext,
      })
    ).rejects.toThrow(
      'User ID not available in RuntimeContext unable to execute query'
    );
  });

  it('throws GraphQLClientError on GraphQL errors', async () => {
    const graphQLError = new GraphQLClientError('GraphQL error', {
      statusCode: 400,
      errors: [{ message: 'Image not found' }],
    });

    vi.mocked(evergreenClient.executeQuery).mockRejectedValueOnce(graphQLError);

    await expect(
      getImageTool.execute?.({
        context: { imageId: 'invalid-image' },
        runtimeContext: makeRuntimeContext('user-456'),
        tracingContext,
      })
    ).rejects.toThrow(GraphQLClientError);

    expect(logger.error).toHaveBeenCalledWith(
      'GraphQLClientError during tool execution',
      expect.objectContaining({
        id: 'getImage',
        userID: 'user-456',
        statusCode: 400,
        graphqlErrors: [{ message: 'Image not found' }],
      })
    );
  });

  it('throws error on unknown exception', async () => {
    const unknownError = new Error('Network error');
    vi.mocked(evergreenClient.executeQuery).mockRejectedValueOnce(unknownError);

    await expect(
      getImageTool.execute?.({
        context: { imageId: 'image-123' },
        runtimeContext: makeRuntimeContext('user-789'),
        tracingContext,
      })
    ).rejects.toThrow('Network error');

    expect(logger.error).toHaveBeenCalledWith(
      'Unexpected error during GraphQL tool execution',
      expect.objectContaining({
        id: 'getImage',
        error: 'Network error',
        userID: 'user-789',
      })
    );
  });

  it('validates input schema correctly', () => {
    const validInput = { imageId: 'image-123' };
    const invalidInput = { imageId: 123 }; // wrong type

    expect(() => getImageTool.inputSchema.parse(validInput)).not.toThrow();
    expect(() => getImageTool.inputSchema.parse(invalidInput)).toThrow();
  });

  it('handles image with no events', async () => {
    const mockImageData = {
      image: {
        id: 'image-new',
        ami: 'ami-new123',
        lastDeployed: new Date('2024-01-20T10:00:00Z'),
        distros: [],
        events: {
          count: 0,
          eventLogEntries: [],
        },
        packages: {
          data: [],
          filteredCount: 0,
          totalCount: 0,
        },
        toolchains: {
          data: [],
          filteredCount: 0,
          totalCount: 0,
        },
        operatingSystem: {
          data: [],
          filteredCount: 0,
          totalCount: 0,
        },
      },
    };

    vi.mocked(evergreenClient.executeQuery).mockResolvedValueOnce(
      mockImageData
    );

    const result = await getImageTool.execute?.({
      context: { imageId: 'image-new' },
      runtimeContext: makeRuntimeContext('user-123'),
      tracingContext,
    });

    expect(result).toEqual(mockImageData);
    expect(result?.image?.events.eventLogEntries).toHaveLength(0);
  });
});
