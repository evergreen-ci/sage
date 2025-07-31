import { GraphQLClient, GraphQLClientError } from './client';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

const endpoint = 'https://example.com/graphql';
const client = new GraphQLClient(endpoint, 'test-user-id-header', {
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GraphQLClient', () => {
  it('successfully executes a GraphQL query', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const result = await client.executeQuery<{ greeting: string }>(sampleQuery);

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
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        errors: [{ message: 'Something went wrong' }],
      }),
    });

    await expect(client.executeQuery(sampleQuery)).rejects.toThrow(
      GraphQLClientError
    );
    await expect(client.executeQuery(sampleQuery)).rejects.toThrow(
      /GraphQL errors/
    );
  });

  it('throws on HTTP failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Server error',
    });

    await expect(() => client.executeQuery(sampleQuery)).rejects.toThrow(
      /HTTP 500/
    );
  });

  it('throws on network/parsing error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection lost'));

    await expect(() => client.executeQuery(sampleQuery)).rejects.toThrow(
      /Connection lost/
    );
  });

  it('merges custom headers with default headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    await client.executeQuery(sampleQuery, undefined, {
      headers: { Authorization: 'Bearer token' },
    });

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
