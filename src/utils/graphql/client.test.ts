import { GraphQLClient, GraphQLClientError } from './client';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

const endpoint = 'https://example.com/graphql';
const client = new GraphQLClient(endpoint, {
  'X-Custom-Header': 'default-value',
});

const sampleQuery = `
  query GetGreeting {
    greeting
  }
`;

const mockSuccessResponse = {
  data: { greeting: 'Hello, world!' },
};

// Helper function to create a proper mock response
const createMockResponse = (
  data: any,
  ok = true,
  status = 200,
  statusText = 'OK'
) => ({
  ok,
  status,
  statusText,
  headers: {
    get: vi.fn().mockReturnValue('application/json'),
  },
  json: async () => data,
  text: async () => JSON.stringify(data),
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GraphQLClient', () => {
  it('successfully executes a GraphQL query', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse(mockSuccessResponse));

    const result = await client.executeQuery<{ greeting: string }>(
      sampleQuery,
      {},
      {
        userID: 'test-user-id-header',
      }
    );

    expect(result).toEqual({ greeting: 'Hello, world!' });
    expect(mockFetch).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Custom-Header': 'default-value',
        }),
      })
    );
  });

  it('throws on GraphQL errors', async () => {
    mockFetch.mockResolvedValue(
      createMockResponse({
        errors: [{ message: 'Something went wrong' }],
      })
    );

    await expect(
      client.executeQuery(
        sampleQuery,
        {},
        {
          userID: 'test-user-id-header',
        }
      )
    ).rejects.toThrow(GraphQLClientError);
    await expect(
      client.executeQuery(
        sampleQuery,
        {},
        {
          userID: 'test-user-id-header',
        }
      )
    ).rejects.toThrow(/GraphQL errors/);
  });

  it('throws on HTTP failure', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse('Server error', false, 500, 'Internal Server Error')
    );

    await expect(
      client.executeQuery(
        sampleQuery,
        {},
        {
          userID: 'test-user-id-header',
        }
      )
    ).rejects.toThrow(/HTTP 500/);
  });

  it('throws on network/parsing error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection lost'));

    await expect(
      client.executeQuery(
        sampleQuery,
        {},
        {
          userID: 'test-user-id-header',
        }
      )
    ).rejects.toThrow(/Connection lost/);
  });

  it('merges custom headers with default headers', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse(mockSuccessResponse));

    await client.executeQuery(
      sampleQuery,
      {},
      {
        headers: { Authorization: 'Bearer token' },
        userID: 'test-user-id-header',
      }
    );

    expect(mockFetch).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Custom-Header': 'default-value',
          Authorization: 'Bearer token',
        }),
      })
    );
  });
});
