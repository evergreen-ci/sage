import { ObjectId } from 'mongodb';
import { JobRun, JobRunStatus } from '@/db/types';
import { JiraClient } from '@/services/jira/jiraClient';
import { PrMergeStatusPollingService } from '.';

const {
  mockConnect,
  mockDisconnect,
  mockFindCompletedJobRunsWithOpenPRs,
  mockGetDevStatus,
  mockUpdateJobRun,
  mockValidateConfig,
} = vi.hoisted(() => ({
  mockConnect: vi.fn(),
  mockDisconnect: vi.fn(),
  mockFindCompletedJobRunsWithOpenPRs: vi.fn(),
  mockGetDevStatus: vi.fn(),
  mockUpdateJobRun: vi.fn(),
  mockValidateConfig: vi.fn(),
}));

vi.mock('@/db/repositories/jobRunsRepository', () => ({
  findCompletedJobRunsWithOpenPRs: mockFindCompletedJobRunsWithOpenPRs,
  updateJobRun: mockUpdateJobRun,
}));

vi.mock('@/services/jira/jiraClient', () => ({
  jiraClient: {},
}));

vi.mock('@/db/connection', () => ({
  db: {
    connect: mockConnect,
    disconnect: mockDisconnect,
  },
}));

vi.mock('@/config', async importOriginal => {
  const actual = await importOriginal<typeof import('@/config')>();
  return {
    ...actual,
    validateConfig: mockValidateConfig,
  };
});

describe('PrMergeStatusPollingService', () => {
  let mockJiraClient: JiraClient;

  const createMockJob = (overrides: Partial<JobRun> = {}): JobRun => ({
    _id: new ObjectId(),
    jiraTicketKey: 'TEST-123',
    status: JobRunStatus.Completed,
    initiatedBy: 'initiator@example.com',
    assignee: 'assignee@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: new Date(),
    prUrl: 'https://github.com/org/repo/pull/123',
    prStatus: 'open',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockJiraClient = {
      getDevStatus: mockGetDevStatus,
    } as unknown as JiraClient;
  });

  describe('poll()', () => {
    it('returns empty result when no completed jobs with open PRs found', async () => {
      mockFindCompletedJobRunsWithOpenPRs.mockResolvedValueOnce([]);

      const service = new PrMergeStatusPollingService({
        jiraClient: mockJiraClient,
      });

      const result = await service.poll();

      expect(mockFindCompletedJobRunsWithOpenPRs).toHaveBeenCalled();
      expect(result).toEqual({
        jobsFound: 0,
        jobsProcessed: 0,
        jobsSkipped: 0,
        jobsErrored: 0,
        results: [],
      });
    });

    it('skips jobs missing PR URL', async () => {
      const jobWithoutPrUrl = createMockJob({ prUrl: undefined });
      mockFindCompletedJobRunsWithOpenPRs.mockResolvedValueOnce([
        jobWithoutPrUrl,
      ]);

      const service = new PrMergeStatusPollingService({
        jiraClient: mockJiraClient,
      });

      const result = await service.poll();

      expect(result.jobsFound).toBe(1);
      expect(result.jobsSkipped).toBe(1);
      expect(result.results[0].skipReason).toBe('Missing PR URL');
      expect(mockGetDevStatus).not.toHaveBeenCalled();
    });

    it('skips jobs when dev status not found', async () => {
      const job = createMockJob();
      mockFindCompletedJobRunsWithOpenPRs.mockResolvedValueOnce([job]);
      mockGetDevStatus.mockResolvedValueOnce(null);

      const service = new PrMergeStatusPollingService({
        jiraClient: mockJiraClient,
      });

      const result = await service.poll();

      expect(result.jobsSkipped).toBe(1);
      expect(result.results[0].skipReason).toBe('No dev status found in Jira');
    });

    it('skips jobs when PR not found in dev status', async () => {
      const job = createMockJob();
      mockFindCompletedJobRunsWithOpenPRs.mockResolvedValueOnce([job]);
      mockGetDevStatus.mockResolvedValueOnce({
        detail: [
          {
            pullRequests: [
              {
                id: 'pr-1',
                name: 'Other PR',
                url: 'https://github.com/org/repo/pull/999',
                status: 'OPEN',
                lastUpdate: '2024-01-01T00:00:00Z',
                author: {
                  name: 'user',
                  avatar: '',
                  url: '',
                },
              },
            ],
          },
        ],
      });

      const service = new PrMergeStatusPollingService({
        jiraClient: mockJiraClient,
      });

      const result = await service.poll();

      expect(result.jobsSkipped).toBe(1);
      expect(result.results[0].skipReason).toBe(
        'PR not found in Jira dev status'
      );
    });

    it('skips jobs when PR is still open', async () => {
      const job = createMockJob();
      mockFindCompletedJobRunsWithOpenPRs.mockResolvedValueOnce([job]);
      mockGetDevStatus.mockResolvedValueOnce({
        detail: [
          {
            pullRequests: [
              {
                id: 'pr-1',
                name: 'Test PR',
                url: 'https://github.com/org/repo/pull/123',
                status: 'OPEN',
                lastUpdate: '2024-01-01T00:00:00Z',
                author: {
                  name: 'user',
                  avatar: '',
                  url: '',
                },
              },
            ],
          },
        ],
      });

      const service = new PrMergeStatusPollingService({
        jiraClient: mockJiraClient,
      });

      const result = await service.poll();

      expect(result.jobsSkipped).toBe(1);
      expect(result.results[0].skipReason).toBe('PR still open');
      expect(mockUpdateJobRun).not.toHaveBeenCalled();
    });

    it('updates job when PR is merged', async () => {
      const job = createMockJob();
      mockFindCompletedJobRunsWithOpenPRs.mockResolvedValueOnce([job]);
      mockGetDevStatus.mockResolvedValueOnce({
        detail: [
          {
            pullRequests: [
              {
                id: 'pr-1',
                name: 'Test PR',
                url: 'https://github.com/org/repo/pull/123',
                status: 'MERGED',
                lastUpdate: '2024-01-01T00:00:00Z',
                author: {
                  name: 'user',
                  avatar: '',
                  url: '',
                },
              },
            ],
          },
        ],
      });
      mockUpdateJobRun.mockResolvedValueOnce(job);

      const service = new PrMergeStatusPollingService({
        jiraClient: mockJiraClient,
      });

      const result = await service.poll();

      expect(result.jobsProcessed).toBe(1);
      expect(mockUpdateJobRun).toHaveBeenCalledWith(job._id, {
        prStatus: 'merged',
        prMergedAt: expect.any(Date),
      });
    });

    it('updates job when PR is declined', async () => {
      const job = createMockJob();
      mockFindCompletedJobRunsWithOpenPRs.mockResolvedValueOnce([job]);
      mockGetDevStatus.mockResolvedValueOnce({
        detail: [
          {
            pullRequests: [
              {
                id: 'pr-1',
                name: 'Test PR',
                url: 'https://github.com/org/repo/pull/123',
                status: 'DECLINED',
                lastUpdate: '2024-01-01T00:00:00Z',
                author: {
                  name: 'user',
                  avatar: '',
                  url: '',
                },
              },
            ],
          },
        ],
      });
      mockUpdateJobRun.mockResolvedValueOnce(job);

      const service = new PrMergeStatusPollingService({
        jiraClient: mockJiraClient,
      });

      const result = await service.poll();

      expect(result.jobsProcessed).toBe(1);
      expect(mockUpdateJobRun).toHaveBeenCalledWith(job._id, {
        prStatus: 'closed',
        prClosedAt: expect.any(Date),
      });
    });

    it('handles errors in individual job processing and continues', async () => {
      const job1 = createMockJob({ jiraTicketKey: 'TEST-1' });
      const job2 = createMockJob({ jiraTicketKey: 'TEST-2' });

      mockFindCompletedJobRunsWithOpenPRs.mockResolvedValueOnce([job1, job2]);
      mockGetDevStatus
        .mockResolvedValueOnce({
          detail: [
            {
              pullRequests: [
                {
                  id: 'pr-1',
                  name: 'Test PR',
                  url: 'https://github.com/org/repo/pull/123',
                  status: 'MERGED',
                  lastUpdate: '2024-01-01T00:00:00Z',
                  author: {
                    name: 'user',
                    avatar: '',
                    url: '',
                  },
                },
              ],
            },
          ],
        })
        .mockResolvedValueOnce({
          detail: [
            {
              pullRequests: [
                {
                  id: 'pr-2',
                  name: 'Test PR 2',
                  url: 'https://github.com/org/repo/pull/456',
                  status: 'MERGED',
                  lastUpdate: '2024-01-01T00:00:00Z',
                  author: {
                    name: 'user',
                    avatar: '',
                    url: '',
                  },
                },
              ],
            },
          ],
        });
      mockUpdateJobRun
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce(job2);

      const service = new PrMergeStatusPollingService({
        jiraClient: mockJiraClient,
      });

      const result = await service.poll();

      expect(result.jobsErrored).toBe(1);
      expect(result.jobsProcessed).toBe(1);
      expect(result.results[0].error).toContain('Database error');
    });

    it('throws error when database query fails', async () => {
      mockFindCompletedJobRunsWithOpenPRs.mockRejectedValueOnce(
        new Error('Connection failed')
      );

      const service = new PrMergeStatusPollingService({
        jiraClient: mockJiraClient,
      });

      await expect(service.poll()).rejects.toThrow('Connection failed');
    });
  });

  describe('runAsJob()', () => {
    it('connects to database, runs polling, and disconnects', async () => {
      mockValidateConfig.mockReturnValueOnce(null);
      mockConnect.mockResolvedValueOnce(undefined);
      mockFindCompletedJobRunsWithOpenPRs.mockResolvedValueOnce([]);
      mockDisconnect.mockResolvedValueOnce(undefined);

      const service = new PrMergeStatusPollingService({
        jiraClient: mockJiraClient,
      });

      await service.runAsJob();

      expect(mockValidateConfig).toHaveBeenCalled();
      expect(mockConnect).toHaveBeenCalled();
      expect(mockFindCompletedJobRunsWithOpenPRs).toHaveBeenCalled();
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('disconnects even when polling fails', async () => {
      mockValidateConfig.mockReturnValueOnce(null);
      mockConnect.mockResolvedValueOnce(undefined);
      mockFindCompletedJobRunsWithOpenPRs.mockRejectedValueOnce(
        new Error('DB query failed')
      );
      mockDisconnect.mockResolvedValueOnce(undefined);

      const service = new PrMergeStatusPollingService({
        jiraClient: mockJiraClient,
      });

      await expect(service.runAsJob()).rejects.toThrow('DB query failed');

      expect(mockConnect).toHaveBeenCalled();
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('sets exit code to 1 when there are system errors', async () => {
      const job = createMockJob();

      mockValidateConfig.mockReturnValueOnce(null);
      mockConnect.mockResolvedValueOnce(undefined);
      mockFindCompletedJobRunsWithOpenPRs.mockResolvedValueOnce([job]);
      mockGetDevStatus.mockResolvedValueOnce({
        detail: [
          {
            pullRequests: [
              {
                id: 'pr-1',
                name: 'Test PR',
                url: 'https://github.com/org/repo/pull/123',
                status: 'MERGED',
                lastUpdate: '2024-01-01T00:00:00Z',
                author: {
                  name: 'user',
                  avatar: '',
                  url: '',
                },
              },
            ],
          },
        ],
      });
      mockUpdateJobRun.mockRejectedValueOnce(new Error('Update failed'));
      mockDisconnect.mockResolvedValueOnce(undefined);

      const service = new PrMergeStatusPollingService({
        jiraClient: mockJiraClient,
      });

      const originalExitCode = process.exitCode;

      await service.runAsJob();

      expect(process.exitCode).toBe(1);
      expect(mockDisconnect).toHaveBeenCalled();

      process.exitCode = originalExitCode;
    });
  });
});
