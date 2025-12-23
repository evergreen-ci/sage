import { ObjectId } from 'mongodb';
import { JobRunStatus } from '@/db/types';
// Import after mocks are set up
import {
  buildJqlQuery,
  pollJiraTickets,
  runPollingJob,
} from './jiraPollingService';

// Use vi.hoisted for mock functions that need setup/verification in tests
const {
  mockAddComment,
  mockConnect,
  mockCreateJobRun,
  mockCredentialsExist,
  mockDisconnect,
  mockExtractTicketData,
  mockFindJobRunByTicketKey,
  mockFindLabelAddedBy,
  mockGetDefaultBranch,
  mockIsRepositoryConfigured,
  mockLaunchCursorAgent,
  mockRemoveLabel,
  mockSearchIssues,
  mockUpdateJobRun,
} = vi.hoisted(() => ({
  mockSearchIssues: vi.fn(),
  mockRemoveLabel: vi.fn(),
  mockExtractTicketData: vi.fn(),
  mockFindLabelAddedBy: vi.fn(),
  mockCreateJobRun: vi.fn(),
  mockFindJobRunByTicketKey: vi.fn(),
  mockCredentialsExist: vi.fn(),
  mockAddComment: vi.fn(),
  mockUpdateJobRun: vi.fn(),
  mockConnect: vi.fn(),
  mockDisconnect: vi.fn(),
  mockLaunchCursorAgent: vi.fn(),
  mockIsRepositoryConfigured: vi.fn(),
  mockGetDefaultBranch: vi.fn(),
}));

vi.mock('./jiraClient', () => ({
  jiraClient: {
    searchIssues: mockSearchIssues,
    removeLabel: mockRemoveLabel,
    extractTicketData: mockExtractTicketData,
    addComment: mockAddComment,
    findLabelAddedBy: mockFindLabelAddedBy,
  },
}));

vi.mock('@/db/repositories/jobRunsRepository', () => ({
  createJobRun: mockCreateJobRun,
  findJobRunByTicketKey: mockFindJobRunByTicketKey,
  updateJobRun: mockUpdateJobRun,
}));

vi.mock('@/services/cursor', () => ({
  launchCursorAgent: mockLaunchCursorAgent,
}));

vi.mock('@/services/repositories', () => ({
  isRepositoryConfigured: mockIsRepositoryConfigured,
  getDefaultBranch: mockGetDefaultBranch,
}));

vi.mock('@/db/repositories/userCredentialsRepository', () => ({
  credentialsExist: mockCredentialsExist,
}));

vi.mock('@/db/connection', () => ({
  db: {
    connect: mockConnect,
    disconnect: mockDisconnect,
  },
}));

describe('jiraPollingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildJqlQuery', () => {
    it('builds correct JQL with single project', () => {
      const jql = buildJqlQuery(['PROJ']);
      expect(jql).toBe('labels = "sage-bot" AND project IN ("PROJ")');
    });

    it('builds correct JQL with multiple projects', () => {
      const jql = buildJqlQuery(['PROJ1', 'PROJ2', 'PROJ3']);
      expect(jql).toBe(
        'labels = "sage-bot" AND project IN ("PROJ1", "PROJ2", "PROJ3")'
      );
    });
  });

  describe('pollJiraTickets', () => {
    it('returns empty result when no tickets found', async () => {
      mockSearchIssues.mockResolvedValueOnce([]);

      const result = await pollJiraTickets();

      expect(result).toEqual({
        ticketsFound: 0,
        ticketsProcessed: 0,
        ticketsSkipped: 0,
        ticketsErrored: 0,
        results: [],
      });
      expect(mockSearchIssues).toHaveBeenCalledWith(
        'labels = "sage-bot" AND project IN ("DEVPROD", "TEST")'
      );
    });

    it('processes tickets and creates job runs with inline ref', async () => {
      const mockIssue = {
        key: 'DEVPROD-123',
        fields: {
          summary: 'Test issue',
          description: 'repo:mongodb/mongo-tools@develop',
          assignee: { emailAddress: 'user@example.com' },
          labels: ['sage-bot'],
        },
      };

      mockSearchIssues.mockResolvedValueOnce([mockIssue]);
      mockExtractTicketData.mockReturnValueOnce({
        ticketKey: 'DEVPROD-123',
        summary: 'Test issue',
        description: 'repo:mongodb/mongo-tools@develop',
        assigneeEmail: 'user@example.com',
        targetRepository: 'mongodb/mongo-tools',
        targetRef: 'develop', // Inline ref from label
      });
      mockFindJobRunByTicketKey.mockResolvedValueOnce(null);
      mockFindLabelAddedBy.mockResolvedValueOnce('user@example.com');
      mockRemoveLabel.mockResolvedValueOnce(undefined);
      mockCredentialsExist.mockResolvedValueOnce(true);
      const mockJobId = new ObjectId();
      mockCreateJobRun.mockResolvedValueOnce({
        _id: mockJobId,
        jiraTicketKey: 'DEVPROD-123',
        status: JobRunStatus.Pending,
      });
      mockLaunchCursorAgent.mockResolvedValueOnce({
        success: true,
        agentId: 'bc_test123',
        agentUrl: 'https://cursor.com/agents?id=bc_test123',
      });
      mockUpdateJobRun.mockResolvedValueOnce(undefined);
      mockAddComment.mockResolvedValueOnce(undefined);

      const result = await pollJiraTickets();

      expect(result).toEqual({
        ticketsFound: 1,
        ticketsProcessed: 1,
        ticketsSkipped: 0,
        ticketsErrored: 0,
        results: [{ ticketKey: 'DEVPROD-123', success: true }],
      });
      expect(mockRemoveLabel).toHaveBeenCalledWith('DEVPROD-123', 'sage-bot');
      expect(mockCreateJobRun).toHaveBeenCalledWith({
        jiraTicketKey: 'DEVPROD-123',
        initiatedBy: 'user@example.com',
        assignee: 'user@example.com',
        metadata: {
          summary: 'Test issue',
          description: 'repo:mongodb/mongo-tools@develop',
          targetRepository: 'mongodb/mongo-tools',
        },
      });
      expect(mockLaunchCursorAgent).toHaveBeenCalledWith({
        ticketKey: 'DEVPROD-123',
        summary: 'Test issue',
        description: 'repo:mongodb/mongo-tools@develop',
        targetRepository: 'mongodb/mongo-tools',
        targetRef: 'develop',
        assigneeEmail: 'user@example.com',
        autoCreatePr: true,
      });
      expect(mockUpdateJobRun).toHaveBeenCalledWith(mockJobId, {
        cursorAgentId: 'bc_test123',
        status: JobRunStatus.Running,
      });
    });

    it('processes tickets using config default branch when no inline ref', async () => {
      const mockIssue = {
        key: 'DEVPROD-123',
        fields: {
          summary: 'Test issue',
          description: 'Test description',
          assignee: { emailAddress: 'user@example.com' },
          labels: ['sage-bot', 'repo:mongodb/mongo-tools'],
        },
      };

      mockSearchIssues.mockResolvedValueOnce([mockIssue]);
      mockExtractTicketData.mockReturnValueOnce({
        ticketKey: 'DEVPROD-123',
        summary: 'Test issue',
        description: 'Test description',
        assigneeEmail: 'user@example.com',
        targetRepository: 'mongodb/mongo-tools',
        targetRef: null, // No inline ref
      });
      mockFindJobRunByTicketKey.mockResolvedValueOnce(null);
      mockFindLabelAddedBy.mockResolvedValueOnce('user@example.com');
      mockRemoveLabel.mockResolvedValueOnce(undefined);
      mockIsRepositoryConfigured.mockReturnValueOnce(true);
      mockGetDefaultBranch.mockReturnValueOnce('master');
      mockCredentialsExist.mockResolvedValueOnce(true);
      const mockJobId = new ObjectId();
      mockCreateJobRun.mockResolvedValueOnce({
        _id: mockJobId,
        jiraTicketKey: 'DEVPROD-123',
        status: JobRunStatus.Pending,
      });
      mockLaunchCursorAgent.mockResolvedValueOnce({
        success: true,
        agentId: 'bc_test123',
        agentUrl: 'https://cursor.com/agents?id=bc_test123',
      });
      mockUpdateJobRun.mockResolvedValueOnce(undefined);
      mockAddComment.mockResolvedValueOnce(undefined);

      const result = await pollJiraTickets();

      expect(result).toEqual({
        ticketsFound: 1,
        ticketsProcessed: 1,
        ticketsSkipped: 0,
        ticketsErrored: 0,
        results: [{ ticketKey: 'DEVPROD-123', success: true }],
      });
      expect(mockLaunchCursorAgent).toHaveBeenCalledWith({
        ticketKey: 'DEVPROD-123',
        summary: 'Test issue',
        description: 'Test description',
        targetRepository: 'mongodb/mongo-tools',
        targetRef: 'master', // From config
        assigneeEmail: 'user@example.com',
        autoCreatePr: true,
      });
    });

    it('skips tickets with active (pending/running) job runs', async () => {
      const mockIssue = {
        key: 'DEVPROD-456',
        fields: {
          summary: 'Existing issue',
          description: 'repo:mongodb/test',
          assignee: null,
          labels: ['sage-bot'],
        },
      };

      mockSearchIssues.mockResolvedValueOnce([mockIssue]);
      mockExtractTicketData.mockReturnValueOnce({
        ticketKey: 'DEVPROD-456',
        summary: 'Existing issue',
        description: 'repo:mongodb/test',
        assigneeEmail: null,
        targetRepository: 'mongodb/test',
        targetRef: 'main',
      });
      mockFindJobRunByTicketKey.mockResolvedValueOnce({
        _id: new ObjectId(),
        jiraTicketKey: 'DEVPROD-456',
        status: JobRunStatus.Pending,
      });

      const result = await pollJiraTickets();

      expect(result).toEqual({
        ticketsFound: 1,
        ticketsProcessed: 0,
        ticketsSkipped: 1,
        ticketsErrored: 0,
        results: [
          {
            ticketKey: 'DEVPROD-456',
            success: true,
            skipped: true,
            skipReason: 'Active job run exists with status: pending',
          },
        ],
      });
      expect(mockRemoveLabel).not.toHaveBeenCalled();
      expect(mockCreateJobRun).not.toHaveBeenCalled();
    });

    it('allows retry for tickets with failed job runs', async () => {
      const mockIssue = {
        key: 'DEVPROD-456',
        fields: {
          summary: 'Failed issue retry',
          description: 'repo:mongodb/test@main',
          assignee: { emailAddress: 'user@example.com' },
          labels: ['sage-bot'],
        },
      };

      mockSearchIssues.mockResolvedValueOnce([mockIssue]);
      mockExtractTicketData.mockReturnValueOnce({
        ticketKey: 'DEVPROD-456',
        summary: 'Failed issue retry',
        description: 'repo:mongodb/test@main',
        assigneeEmail: 'user@example.com',
        targetRepository: 'mongodb/test',
        targetRef: 'main',
      });
      // Existing job is in Failed status - should allow retry
      mockFindJobRunByTicketKey.mockResolvedValueOnce({
        _id: new ObjectId(),
        jiraTicketKey: 'DEVPROD-456',
        status: JobRunStatus.Failed,
      });
      mockFindLabelAddedBy.mockResolvedValueOnce('user@example.com');
      mockRemoveLabel.mockResolvedValueOnce(undefined);
      mockCredentialsExist.mockResolvedValueOnce(true);
      const mockJobId = new ObjectId();
      mockCreateJobRun.mockResolvedValueOnce({
        _id: mockJobId,
        jiraTicketKey: 'DEVPROD-456',
        status: JobRunStatus.Pending,
      });
      mockLaunchCursorAgent.mockResolvedValueOnce({
        success: true,
        agentId: 'bc_retry456',
        agentUrl: 'https://cursor.com/agents?id=bc_retry456',
      });
      mockUpdateJobRun.mockResolvedValueOnce(undefined);
      mockAddComment.mockResolvedValueOnce(undefined);

      const result = await pollJiraTickets();

      expect(result).toEqual({
        ticketsFound: 1,
        ticketsProcessed: 1,
        ticketsSkipped: 0,
        ticketsErrored: 0,
        results: [{ ticketKey: 'DEVPROD-456', success: true }],
      });
      // Should process the ticket (remove label and create new job run)
      expect(mockRemoveLabel).toHaveBeenCalledWith('DEVPROD-456', 'sage-bot');
      expect(mockCreateJobRun).toHaveBeenCalled();
      expect(mockLaunchCursorAgent).toHaveBeenCalled();
    });

    it('uses unknown as initiator and fails validation when missing assignee and repo label', async () => {
      const mockIssue = {
        key: 'DEVPROD-789',
        fields: {
          summary: 'No label adder found',
          description: null,
          assignee: null,
          labels: ['sage-bot'],
        },
      };

      mockSearchIssues.mockResolvedValueOnce([mockIssue]);
      mockExtractTicketData.mockReturnValueOnce({
        ticketKey: 'DEVPROD-789',
        summary: 'No label adder found',
        description: null,
        assigneeEmail: null,
        targetRepository: null,
        targetRef: null,
        labels: ['sage-bot'],
      });
      mockFindJobRunByTicketKey.mockResolvedValueOnce(null);
      mockFindLabelAddedBy.mockResolvedValueOnce(null);
      mockRemoveLabel.mockResolvedValueOnce(undefined);
      const mockJobId = new ObjectId();
      mockCreateJobRun.mockResolvedValueOnce({
        _id: mockJobId,
        jiraTicketKey: 'DEVPROD-789',
        status: JobRunStatus.Pending,
      });
      mockUpdateJobRun.mockResolvedValueOnce(undefined);
      mockAddComment.mockResolvedValueOnce(undefined);

      const result = await pollJiraTickets();

      expect(mockCreateJobRun).toHaveBeenCalledWith(
        expect.objectContaining({
          initiatedBy: 'unknown',
        })
      );

      // Validation fails due to missing repo label and assignee
      expect(result.ticketsSkipped).toBe(1);
      expect(result.results[0].skipReason).toContain(
        'Missing repository label'
      );
      expect(result.results[0].skipReason).toContain('No assignee set');

      // Comment posted to Jira with validation errors
      expect(mockAddComment).toHaveBeenCalledWith(
        'DEVPROD-789',
        expect.stringContaining('Sage Bot Validation Failed')
      );
    });

    it('handles errors gracefully and continues processing', async () => {
      const mockIssue1 = {
        key: 'DEVPROD-001',
        fields: {
          summary: 'Issue 1',
          description: null,
          assignee: null,
          labels: ['sage-bot'],
        },
      };
      const mockIssue2 = {
        key: 'DEVPROD-002',
        fields: {
          summary: 'Issue 2',
          description: 'repo:mongodb/test@main',
          assignee: { emailAddress: 'user@example.com' },
          labels: ['sage-bot'],
        },
      };

      mockSearchIssues.mockResolvedValueOnce([mockIssue1, mockIssue2]);
      mockExtractTicketData
        .mockReturnValueOnce({
          ticketKey: 'DEVPROD-001',
          summary: 'Issue 1',
          description: null,
          assigneeEmail: null,
          targetRepository: null,
          targetRef: null,
        })
        .mockReturnValueOnce({
          ticketKey: 'DEVPROD-002',
          summary: 'Issue 2',
          description: 'repo:mongodb/test@main',
          assigneeEmail: 'user@example.com',
          targetRepository: 'mongodb/test',
          targetRef: 'main',
        });
      mockFindJobRunByTicketKey
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockFindLabelAddedBy
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce('user@example.com');
      mockRemoveLabel.mockResolvedValueOnce(undefined);
      mockCredentialsExist.mockResolvedValueOnce(true);
      const mockJobId = new ObjectId();
      mockCreateJobRun.mockResolvedValueOnce({
        _id: mockJobId,
        jiraTicketKey: 'DEVPROD-002',
        status: JobRunStatus.Pending,
      });
      mockLaunchCursorAgent.mockResolvedValueOnce({
        success: true,
        agentId: 'bc_002',
        agentUrl: 'https://cursor.com/agents?id=bc_002',
      });
      mockUpdateJobRun.mockResolvedValueOnce(undefined);
      mockAddComment.mockResolvedValueOnce(undefined);

      const result = await pollJiraTickets();

      expect(result).toEqual({
        ticketsFound: 2,
        ticketsProcessed: 1,
        ticketsSkipped: 0,
        ticketsErrored: 1,
        results: [
          {
            ticketKey: 'DEVPROD-001',
            success: false,
            error: 'API error',
          },
          {
            ticketKey: 'DEVPROD-002',
            success: true,
          },
        ],
      });
    });

    it('throws error when Jira API search fails', async () => {
      mockSearchIssues.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(pollJiraTickets()).rejects.toThrow('Connection failed');
    });

    it('fails validation and posts comment when assignee has no credentials', async () => {
      const mockIssue = {
        key: 'DEVPROD-999',
        fields: {
          summary: 'No credentials test',
          description: 'Test description',
          assignee: { emailAddress: 'nocreds@example.com' },
          labels: ['sage-bot', 'repo:mongodb/test@main'],
        },
      };

      mockSearchIssues.mockResolvedValueOnce([mockIssue]);
      mockExtractTicketData.mockReturnValueOnce({
        ticketKey: 'DEVPROD-999',
        summary: 'No credentials test',
        description: 'Test description',
        assigneeEmail: 'nocreds@example.com',
        targetRepository: 'mongodb/test',
        targetRef: 'main',
        labels: ['sage-bot', 'repo:mongodb/test@main'],
      });
      mockFindJobRunByTicketKey.mockResolvedValueOnce(null);
      mockFindLabelAddedBy.mockResolvedValueOnce('initiator@example.com');
      mockRemoveLabel.mockResolvedValueOnce(undefined);
      const mockJobId = new ObjectId();
      mockCreateJobRun.mockResolvedValueOnce({
        _id: mockJobId,
        jiraTicketKey: 'DEVPROD-999',
        status: JobRunStatus.Pending,
      });
      // Assignee does NOT have credentials
      mockCredentialsExist.mockResolvedValueOnce(false);
      mockUpdateJobRun.mockResolvedValueOnce(undefined);
      mockAddComment.mockResolvedValueOnce(undefined);

      const result = await pollJiraTickets();

      expect(result).toEqual({
        ticketsFound: 1,
        ticketsProcessed: 0,
        ticketsSkipped: 1,
        ticketsErrored: 0,
        results: [
          {
            ticketKey: 'DEVPROD-999',
            success: true,
            skipped: true,
            skipReason: expect.stringContaining(
              'nocreds@example.com) does not have credentials configured'
            ),
          },
        ],
      });

      // Verify job was marked as failed
      expect(mockUpdateJobRun).toHaveBeenCalledWith(mockJobId, {
        status: JobRunStatus.Failed,
        errorMessage: expect.stringContaining(
          'does not have credentials configured'
        ),
      });

      // Verify comment was posted to Jira
      expect(mockAddComment).toHaveBeenCalledWith(
        'DEVPROD-999',
        expect.stringContaining('Sage Bot Validation Failed')
      );
      expect(mockAddComment).toHaveBeenCalledWith(
        'DEVPROD-999',
        expect.stringContaining('does not have credentials configured')
      );
    });

    it('fails validation when repo is not configured and no inline ref', async () => {
      const mockIssue = {
        key: 'DEVPROD-999',
        fields: {
          summary: 'Unconfigured repo test',
          description: 'Test description',
          assignee: { emailAddress: 'user@example.com' },
          labels: ['sage-bot', 'repo:unknown/repo'],
        },
      };

      mockSearchIssues.mockResolvedValueOnce([mockIssue]);
      mockExtractTicketData.mockReturnValueOnce({
        ticketKey: 'DEVPROD-999',
        summary: 'Unconfigured repo test',
        description: 'Test description',
        assigneeEmail: 'user@example.com',
        targetRepository: 'unknown/repo',
        targetRef: null, // No inline ref
        labels: ['sage-bot', 'repo:unknown/repo'],
      });
      mockFindJobRunByTicketKey.mockResolvedValueOnce(null);
      mockFindLabelAddedBy.mockResolvedValueOnce('user@example.com');
      mockRemoveLabel.mockResolvedValueOnce(undefined);
      mockIsRepositoryConfigured.mockReturnValueOnce(false); // Repo not configured
      const mockJobId = new ObjectId();
      mockCreateJobRun.mockResolvedValueOnce({
        _id: mockJobId,
        jiraTicketKey: 'DEVPROD-999',
        status: JobRunStatus.Pending,
      });
      mockUpdateJobRun.mockResolvedValueOnce(undefined);
      mockAddComment.mockResolvedValueOnce(undefined);

      const result = await pollJiraTickets();

      expect(result.ticketsSkipped).toBe(1);
      expect(result.results[0].skipReason).toContain('is not configured');
      expect(result.results[0].skipReason).toContain('unknown/repo');

      // Verify comment was posted with helpful message
      expect(mockAddComment).toHaveBeenCalledWith(
        'DEVPROD-999',
        expect.stringContaining('is not configured')
      );
    });
  });

  describe('runPollingJob', () => {
    it('connects to database, runs polling, and disconnects', async () => {
      mockConnect.mockResolvedValueOnce(undefined);
      mockSearchIssues.mockResolvedValueOnce([]);
      mockDisconnect.mockResolvedValueOnce(undefined);

      await runPollingJob();

      expect(mockConnect).toHaveBeenCalled();
      expect(mockSearchIssues).toHaveBeenCalled();
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('disconnects even when polling fails', async () => {
      mockConnect.mockResolvedValueOnce(undefined);
      mockSearchIssues.mockRejectedValueOnce(new Error('Polling error'));
      mockDisconnect.mockResolvedValueOnce(undefined);

      await expect(runPollingJob()).rejects.toThrow('Polling error');

      expect(mockConnect).toHaveBeenCalled();
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('sets exit code to 1 when there are system errors', async () => {
      const mockIssue = {
        key: 'DEVPROD-ERR',
        fields: {
          summary: 'Error issue',
          description: null,
          assignee: null,
          labels: ['sage-bot'],
        },
      };

      mockConnect.mockResolvedValueOnce(undefined);
      mockSearchIssues.mockResolvedValueOnce([mockIssue]);
      mockExtractTicketData.mockReturnValueOnce({
        ticketKey: 'DEVPROD-ERR',
        summary: 'Error issue',
        description: null,
        assigneeEmail: null,
        targetRepository: null,
        targetRef: null,
        labels: ['sage-bot'],
      });
      mockFindJobRunByTicketKey.mockResolvedValueOnce(null);
      // Cause a system error during processing
      mockFindLabelAddedBy.mockRejectedValueOnce(new Error('System failure'));
      mockDisconnect.mockResolvedValueOnce(undefined);

      // Save original exitCode
      const originalExitCode = process.exitCode;

      await runPollingJob();

      expect(process.exitCode).toBe(1);
      expect(mockDisconnect).toHaveBeenCalled();

      // Restore original exitCode
      process.exitCode = originalExitCode;
    });
  });
});
