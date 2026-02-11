import { CursorApiClient } from './cursorApiClient';

// Hoist mock functions so they're available when vi.mock is hoisted
const { mockCreateAgent, mockCreateConfig, mockGetAgent } = vi.hoisted(() => ({
  mockCreateAgent: vi.fn(),
  mockCreateConfig: vi.fn((config: unknown) => config),
  mockGetAgent: vi.fn(),
}));

vi.mock('@/generated/cursor-api', () => ({
  Sdk: vi.fn().mockImplementation(() => ({
    createAgent: mockCreateAgent,
    getAgent: mockGetAgent,
  })),
}));

vi.mock('@/generated/cursor-api/client', () => ({
  createClient: vi.fn(() => ({})),
  createConfig: mockCreateConfig,
}));

describe('CursorApiClient', () => {
  let client: CursorApiClient;
  const testApiKey = 'test-api-key-12345';

  beforeEach(() => {
    vi.clearAllMocks();
    client = new CursorApiClient(testApiKey);
  });

  describe('constructor', () => {
    it('configures SDK with correct base URL', () => {
      new CursorApiClient(testApiKey);

      expect(mockCreateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: 'https://api.cursor.com',
        })
      );
    });

    it('configures SDK with bearer token authorization header', () => {
      new CursorApiClient(testApiKey);

      expect(mockCreateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            Authorization: `Bearer ${testApiKey}`,
          },
        })
      );
    });
  });

  describe('launchAgent', () => {
    it('throws CursorApiClientError with status code, message, and error code on API failure', async () => {
      // Actual API format: { error: string, code?: string }
      mockCreateAgent.mockResolvedValueOnce({
        data: null,
        error: {
          error: 'Insufficient permissions',
          code: 'FORBIDDEN',
        },
        response: { status: 403 },
      });

      await expect(
        client.launchAgent({
          prompt: { text: 'Test' },
          source: { repository: 'https://github.com/org/repo' },
        })
      ).rejects.toMatchObject({
        name: 'CursorApiClientError',
        message: 'Insufficient permissions',
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });

    it('falls back to error.message when error.error is not present (backwards compatibility)', async () => {
      // Spec format: { error: { message?: string, code?: string } }
      mockCreateAgent.mockResolvedValueOnce({
        data: null,
        error: {
          error: { message: 'Legacy error format', code: 'LEGACY' },
        },
        response: { status: 400 },
      });

      await expect(
        client.launchAgent({
          prompt: { text: 'Test' },
          source: { repository: 'https://github.com/org/repo' },
        })
      ).rejects.toMatchObject({
        name: 'CursorApiClientError',
        message: 'Legacy error format',
        statusCode: 400,
        code: 'LEGACY',
      });
    });

    it('uses fallback message when API error has no message', async () => {
      mockCreateAgent.mockResolvedValueOnce({
        data: null,
        error: {},
        response: { status: 500 },
      });

      await expect(
        client.launchAgent({
          prompt: { text: 'Test' },
          source: { repository: 'https://github.com/org/repo' },
        })
      ).rejects.toMatchObject({
        name: 'CursorApiClientError',
        message: 'Unknown Cursor API error',
        statusCode: 500,
      });
    });

    it('calls SDK createAgent with request body and throwOnError disabled', async () => {
      const mockResponse = {
        id: 'bc_abc123',
        status: 'CREATING' as const,
        source: { repository: 'https://github.com/test-org/test-repo' },
        createdAt: '2024-01-15T10:30:00Z',
      };

      mockCreateAgent.mockResolvedValueOnce({
        data: mockResponse,
        error: null,
        response: { status: 201 },
      });

      const request = {
        prompt: { text: 'Test prompt' },
        source: {
          repository: 'https://github.com/test-org/test-repo',
          ref: 'main',
        },
        target: { autoCreatePr: false },
      };

      await client.launchAgent(request);

      expect(mockCreateAgent).toHaveBeenCalledWith({
        body: request,
        throwOnError: false,
      });
    });
  });

  describe('getAgent', () => {
    it('returns agent data on success', async () => {
      const mockResponse = {
        id: 'bc_abc123',
        status: 'FINISHED' as const,
        target: { prUrl: 'https://github.com/org/repo/pull/123' },
        summary: 'Completed work',
      };

      mockGetAgent.mockResolvedValueOnce({
        data: mockResponse,
        error: null,
        response: { status: 200 },
      });

      const result = await client.getAgent('bc_abc123');

      expect(result).toEqual(mockResponse);
      expect(mockGetAgent).toHaveBeenCalledWith({
        path: { id: 'bc_abc123' },
        throwOnError: false,
      });
    });

    it('throws CursorApiClientError on API failure', async () => {
      // Actual API format: { error: string, code?: string }
      mockGetAgent.mockResolvedValueOnce({
        data: null,
        error: {
          error: 'Agent not found',
          code: 'NOT_FOUND',
        },
        response: { status: 404 },
      });

      await expect(client.getAgent('bc_invalid')).rejects.toMatchObject({
        name: 'CursorApiClientError',
        message: 'Agent not found',
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });
  });
});
