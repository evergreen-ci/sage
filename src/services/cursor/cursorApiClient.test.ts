import { CursorApiClient, CursorApiClientError } from './cursorApiClient';

// Mock the SDK's createAgent method
const mockCreateAgent = vi.fn();

vi.mock('./generated/client', () => ({
  createClient: vi.fn(() => ({})),
  createConfig: vi.fn((config: unknown) => config),
}));

vi.mock('./generated', () => ({
  Sdk: vi.fn().mockImplementation(() => ({
    createAgent: mockCreateAgent,
  })),
}));

describe('CursorApiClient', () => {
  let client: CursorApiClient;
  const testApiKey = 'test-api-key-12345';

  beforeEach(() => {
    vi.clearAllMocks();
    client = new CursorApiClient(testApiKey);
  });

  describe('constructor', () => {
    it('creates client instance', () => {
      const defaultClient = new CursorApiClient(testApiKey);
      expect(defaultClient).toBeDefined();
    });
  });

  describe('launchAgent', () => {
    it('returns agent response on success', async () => {
      const mockResponse = {
        id: 'bc_abc123',
        name: 'Test Agent',
        status: 'CREATING' as const,
        source: {
          repository: 'https://github.com/test-org/test-repo',
          ref: 'main',
        },
        target: {
          branchName: 'cursor/test-1234',
          url: 'https://cursor.com/agents?id=bc_abc123',
          autoCreatePr: false,
          openAsCursorGithubApp: false,
          skipReviewerRequest: false,
        },
        createdAt: '2024-01-15T10:30:00Z',
      };

      mockCreateAgent.mockResolvedValueOnce({
        data: mockResponse,
        error: null,
        response: { status: 201 },
      });

      const result = await client.launchAgent({
        prompt: { text: 'Test prompt' },
        source: {
          repository: 'https://github.com/test-org/test-repo',
          ref: 'main',
        },
        target: {
          autoCreatePr: false,
        },
      });

      expect(result.id).toBe('bc_abc123');
      expect(result.status).toBe('CREATING');
      expect(result.target?.url).toBe('https://cursor.com/agents?id=bc_abc123');
    });

    it('throws CursorApiClientError on API failure', async () => {
      mockCreateAgent.mockResolvedValueOnce({
        data: null,
        error: { error: { message: 'Invalid API key', code: 'UNAUTHORIZED' } },
        response: { status: 401 },
      });

      await expect(
        client.launchAgent({
          prompt: { text: 'Test' },
          source: { repository: 'https://github.com/org/repo' },
        })
      ).rejects.toThrow(CursorApiClientError);
    });

    it('includes status code in error', async () => {
      mockCreateAgent.mockResolvedValueOnce({
        data: null,
        error: {
          error: { message: 'Insufficient permissions', code: 'FORBIDDEN' },
        },
        response: { status: 403 },
      });

      try {
        await client.launchAgent({
          prompt: { text: 'Test' },
          source: { repository: 'https://github.com/org/repo' },
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CursorApiClientError);
        expect((error as CursorApiClientError).statusCode).toBe(403);
        expect((error as CursorApiClientError).message).toBe(
          'Insufficient permissions'
        );
        expect((error as CursorApiClientError).code).toBe('FORBIDDEN');
      }
    });

    it('handles error response without message', async () => {
      mockCreateAgent.mockResolvedValueOnce({
        data: null,
        error: {},
        response: { status: 500 },
      });

      try {
        await client.launchAgent({
          prompt: { text: 'Test' },
          source: { repository: 'https://github.com/org/repo' },
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CursorApiClientError);
        expect((error as CursorApiClientError).statusCode).toBe(500);
        expect((error as CursorApiClientError).message).toBe(
          'Unknown Cursor API error'
        );
      }
    });
  });
});
