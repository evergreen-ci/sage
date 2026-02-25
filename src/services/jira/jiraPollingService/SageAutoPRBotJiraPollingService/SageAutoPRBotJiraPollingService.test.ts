import { ObjectId } from 'mongodb';
import { JobRunStatus } from '@/db/types';
import { BaseJiraPollingService } from '../BaseJiraPollingService';
import { createSageAutoPRBotJiraPollingService } from '.';

// Use vi.hoisted for mock functions that need setup/verification in tests
const {
  mockAddComment,
  mockConnect,
  mockCreateJobRun,
  mockCredentialsExist,
  mockDisconnect,
  mockFindJobRunByTicketKey,
  mockFindJobRunByTicketKeyAndRepository,
  mockFindLabelAddedBy,
  mockLaunchCursorAgent,
  mockRemoveLabel,
  mockSearchIssues,
  mockUpdateJobRun,
} = vi.hoisted(() => ({
  mockSearchIssues: vi.fn(),
  mockRemoveLabel: vi.fn(),
  mockFindLabelAddedBy: vi.fn(),
  mockCreateJobRun: vi.fn(),
  mockFindJobRunByTicketKey: vi.fn(),
  mockFindJobRunByTicketKeyAndRepository: vi.fn(),
  mockCredentialsExist: vi.fn(),
  mockAddComment: vi.fn(),
  mockUpdateJobRun: vi.fn(),
  mockConnect: vi.fn(),
  mockDisconnect: vi.fn(),
  mockLaunchCursorAgent: vi.fn(),
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
  findJobRunByTicketKeyAndRepository: mockFindJobRunByTicketKeyAndRepository,
  updateJobRun: mockUpdateJobRun,
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

vi.mock('@/services/cursor', () => ({
  launchCursorAgent: mockLaunchCursorAgent,
}));

describe('SageAutoPRBotJiraPollingService', () => {
  let service: BaseJiraPollingService;

  beforeEach(() => {
    vi.clearAllMocks();
    const mockJiraClient = {
      searchIssues: mockSearchIssues,
      removeLabel: mockRemoveLabel,
      addComment: mockAddComment,
      findLabelAddedBy: mockFindLabelAddedBy,
    };
    service = createSageAutoPRBotJiraPollingService(mockJiraClient as any);

    // Default mocks for successful flow
    mockLaunchCursorAgent.mockResolvedValue({
      success: true,
      agentId: 'agent-123',
      agentUrl: 'https://cursor.sh/agent/123',
    });
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
      expect(mockSearchIssues).toHaveBeenCalledWith('labels = "sage-bot"');
    });

    it('processes tickets, creates job runs, and launches Cursor agents', async () => {
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
      mockFindJobRunByTicketKeyAndRepository.mockResolvedValueOnce(null);
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

      // Verify Cursor agent was launched (targetRef is undefined - Cursor uses repo's default branch)
      expect(mockLaunchCursorAgent).toHaveBeenCalledWith({
        ticketKey: 'DEVPROD-123',
        summary: 'Test issue',
        description: 'Test description',
        targetRepository: 'mongodb/mongo-tools',
        targetRef: undefined,
        assigneeEmail: 'user@example.com',
        autoCreatePr: true,
      });

      // Verify job run was updated with agent ID and status
      expect(mockUpdateJobRun).toHaveBeenCalledWith(mockJobId, {
        cursorAgentId: 'agent-123',
        status: JobRunStatus.Running,
      });

      // Verify success comment was posted
      expect(mockAddComment).toHaveBeenCalledWith(
        'DEVPROD-123',
        expect.stringContaining('Sage Bot Agent Launched')
      );
    });

    it('skips tickets where all repos have active (pending/running) job runs', async () => {
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
      mockFindJobRunByTicketKeyAndRepository.mockResolvedValueOnce({
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
            skipReason: 'All repositories have active job runs',
          },
        ],
      });
      expect(mockRemoveLabel).toHaveBeenCalledWith('DEVPROD-456', 'sage-bot');
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
      mockFindJobRunByTicketKeyAndRepository.mockResolvedValueOnce({
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
      mockUpdateJobRun.mockResolvedValueOnce(undefined);
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
      // DEVPROD-001 has no repo label -> uses findJobRunByTicketKey
      mockFindJobRunByTicketKey.mockResolvedValueOnce(null);
      // DEVPROD-002 has a repo label -> uses findJobRunByTicketKeyAndRepository
      mockFindJobRunByTicketKeyAndRepository.mockResolvedValueOnce(null);
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
      mockFindJobRunByTicketKeyAndRepository.mockResolvedValueOnce(null);
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

    it('handles agent launch failure and posts error comment', async () => {
      const mockIssue = {
        key: 'DEVPROD-AGENT-FAIL',
        fields: {
          summary: 'Agent launch fail test',
          description: 'Test description',
          assignee: {
            emailAddress: 'user@example.com',
            displayName: 'Test User',
          },
          labels: ['sage-bot', 'repo:mongodb/test'],
        },
      };

      mockSearchIssues.mockResolvedValueOnce([mockIssue]);
      mockFindJobRunByTicketKeyAndRepository.mockResolvedValueOnce(null);
      mockFindLabelAddedBy.mockResolvedValueOnce('user@example.com');
      mockRemoveLabel.mockResolvedValueOnce(undefined);
      mockCredentialsExist.mockResolvedValueOnce(true);
      const mockJobId = new ObjectId();
      mockCreateJobRun.mockResolvedValueOnce({
        _id: mockJobId,
        jiraTicketKey: 'DEVPROD-AGENT-FAIL',
        status: JobRunStatus.Pending,
      });
      // Agent launch fails
      mockLaunchCursorAgent.mockResolvedValueOnce({
        success: false,
        error: 'API rate limit exceeded',
      });

      const result = await service.poll();

      expect(result).toEqual({
        ticketsFound: 1,
        ticketsProcessed: 0,
        ticketsSkipped: 0,
        ticketsErrored: 1,
        results: [
          {
            ticketKey: 'DEVPROD-AGENT-FAIL',
            success: false,
            error: expect.stringContaining('API rate limit exceeded'),
          },
        ],
      });

      // Verify job was marked as failed
      expect(mockUpdateJobRun).toHaveBeenCalledWith(mockJobId, {
        status: JobRunStatus.Failed,
        errorMessage: expect.stringContaining('API rate limit exceeded'),
      });

      // Verify error comment was posted to Jira
      expect(mockAddComment).toHaveBeenCalledWith(
        'DEVPROD-AGENT-FAIL',
        expect.stringContaining('Sage Bot Agent Launch Failed')
      );
    });

    it('uses inline ref from label instead of configured default', async () => {
      const mockIssue = {
        key: 'DEVPROD-INLINE-REF',
        fields: {
          summary: 'Test with inline ref',
          description: 'Test description',
          assignee: {
            emailAddress: 'user@example.com',
            displayName: 'Test User',
          },
          labels: ['sage-bot', 'repo:mongodb/test@feature-branch'],
        },
      };

      mockSearchIssues.mockResolvedValueOnce([mockIssue]);
      mockFindJobRunByTicketKeyAndRepository.mockResolvedValueOnce(null);
      mockFindLabelAddedBy.mockResolvedValueOnce('user@example.com');
      mockRemoveLabel.mockResolvedValueOnce(undefined);
      mockCredentialsExist.mockResolvedValueOnce(true);
      const mockJobId = new ObjectId();
      mockCreateJobRun.mockResolvedValueOnce({
        _id: mockJobId,
        jiraTicketKey: 'DEVPROD-INLINE-REF',
        status: JobRunStatus.Pending,
      });

      await service.poll();

      // Verify Cursor agent was launched with inline ref from the label
      expect(mockLaunchCursorAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          targetRepository: 'mongodb/test',
          targetRef: 'feature-branch',
        })
      );
    });

    describe('multi-repo support', () => {
      it('launches separate agents for each repo label', async () => {
        const mockIssue = {
          key: 'DEVPROD-MULTI',
          fields: {
            summary: 'Multi-repo test',
            description: 'Test description',
            assignee: {
              emailAddress: 'user@example.com',
              displayName: 'Test User',
            },
            labels: ['sage-bot', 'repo:mongodb/repo1', 'repo:mongodb/repo2'],
          },
        };

        mockSearchIssues.mockResolvedValueOnce([mockIssue]);
        // No active jobs for either repo
        mockFindJobRunByTicketKeyAndRepository
          .mockResolvedValueOnce(null) // repo1
          .mockResolvedValueOnce(null); // repo2
        mockFindLabelAddedBy.mockResolvedValueOnce('user@example.com');
        mockRemoveLabel.mockResolvedValueOnce(undefined);
        mockCredentialsExist.mockResolvedValueOnce(true);
        const mockJobId1 = new ObjectId();
        const mockJobId2 = new ObjectId();
        mockCreateJobRun
          .mockResolvedValueOnce({
            _id: mockJobId1,
            jiraTicketKey: 'DEVPROD-MULTI',
            status: JobRunStatus.Pending,
          })
          .mockResolvedValueOnce({
            _id: mockJobId2,
            jiraTicketKey: 'DEVPROD-MULTI',
            status: JobRunStatus.Pending,
          });
        mockLaunchCursorAgent
          .mockResolvedValueOnce({
            success: true,
            agentId: 'agent-repo1',
            agentUrl: 'https://cursor.sh/agent/repo1',
          })
          .mockResolvedValueOnce({
            success: true,
            agentId: 'agent-repo2',
            agentUrl: 'https://cursor.sh/agent/repo2',
          });

        const result = await service.poll();

        expect(result).toEqual({
          ticketsFound: 1,
          ticketsProcessed: 1,
          ticketsSkipped: 0,
          ticketsErrored: 0,
          results: [{ ticketKey: 'DEVPROD-MULTI', success: true }],
        });

        // Duplicate check called once per repo
        expect(mockFindJobRunByTicketKeyAndRepository).toHaveBeenCalledTimes(2);
        expect(mockFindJobRunByTicketKeyAndRepository).toHaveBeenCalledWith(
          'DEVPROD-MULTI',
          'mongodb/repo1'
        );
        expect(mockFindJobRunByTicketKeyAndRepository).toHaveBeenCalledWith(
          'DEVPROD-MULTI',
          'mongodb/repo2'
        );

        // Label removed once
        expect(mockRemoveLabel).toHaveBeenCalledTimes(1);
        expect(mockRemoveLabel).toHaveBeenCalledWith(
          'DEVPROD-MULTI',
          'sage-bot'
        );

        // Two job runs created, one per repo
        expect(mockCreateJobRun).toHaveBeenCalledTimes(2);
        expect(mockCreateJobRun).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({
              targetRepository: 'mongodb/repo1',
            }),
          })
        );
        expect(mockCreateJobRun).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({
              targetRepository: 'mongodb/repo2',
            }),
          })
        );

        // Two agents launched, one per repo
        expect(mockLaunchCursorAgent).toHaveBeenCalledTimes(2);
        expect(mockLaunchCursorAgent).toHaveBeenCalledWith(
          expect.objectContaining({ targetRepository: 'mongodb/repo1' })
        );
        expect(mockLaunchCursorAgent).toHaveBeenCalledWith(
          expect.objectContaining({ targetRepository: 'mongodb/repo2' })
        );

        // Two "Agent Launched" comments posted
        expect(mockAddComment).toHaveBeenCalledTimes(2);
        expect(mockAddComment).toHaveBeenCalledWith(
          'DEVPROD-MULTI',
          expect.stringContaining('Sage Bot Agent Launched')
        );
      });

      it('only processes repos without active jobs when some already have active jobs', async () => {
        const mockIssue = {
          key: 'DEVPROD-PARTIAL',
          fields: {
            summary: 'Partial multi-repo test',
            description: 'Test description',
            assignee: {
              emailAddress: 'user@example.com',
              displayName: 'Test User',
            },
            labels: ['sage-bot', 'repo:mongodb/repo1', 'repo:mongodb/repo2'],
          },
        };

        mockSearchIssues.mockResolvedValueOnce([mockIssue]);
        // repo1 has an active job, repo2 does not
        mockFindJobRunByTicketKeyAndRepository
          .mockResolvedValueOnce({
            _id: new ObjectId(),
            jiraTicketKey: 'DEVPROD-PARTIAL',
            status: JobRunStatus.Running,
          }) // repo1 - active
          .mockResolvedValueOnce(null); // repo2 - no active job
        mockFindLabelAddedBy.mockResolvedValueOnce('user@example.com');
        mockRemoveLabel.mockResolvedValueOnce(undefined);
        mockCredentialsExist.mockResolvedValueOnce(true);
        const mockJobId = new ObjectId();
        mockCreateJobRun.mockResolvedValueOnce({
          _id: mockJobId,
          jiraTicketKey: 'DEVPROD-PARTIAL',
          status: JobRunStatus.Pending,
        });
        mockLaunchCursorAgent.mockResolvedValueOnce({
          success: true,
          agentId: 'agent-repo2',
          agentUrl: 'https://cursor.sh/agent/repo2',
        });

        const result = await service.poll();

        expect(result).toEqual({
          ticketsFound: 1,
          ticketsProcessed: 1,
          ticketsSkipped: 0,
          ticketsErrored: 0,
          results: [{ ticketKey: 'DEVPROD-PARTIAL', success: true }],
        });

        // Only one job run created (for repo2)
        expect(mockCreateJobRun).toHaveBeenCalledTimes(1);
        expect(mockCreateJobRun).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({
              targetRepository: 'mongodb/repo2',
            }),
          })
        );

        // Only one agent launched (for repo2)
        expect(mockLaunchCursorAgent).toHaveBeenCalledTimes(1);
        expect(mockLaunchCursorAgent).toHaveBeenCalledWith(
          expect.objectContaining({ targetRepository: 'mongodb/repo2' })
        );
      });

      it('skips ticket when all repos have active jobs', async () => {
        const mockIssue = {
          key: 'DEVPROD-ALL-ACTIVE',
          fields: {
            summary: 'All active repos test',
            description: 'Test description',
            assignee: {
              emailAddress: 'user@example.com',
              displayName: 'Test User',
            },
            labels: ['sage-bot', 'repo:mongodb/repo1', 'repo:mongodb/repo2'],
          },
        };

        mockSearchIssues.mockResolvedValueOnce([mockIssue]);
        // Both repos have active jobs
        mockFindJobRunByTicketKeyAndRepository
          .mockResolvedValueOnce({
            _id: new ObjectId(),
            jiraTicketKey: 'DEVPROD-ALL-ACTIVE',
            status: JobRunStatus.Running,
          })
          .mockResolvedValueOnce({
            _id: new ObjectId(),
            jiraTicketKey: 'DEVPROD-ALL-ACTIVE',
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
              ticketKey: 'DEVPROD-ALL-ACTIVE',
              success: true,
              skipped: true,
              skipReason: 'All repositories have active job runs',
            },
          ],
        });

        // Label removed (race condition handling)
        expect(mockRemoveLabel).toHaveBeenCalledWith(
          'DEVPROD-ALL-ACTIVE',
          'sage-bot'
        );
        expect(mockCreateJobRun).not.toHaveBeenCalled();
        expect(mockLaunchCursorAgent).not.toHaveBeenCalled();
      });

      it('posts one validation error comment for all repos when validation fails', async () => {
        const mockIssue = {
          key: 'DEVPROD-MULTI-FAIL',
          fields: {
            summary: 'Multi-repo validation fail',
            description: 'Test description',
            assignee: null, // No assignee - validation will fail
            labels: ['sage-bot', 'repo:mongodb/repo1', 'repo:mongodb/repo2'],
          },
        };

        mockSearchIssues.mockResolvedValueOnce([mockIssue]);
        mockFindJobRunByTicketKeyAndRepository
          .mockResolvedValueOnce(null) // repo1
          .mockResolvedValueOnce(null); // repo2
        mockFindLabelAddedBy.mockResolvedValueOnce('initiator@example.com');
        mockRemoveLabel.mockResolvedValueOnce(undefined);
        const mockJobId = new ObjectId();
        mockCreateJobRun.mockResolvedValueOnce({
          _id: mockJobId,
          jiraTicketKey: 'DEVPROD-MULTI-FAIL',
          status: JobRunStatus.Pending,
        });
        mockUpdateJobRun.mockResolvedValueOnce(undefined);
        mockAddComment.mockResolvedValueOnce(undefined);

        const result = await service.poll();

        expect(result).toEqual({
          ticketsFound: 1,
          ticketsProcessed: 0,
          ticketsSkipped: 1,
          ticketsErrored: 0,
          results: [
            {
              ticketKey: 'DEVPROD-MULTI-FAIL',
              success: true,
              skipped: true,
              skipReason: expect.stringContaining('No assignee set'),
            },
          ],
        });

        // Only ONE job run created (not one per repo)
        expect(mockCreateJobRun).toHaveBeenCalledTimes(1);

        // Only ONE validation error comment posted (not one per repo)
        expect(mockAddComment).toHaveBeenCalledTimes(1);
        expect(mockAddComment).toHaveBeenCalledWith(
          'DEVPROD-MULTI-FAIL',
          expect.stringContaining('Sage Bot Validation Failed')
        );
      });

      it('succeeds overall when at least one repo agent launches successfully', async () => {
        const mockIssue = {
          key: 'DEVPROD-MIXED',
          fields: {
            summary: 'Mixed success/fail',
            description: 'Test description',
            assignee: {
              emailAddress: 'user@example.com',
              displayName: 'Test User',
            },
            labels: ['sage-bot', 'repo:mongodb/repo1', 'repo:mongodb/repo2'],
          },
        };

        mockSearchIssues.mockResolvedValueOnce([mockIssue]);
        mockFindJobRunByTicketKeyAndRepository
          .mockResolvedValueOnce(null) // repo1
          .mockResolvedValueOnce(null); // repo2
        mockFindLabelAddedBy.mockResolvedValueOnce('user@example.com');
        mockRemoveLabel.mockResolvedValueOnce(undefined);
        mockCredentialsExist.mockResolvedValueOnce(true);
        const mockJobId1 = new ObjectId();
        const mockJobId2 = new ObjectId();
        mockCreateJobRun
          .mockResolvedValueOnce({
            _id: mockJobId1,
            jiraTicketKey: 'DEVPROD-MIXED',
            status: JobRunStatus.Pending,
          })
          .mockResolvedValueOnce({
            _id: mockJobId2,
            jiraTicketKey: 'DEVPROD-MIXED',
            status: JobRunStatus.Pending,
          });
        // repo1 succeeds, repo2 fails
        mockLaunchCursorAgent
          .mockResolvedValueOnce({
            success: true,
            agentId: 'agent-repo1',
            agentUrl: 'https://cursor.sh/agent/repo1',
          })
          .mockResolvedValueOnce({
            success: false,
            error: 'Rate limit exceeded',
          });

        const result = await service.poll();

        // Overall success because at least one repo launched
        expect(result).toEqual({
          ticketsFound: 1,
          ticketsProcessed: 1,
          ticketsSkipped: 0,
          ticketsErrored: 0,
          results: [{ ticketKey: 'DEVPROD-MIXED', success: true }],
        });

        // Both job runs created
        expect(mockCreateJobRun).toHaveBeenCalledTimes(2);

        // repo2 job marked as failed
        expect(mockUpdateJobRun).toHaveBeenCalledWith(mockJobId2, {
          status: JobRunStatus.Failed,
          errorMessage: expect.stringContaining('Rate limit exceeded'),
        });
      });

      it('supports inline refs on multi-repo labels', async () => {
        const mockIssue = {
          key: 'DEVPROD-MULTI-REF',
          fields: {
            summary: 'Multi-repo with refs',
            description: 'Test description',
            assignee: {
              emailAddress: 'user@example.com',
              displayName: 'Test User',
            },
            labels: [
              'sage-bot',
              'repo:mongodb/repo1@feature-a',
              'repo:mongodb/repo2@feature-b',
            ],
          },
        };

        mockSearchIssues.mockResolvedValueOnce([mockIssue]);
        mockFindJobRunByTicketKeyAndRepository
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null);
        mockFindLabelAddedBy.mockResolvedValueOnce('user@example.com');
        mockRemoveLabel.mockResolvedValueOnce(undefined);
        mockCredentialsExist.mockResolvedValueOnce(true);
        mockCreateJobRun
          .mockResolvedValueOnce({
            _id: new ObjectId(),
            jiraTicketKey: 'DEVPROD-MULTI-REF',
            status: JobRunStatus.Pending,
          })
          .mockResolvedValueOnce({
            _id: new ObjectId(),
            jiraTicketKey: 'DEVPROD-MULTI-REF',
            status: JobRunStatus.Pending,
          });
        mockLaunchCursorAgent
          .mockResolvedValueOnce({
            success: true,
            agentId: 'agent-a',
            agentUrl: 'https://cursor.sh/agent/a',
          })
          .mockResolvedValueOnce({
            success: true,
            agentId: 'agent-b',
            agentUrl: 'https://cursor.sh/agent/b',
          });

        await service.poll();

        expect(mockLaunchCursorAgent).toHaveBeenCalledWith(
          expect.objectContaining({
            targetRepository: 'mongodb/repo1',
            targetRef: 'feature-a',
          })
        );
        expect(mockLaunchCursorAgent).toHaveBeenCalledWith(
          expect.objectContaining({
            targetRepository: 'mongodb/repo2',
            targetRef: 'feature-b',
          })
        );
      });
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
