import {
  CursorApiClient,
  isBranchIdentificationError,
  BRANCH_ERROR_PATTERNS,
  LAUNCH_RETRY_CONFIG,
} from './cursorApiClient';

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
    vi.useFakeTimers();
    client = new CursorApiClient(testApiKey);
  });

  afterEach(() => {
    vi.useRealTimers();
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
    const defaultRequest = {
      prompt: { text: 'Test' },
      source: { repository: 'https://github.com/org/repo' },
    };

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

      await expect(client.launchAgent(defaultRequest)).rejects.toMatchObject({
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

      await expect(client.launchAgent(defaultRequest)).rejects.toMatchObject({
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

      await expect(client.launchAgent(defaultRequest)).rejects.toMatchObject({
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

    describe('retry on branch identification errors', () => {
      const branchErrorResponse = (message: string) => ({
        data: null,
        error: { error: message },
        response: { status: 400 },
      });

      const successResponse = {
        data: {
          id: 'bc_abc123',
          status: 'CREATING' as const,
          source: { repository: 'https://github.com/org/repo' },
          createdAt: '2024-01-15T10:30:00Z',
        },
        error: null,
        response: { status: 201 },
      };

      it('retries and succeeds on "Failed to determine repository default branch"', async () => {
        mockCreateAgent
          .mockResolvedValueOnce(
            branchErrorResponse('Failed to determine repository default branch')
          )
          .mockResolvedValueOnce(successResponse);

        const promise = client.launchAgent(defaultRequest);
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(mockCreateAgent).toHaveBeenCalledTimes(2);
        expect(result.id).toBe('bc_abc123');
      });

      it('retries and succeeds on "Failed to verify existence of branch"', async () => {
        mockCreateAgent
          .mockResolvedValueOnce(
            branchErrorResponse(
              "Failed to verify existence of branch 'main' in repository 10gen/ops-manager. Please ensure the branch name is correct."
            )
          )
          .mockResolvedValueOnce(successResponse);

        const promise = client.launchAgent(defaultRequest);
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(mockCreateAgent).toHaveBeenCalledTimes(2);
        expect(result.id).toBe('bc_abc123');
      });

      it('retries up to maxRetries times before throwing', async () => {
        const errorMsg = 'Failed to determine repository default branch';
        const totalAttempts = LAUNCH_RETRY_CONFIG.maxRetries + 1;
        for (let i = 0; i < totalAttempts; i++) {
          mockCreateAgent.mockResolvedValueOnce(branchErrorResponse(errorMsg));
        }

        const promise = client.launchAgent(defaultRequest);
        promise.catch(() => {});

        await vi.runAllTimersAsync();

        await expect(promise).rejects.toMatchObject({
          name: 'CursorApiClientError',
          message: errorMsg,
          statusCode: 400,
        });

        expect(mockCreateAgent).toHaveBeenCalledTimes(totalAttempts);
      });

      it('succeeds on the last retry attempt', async () => {
        const errorMsg = 'Failed to determine repository default branch';
        for (let i = 0; i < LAUNCH_RETRY_CONFIG.maxRetries; i++) {
          mockCreateAgent.mockResolvedValueOnce(branchErrorResponse(errorMsg));
        }
        mockCreateAgent.mockResolvedValueOnce(successResponse);

        const promise = client.launchAgent(defaultRequest);

        await vi.runAllTimersAsync();

        const result = await promise;

        expect(mockCreateAgent).toHaveBeenCalledTimes(
          LAUNCH_RETRY_CONFIG.maxRetries + 1
        );
        expect(result.id).toBe('bc_abc123');
      });

      it('does not retry non-branch 400 errors (AbortError)', async () => {
        mockCreateAgent.mockResolvedValueOnce(
          branchErrorResponse('Invalid request format')
        );

        await expect(client.launchAgent(defaultRequest)).rejects.toMatchObject({
          name: 'CursorApiClientError',
          message: 'Invalid request format',
          statusCode: 400,
        });

        expect(mockCreateAgent).toHaveBeenCalledTimes(1);
      });

      it('does not retry non-400 errors even with branch-like messages (AbortError)', async () => {
        mockCreateAgent.mockResolvedValueOnce({
          data: null,
          error: {
            error: 'Failed to determine repository default branch',
          },
          response: { status: 500 },
        });

        await expect(client.launchAgent(defaultRequest)).rejects.toMatchObject({
          name: 'CursorApiClientError',
          statusCode: 500,
        });

        expect(mockCreateAgent).toHaveBeenCalledTimes(1);
      });

      it('makes the correct number of attempts with p-retry backoff', async () => {
        const errorMsg = 'Failed to determine repository default branch';
        const totalAttempts = LAUNCH_RETRY_CONFIG.maxRetries + 1;
        for (let i = 0; i < totalAttempts; i++) {
          mockCreateAgent.mockResolvedValueOnce(branchErrorResponse(errorMsg));
        }

        const promise = client.launchAgent(defaultRequest);
        promise.catch(() => {});

        await vi.runAllTimersAsync();

        await expect(promise).rejects.toMatchObject({
          name: 'CursorApiClientError',
          statusCode: 400,
        });

        expect(mockCreateAgent).toHaveBeenCalledTimes(totalAttempts);
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

describe('isBranchIdentificationError', () => {
  it('returns true for "Failed to determine repository default branch" with 400 status', () => {
    expect(
      isBranchIdentificationError(
        'Failed to determine repository default branch',
        400
      )
    ).toBe(true);
  });

  it('returns true for "Failed to verify existence of branch" with 400 status', () => {
    expect(
      isBranchIdentificationError(
        "Failed to verify existence of branch 'main' in repository 10gen/ops-manager. Please ensure the branch name is correct.",
        400
      )
    ).toBe(true);
  });

  it('returns false for non-400 status codes', () => {
    expect(
      isBranchIdentificationError(
        'Failed to determine repository default branch',
        500
      )
    ).toBe(false);
  });

  it('returns false for non-branch error messages with 400 status', () => {
    expect(isBranchIdentificationError('Invalid request format', 400)).toBe(
      false
    );
  });

  it('returns false for empty message', () => {
    expect(isBranchIdentificationError('', 400)).toBe(false);
  });
});

describe('BRANCH_ERROR_PATTERNS', () => {
  it('includes the expected error patterns', () => {
    expect(BRANCH_ERROR_PATTERNS).toContain(
      'Failed to determine repository default branch'
    );
    expect(BRANCH_ERROR_PATTERNS).toContain(
      'Failed to verify existence of branch'
    );
  });
});
