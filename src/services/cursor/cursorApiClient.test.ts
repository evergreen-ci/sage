import { CursorApiClient, CursorApiClientError } from './cursorApiClient';
import { CursorAgentStatus } from './schemas';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('CursorApiClient', () => {
  let client: CursorApiClient;
  const testApiKey = 'test-api-key-12345';

  beforeEach(() => {
    vi.clearAllMocks();
    client = new CursorApiClient(testApiKey);
  });

  describe('constructor', () => {
    it('uses default base URL', () => {
      const defaultClient = new CursorApiClient(testApiKey);
      expect(defaultClient).toBeDefined();
    });

    it('accepts custom base URL', () => {
      const customClient = new CursorApiClient(
        testApiKey,
        'https://custom.api.com'
      );
      expect(customClient).toBeDefined();
    });
  });

  describe('launchAgent', () => {
    it('sends correct request to launch an agent', async () => {
      const mockResponse = {
        id: 'bc_abc123',
        name: 'Test Agent',
        status: CursorAgentStatus.Creating,
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

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
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

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.cursor.com/v0/agents',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
            'Content-Type': 'application/json',
          }),
          body: expect.any(String),
        })
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.prompt.text).toBe('Test prompt');
      expect(callBody.source.repository).toBe(
        'https://github.com/test-org/test-repo'
      );

      expect(result.id).toBe('bc_abc123');
      expect(result.status).toBe(CursorAgentStatus.Creating);
      expect(result.target?.url).toBe('https://cursor.com/agents?id=bc_abc123');
    });

    it('uses Basic auth with API key and empty password', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'bc_123',
            status: CursorAgentStatus.Creating,
            source: { repository: 'https://github.com/org/repo' },
            createdAt: '2024-01-15T10:30:00Z',
          }),
      });

      await client.launchAgent({
        prompt: { text: 'Test' },
        source: { repository: 'https://github.com/org/repo' },
      });

      const authHeader = mockFetch.mock.calls[0][1].headers.Authorization;
      const expectedAuth = Buffer.from(`${testApiKey}:`).toString('base64');
      expect(authHeader).toBe(`Basic ${expectedAuth}`);
    });

    it('throws CursorApiClientError on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve('{"error": "Invalid API key"}'),
      });

      await expect(
        client.launchAgent({
          prompt: { text: 'Test' },
          source: { repository: 'https://github.com/org/repo' },
        })
      ).rejects.toThrow(CursorApiClientError);
    });

    it('includes status code in error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: () => Promise.resolve('{"error": "Insufficient permissions"}'),
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
      }
    });
  });
});
