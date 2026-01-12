import { CursorApiClient } from './cursorApiClient';

// Hoist mock functions so they're available when vi.mock is hoisted
const { mockCreateAgent, mockCreateConfig } = vi.hoisted(() => ({
  mockCreateAgent: vi.fn(),
  mockCreateConfig: vi.fn((config: unknown) => config),
}));

vi.mock('@/generated/cursor-api', () => ({
  Sdk: vi.fn().mockImplementation(() => ({
    createAgent: mockCreateAgent,
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
      mockCreateAgent.mockResolvedValueOnce({
        data: null,
        error: {
          error: { message: 'Insufficient permissions', code: 'FORBIDDEN' },
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
});
