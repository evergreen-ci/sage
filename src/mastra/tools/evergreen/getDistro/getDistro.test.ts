import { RuntimeContext } from '@mastra/core/runtime-context';
import { USER_ID } from '@/mastra/agents/constants';
import { GraphQLClientError } from '@/utils/graphql/client';
import logger from '@/utils/logger';
import evergreenClient from '../graphql/evergreenClient';
import getDistroTool from '.';

vi.mock('../graphql/evergreenClient', () => ({
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

describe('getDistroTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(evergreenClient.executeQuery).mockReset();
  });

  it('executes query successfully with valid distroId', async () => {
    const mockDistroData = {
      distro: {
        name: 'ubuntu2204-small',
        imageId: 'image-123',
        arch: 'linux_amd64',
        provider: 'ec2',
        disabled: false,
        costData: {
          onDemandPrice: 0.12,
          spotPrice: 0.05,
        },
        userSpawnAllowed: true,
        adminOnly: false,
        warningNote: null,
        workDir: '/home/ubuntu',
        hostAllocatorSettings: {
          maximumHosts: 10,
        },
      },
    };

    vi.mocked(evergreenClient.executeQuery).mockResolvedValueOnce(
      mockDistroData
    );

    const result = await getDistroTool.execute?.({
      context: { distroId: 'ubuntu2204-small' },
      runtimeContext: makeRuntimeContext('user-123'),
      tracingContext,
    });

    expect(result).toEqual(mockDistroData);
    expect(evergreenClient.executeQuery).toHaveBeenCalledWith(
      expect.anything(),
      { distroId: 'ubuntu2204-small' },
      expect.objectContaining({
        userID: 'user-123',
      })
    );
  });

  it('handles null distro when distroId not found', async () => {
    const mockDistroData = {
      distro: null,
    };

    vi.mocked(evergreenClient.executeQuery).mockResolvedValueOnce(
      mockDistroData
    );

    const result = await getDistroTool.execute?.({
      context: { distroId: 'nonexistent-distro' },
      runtimeContext: makeRuntimeContext('user-123'),
      tracingContext,
    });

    expect(result).toEqual(mockDistroData);
    expect(result?.distro).toBeNull();
  });

  it('throws error when userID is missing', async () => {
    await expect(
      getDistroTool.execute?.({
        context: { distroId: 'ubuntu2204-small' },
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
      errors: [{ message: 'Distro not found' }],
    });

    vi.mocked(evergreenClient.executeQuery).mockRejectedValueOnce(graphQLError);

    await expect(
      getDistroTool.execute?.({
        context: { distroId: 'invalid-distro' },
        runtimeContext: makeRuntimeContext('user-456'),
        tracingContext,
      })
    ).rejects.toThrow(GraphQLClientError);

    expect(logger.error).toHaveBeenCalledWith(
      'GraphQLClientError during tool execution',
      expect.objectContaining({
        id: 'getDistro',
        userID: 'user-456',
        statusCode: 400,
        graphqlErrors: [{ message: 'Distro not found' }],
      })
    );
  });

  it('throws error on unknown exception', async () => {
    const unknownError = new Error('Network error');
    vi.mocked(evergreenClient.executeQuery).mockRejectedValueOnce(unknownError);

    await expect(
      getDistroTool.execute?.({
        context: { distroId: 'ubuntu2204-small' },
        runtimeContext: makeRuntimeContext('user-789'),
        tracingContext,
      })
    ).rejects.toThrow('Network error');

    expect(logger.error).toHaveBeenCalledWith(
      'Unexpected error during GraphQL tool execution',
      expect.objectContaining({
        id: 'getDistro',
        error: 'Network error',
        userID: 'user-789',
      })
    );
  });

  it('validates input schema correctly', () => {
    const validInput = { distroId: 'ubuntu2204-small' };
    const invalidInput = { distroId: 123 }; // wrong type

    expect(() => getDistroTool.inputSchema.parse(validInput)).not.toThrow();
    expect(() => getDistroTool.inputSchema.parse(invalidInput)).toThrow();
  });
});
