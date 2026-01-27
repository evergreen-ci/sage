import {
  buildPromptFromTicketData,
  getAgentStatus,
  launchCursorAgent,
  normalizeRepositoryUrl,
} from './cursorAgentService';

const { mockGetAgent, mockGetDecryptedApiKey, mockLaunchAgent } = vi.hoisted(
  () => ({
    mockGetAgent: vi.fn(),
    mockGetDecryptedApiKey: vi.fn(),
    mockLaunchAgent: vi.fn(),
  })
);

vi.mock('@/db/repositories/userCredentialsRepository', () => ({
  getDecryptedApiKey: mockGetDecryptedApiKey,
}));

vi.mock('./cursorApiClient', () => ({
  createCursorApiClient: vi.fn(() => ({
    getAgent: mockGetAgent,
    launchAgent: mockLaunchAgent,
  })),
  CursorApiClientError: class extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

describe('cursorAgentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildPromptFromTicketData', () => {
    it('builds prompt with summary and description', () => {
      const input = {
        ticketKey: 'PROJ-123',
        summary: 'Add user authentication',
        description: 'Implement OAuth2 login flow',
        targetRepository: 'mongodb/test-repo',
        targetRef: 'main',
        assigneeEmail: 'user@example.com',
        autoCreatePr: false,
      };

      const prompt = buildPromptFromTicketData(input);

      // System context
      expect(prompt).toContain('You are "sage-bot"');
      expect(prompt).toContain('autonomous engineering agent');

      // Workflow guidance
      expect(prompt).toContain('## Your Workflow');
      expect(prompt).toContain('**Understand**');
      expect(prompt).toContain('**Test**');

      // Quality standards
      expect(prompt).toContain('## Quality Standards');
      expect(prompt).toContain('Follow existing code patterns');

      // Ticket content
      expect(prompt).toContain('## Jira Ticket: PROJ-123');
      expect(prompt).toContain('### Summary');
      expect(prompt).toContain('Add user authentication');
      expect(prompt).toContain('### Description');
      expect(prompt).toContain('Implement OAuth2 login flow');

      // Instructions
      expect(prompt).toContain('## Instructions');
      expect(prompt).toContain(
        'Implement the changes described in ticket PROJ-123'
      );
    });
  });

  describe('normalizeRepositoryUrl', () => {
    it('returns full URL as-is', () => {
      const url = 'https://github.com/mongodb/mongo-tools';
      expect(normalizeRepositoryUrl(url)).toBe(url);
    });

    it('converts org/repo format to full URL', () => {
      expect(normalizeRepositoryUrl('mongodb/mongo-tools')).toBe(
        'https://github.com/mongodb/mongo-tools'
      );
    });

    it('handles repo names with dots and underscores', () => {
      expect(normalizeRepositoryUrl('my_org/my.repo-name')).toBe(
        'https://github.com/my_org/my.repo-name'
      );
    });
  });

  describe('launchCursorAgent', () => {
    it('launches agent successfully', async () => {
      mockGetDecryptedApiKey.mockResolvedValueOnce('decrypted-api-key');
      mockLaunchAgent.mockResolvedValueOnce({
        id: 'bc_abc123',
        name: 'Test Agent',
        status: 'CREATING',
        source: {
          repository: 'https://github.com/mongodb/test-repo',
          ref: 'main',
        },
        target: {
          url: 'https://cursor.com/agents?id=bc_abc123',
          branchName: 'cursor/proj-123',
        },
        createdAt: '2024-01-15T10:30:00Z',
      });

      const result = await launchCursorAgent({
        ticketKey: 'PROJ-123',
        summary: 'Add feature',
        description: 'Description here',
        targetRepository: 'mongodb/test-repo',
        targetRef: 'main',
        assigneeEmail: 'user@example.com',
        autoCreatePr: false,
      });

      expect(result.success).toBe(true);
      expect(result.agentId).toBe('bc_abc123');
      expect(result.agentUrl).toBe('https://cursor.com/agents?id=bc_abc123');

      expect(mockGetDecryptedApiKey).toHaveBeenCalledWith('user@example.com');
      expect(mockLaunchAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.objectContaining({
            text: expect.stringContaining('PROJ-123'),
          }),
          source: expect.objectContaining({
            repository: 'https://github.com/mongodb/test-repo',
            ref: 'main',
          }),
          target: expect.objectContaining({
            autoCreatePr: false,
          }),
        })
      );
    });

    it('returns error when no API key found', async () => {
      mockGetDecryptedApiKey.mockResolvedValueOnce(null);

      const result = await launchCursorAgent({
        ticketKey: 'PROJ-123',
        summary: 'Add feature',
        description: null,
        targetRepository: 'mongodb/test-repo',
        targetRef: 'main',
        assigneeEmail: 'unknown@example.com',
        autoCreatePr: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No Cursor API key found');
      expect(mockLaunchAgent).not.toHaveBeenCalled();
    });

    it('returns error when no target ref provided', async () => {
      const result = await launchCursorAgent({
        ticketKey: 'PROJ-123',
        summary: 'Add feature',
        description: null,
        targetRepository: 'mongodb/test-repo',
        targetRef: '', // Empty target ref
        assigneeEmail: 'user@example.com',
        autoCreatePr: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No target ref provided');
      expect(mockGetDecryptedApiKey).not.toHaveBeenCalled();
      expect(mockLaunchAgent).not.toHaveBeenCalled();
    });

    it('returns error when Cursor API fails', async () => {
      mockGetDecryptedApiKey.mockResolvedValueOnce('decrypted-api-key');
      mockLaunchAgent.mockRejectedValueOnce(new Error('API rate limited'));

      const result = await launchCursorAgent({
        ticketKey: 'PROJ-123',
        summary: 'Add feature',
        description: null,
        targetRepository: 'mongodb/test-repo',
        targetRef: 'main',
        assigneeEmail: 'user@example.com',
        autoCreatePr: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('API rate limited');
    });

    it('normalizes repository URL before launching', async () => {
      mockGetDecryptedApiKey.mockResolvedValueOnce('decrypted-api-key');
      mockLaunchAgent.mockResolvedValueOnce({
        id: 'bc_xyz789',
        name: 'Test Agent',
        status: 'CREATING',
        source: {
          repository: 'https://github.com/org/repo',
          ref: 'main',
        },
        target: {
          url: 'https://cursor.com/agents?id=bc_xyz789',
        },
        createdAt: '2024-01-15T10:30:00Z',
      });

      await launchCursorAgent({
        ticketKey: 'PROJ-789',
        summary: 'Test',
        description: null,
        targetRepository: 'org/repo', // org/repo format
        targetRef: 'develop',
        assigneeEmail: 'user@example.com',
        autoCreatePr: true,
      });

      expect(mockLaunchAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          source: expect.objectContaining({
            repository: 'https://github.com/org/repo', // Should be normalized
          }),
        })
      );
    });
  });

  describe('getAgentStatus', () => {
    it('returns agent status successfully', async () => {
      mockGetDecryptedApiKey.mockResolvedValueOnce('decrypted-api-key');
      mockGetAgent.mockResolvedValueOnce({
        id: 'bc_abc123',
        status: 'FINISHED',
        target: {
          url: 'https://cursor.com/agents?id=bc_abc123',
          prUrl: 'https://github.com/org/repo/pull/123',
        },
        summary: 'Implemented the feature',
      });

      const result = await getAgentStatus({
        agentId: 'bc_abc123',
        assigneeEmail: 'user@example.com',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('FINISHED');
      expect(result.prUrl).toBe('https://github.com/org/repo/pull/123');
      expect(result.summary).toBe('Implemented the feature');
      expect(mockGetDecryptedApiKey).toHaveBeenCalledWith('user@example.com');
      expect(mockGetAgent).toHaveBeenCalledWith('bc_abc123');
    });

    it('returns error when no API key found', async () => {
      mockGetDecryptedApiKey.mockResolvedValueOnce(null);

      const result = await getAgentStatus({
        agentId: 'bc_abc123',
        assigneeEmail: 'unknown@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No Cursor API key found');
      expect(mockGetAgent).not.toHaveBeenCalled();
    });

    it('returns error when Cursor API fails', async () => {
      mockGetDecryptedApiKey.mockResolvedValueOnce('decrypted-api-key');
      mockGetAgent.mockRejectedValueOnce(new Error('Agent not found'));

      const result = await getAgentStatus({
        agentId: 'bc_invalid',
        assigneeEmail: 'user@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Agent not found');
    });
  });
});
