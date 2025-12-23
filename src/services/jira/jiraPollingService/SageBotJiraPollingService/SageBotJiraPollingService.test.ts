import { ObjectId } from 'mongodb';
import { JobRunStatus } from '@/db/types';
import { SageBotJiraPollingService } from '.';

// Use vi.hoisted for mock functions that need setup/verification in tests
const {
  mockAddComment,
  mockConnect,
  mockCreateJobRun,
  mockCredentialsExist,
  mockDisconnect,
  mockFindJobRunByTicketKey,
  mockFindLabelAddedBy,
  mockRemoveLabel,
  mockSearchIssues,
  mockUpdateJobRunStatus,
} = vi.hoisted(() => ({
  mockSearchIssues: vi.fn(),
  mockRemoveLabel: vi.fn(),
  mockFindLabelAddedBy: vi.fn(),
  mockCreateJobRun: vi.fn(),
  mockFindJobRunByTicketKey: vi.fn(),
  mockCredentialsExist: vi.fn(),
  mockAddComment: vi.fn(),
  mockUpdateJobRunStatus: vi.fn(),
  mockConnect: vi.fn(),
  mockDisconnect: vi.fn(),
}));

vi.mock('@/services/jira/jiraClient', () => ({
  jiraClient: {
    searchIssues: mockSearchIssues,
    removeLabel: mockRemoveLabel,
    addComment: mockAddComment,
    findLabelAddedBy: mockFindLabelAddedBy,
  },
  JiraClient: vi.fn(),
}));

vi.mock('@/db/repositories/jobRunsRepository', () => ({
  createJobRun: mockCreateJobRun,
  findJobRunByTicketKey: mockFindJobRunByTicketKey,
  updateJobRunStatus: mockUpdateJobRunStatus,
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

describe('SageBotJiraPollingService', () => {
  let service: SageBotJiraPollingService;

  beforeEach(() => {
    vi.clearAllMocks();
    const mockJiraClient = {
      searchIssues: mockSearchIssues,
      removeLabel: mockRemoveLabel,
      addComment: mockAddComment,
      findLabelAddedBy: mockFindLabelAddedBy,
    };
    service = new SageBotJiraPollingService(mockJiraClient as any);
  });

  describe('poll()', () => {
    it('returns empty result when no tickets found', async () => {
      mockSearchIssues.mockResolvedValueOnce([]);

      const result = await service.poll();

      expect(result).toEqual({
        ticketsFound: 0,
        ticketsProcessed: 0,
        ticketsSkipped: 0,
        ticketsErrored: 0,
        results: [],
      });
      expect(mockSearchIssues).toHaveBeenCalledWith(
        'labels = "sage-bot" AND project IN ("DEVPROD", "CLOUDP", "AMP", "DOCSP")'
      );
    });

    it('processes tickets and creates job runs', async () => {
      const mockIssue = {
        key: 'DEVPROD-123',
        fields: {
          summary: 'Test issue',
          description: 'Test description',
          assignee: {
            emailAddress: 'user@example.com',
            displayName: 'Test User',
          },
          labels: ['sage-bot', 'repo:mongodb/mongo-tools'],
        },
      };

      mockSearchIssues.mockResolvedValueOnce([mockIssue]);
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

      const result = await service.poll();

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
          description: 'Test description',
          targetRepository: 'mongodb/mongo-tools',
        },
      });
    });

    it('skips tickets with active (pending/running) job runs', async () => {
      const mockIssue = {
        key: 'DEVPROD-456',
        fields: {
          summary: 'Existing issue',
          description: 'Test description',
          assignee: null,
          labels: ['sage-bot', 'repo:mongodb/test'],
        },
      };

      mockSearchIssues.mockResolvedValueOnce([mockIssue]);
      mockFindJobRunByTicketKey.mockResolvedValueOnce({
        _id: new ObjectId(),
        jiraTicketKey: 'DEVPROD-456',
        status: JobRunStatus.Pending,
      });

      const result = await service.poll();

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
          description: 'Test description',
          assignee: {
            emailAddress: 'user@example.com',
            displayName: 'Test User',
          },
          labels: ['sage-bot', 'repo:mongodb/test'],
        },
      };

      mockSearchIssues.mockResolvedValueOnce([mockIssue]);
      // Existing job is in Failed status - should allow retry
      mockFindJobRunByTicketKey.mockResolvedValueOnce({
        _id: new ObjectId(),
        jiraTicketKey: 'DEVPROD-456',
        status: JobRunStatus.Failed,
      });
      mockFindLabelAddedBy.mockResolvedValueOnce('user@example.com');
      mockRemoveLabel.mockResolvedValueOnce(undefined);
      mockCredentialsExist.mockResolvedValueOnce(true);
      mockCreateJobRun.mockResolvedValueOnce({
        _id: new ObjectId(),
        jiraTicketKey: 'DEVPROD-456',
        status: JobRunStatus.Pending,
      });

      const result = await service.poll();

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
      mockFindJobRunByTicketKey.mockResolvedValueOnce(null);
      mockFindLabelAddedBy.mockResolvedValueOnce(null);
      mockRemoveLabel.mockResolvedValueOnce(undefined);
      const mockJobId = new ObjectId();
      mockCreateJobRun.mockResolvedValueOnce({
        _id: mockJobId,
        jiraTicketKey: 'DEVPROD-789',
        status: JobRunStatus.Pending,
      });
      mockUpdateJobRunStatus.mockResolvedValueOnce(undefined);
      mockAddComment.mockResolvedValueOnce(undefined);

      const result = await service.poll();

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
          description: 'Test description',
          assignee: {
            emailAddress: 'user@example.com',
            displayName: 'Test User',
          },
          labels: ['sage-bot', 'repo:mongodb/test'],
        },
      };

      mockSearchIssues.mockResolvedValueOnce([mockIssue1, mockIssue2]);
      mockFindJobRunByTicketKey
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockFindLabelAddedBy
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce('user@example.com');
      mockRemoveLabel.mockResolvedValueOnce(undefined);
      mockCredentialsExist.mockResolvedValueOnce(true);
      mockCreateJobRun.mockResolvedValueOnce({
        _id: new ObjectId(),
        jiraTicketKey: 'DEVPROD-002',
        status: JobRunStatus.Pending,
      });

      const result = await service.poll();

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

      await expect(service.poll()).rejects.toThrow('Connection failed');
    });

    it('fails validation and posts comment when assignee has no credentials', async () => {
      const mockIssue = {
        key: 'DEVPROD-999',
        fields: {
          summary: 'No credentials test',
          description: 'Test description',
          assignee: {
            emailAddress: 'nocreds@example.com',
            displayName: 'No Creds User',
          },
          labels: ['sage-bot', 'repo:mongodb/test'],
        },
      };

      mockSearchIssues.mockResolvedValueOnce([mockIssue]);
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
      mockUpdateJobRunStatus.mockResolvedValueOnce(undefined);
      mockAddComment.mockResolvedValueOnce(undefined);

      const result = await service.poll();

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
      expect(mockUpdateJobRunStatus).toHaveBeenCalledWith(
        mockJobId,
        JobRunStatus.Failed,
        expect.stringContaining('does not have credentials configured')
      );

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
  });

  describe('runAsJob()', () => {
    it('connects to database, runs polling, and disconnects', async () => {
      mockConnect.mockResolvedValueOnce(undefined);
      mockSearchIssues.mockResolvedValueOnce([]);
      mockDisconnect.mockResolvedValueOnce(undefined);

      await service.runAsJob();

      expect(mockConnect).toHaveBeenCalled();
      expect(mockSearchIssues).toHaveBeenCalled();
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('disconnects even when polling fails', async () => {
      mockConnect.mockResolvedValueOnce(undefined);
      mockSearchIssues.mockRejectedValueOnce(new Error('Polling error'));
      mockDisconnect.mockResolvedValueOnce(undefined);

      await expect(service.runAsJob()).rejects.toThrow('Polling error');

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
      mockFindJobRunByTicketKey.mockResolvedValueOnce(null);
      // Cause a system error during processing
      mockFindLabelAddedBy.mockRejectedValueOnce(new Error('System failure'));
      mockDisconnect.mockResolvedValueOnce(undefined);

      // Save original exitCode
      const originalExitCode = process.exitCode;

      await service.runAsJob();

      expect(process.exitCode).toBe(1);
      expect(mockDisconnect).toHaveBeenCalled();

      // Restore original exitCode
      process.exitCode = originalExitCode;
    });
  });
});
