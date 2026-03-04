import { ObjectId } from 'mongodb';
import { JobRun, JobRunStatus, PRStatus } from '@/db/types';
import { GitHubTokenManager } from '@/services/github';
import { PrMergeStatusPollingService } from '.';

const {
  mockConnect,
  mockDisconnect,
  mockFindCompletedJobRunsWithOpenPRs,
  mockGetPullRequestByUrl,
  mockUpdateJobRun,
  mockValidateConfig,
} = vi.hoisted(() => ({
  mockConnect: vi.fn(),
  mockDisconnect: vi.fn(),
  mockFindCompletedJobRunsWithOpenPRs: vi.fn(),
  mockGetPullRequestByUrl: vi.fn(),
  mockUpdateJobRun: vi.fn(),
  mockValidateConfig: vi.fn(),
}));

vi.mock('@/db/repositories/jobRunsRepository', () => ({
  findCompletedJobRunsWithOpenPRs: mockFindCompletedJobRunsWithOpenPRs,
  updateJobRun: mockUpdateJobRun,
}));

vi.mock('@/services/github', () => ({
  githubTokenManager: {},
  GitHubTokenManager: vi.fn(),
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
  let mockGitHubTokenManager: GitHubTokenManager;

  const createMockJob = (overrides: Partial<JobRun> = {}): JobRun => ({
    _id: new ObjectId(),
    jiraTicketKey: 'TEST-123',
    status: JobRunStatus.Completed,
    initiatedBy: 'initiator@example.com',
    assignee: 'assignee@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: new Date(),
    pr: {
      url: 'https://github.com/org/repo/pull/123',
      number: 123,
      repository: 'org/repo',
      status: PRStatus.Open,
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGitHubTokenManager = {
      getPullRequestByUrl: mockGetPullRequestByUrl,
    } as unknown as GitHubTokenManager;
  });

  describe('poll()', () => {
    it('returns empty result when no completed jobs with open PRs found', async () => {
      mockFindCompletedJobRunsWithOpenPRs.mockResolvedValueOnce([]);

      const service = new PrMergeStatusPollingService({
        githubTokenManager: mockGitHubTokenManager,
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
      const jobWithoutPr = createMockJob({ pr: undefined });
      mockFindCompletedJobRunsWithOpenPRs.mockResolvedValueOnce([jobWithoutPr]);

      const service = new PrMergeStatusPollingService({
        githubTokenManager: mockGitHubTokenManager,
      });

      const result = await service.poll();

      expect(result.jobsFound).toBe(1);
      expect(result.jobsSkipped).toBe(1);
      expect(result.results[0].skipReason).toBe('Missing PR URL');
      expect(mockGetPullRequestByUrl).not.toHaveBeenCalled();
    });

    it('skips jobs when PR is still open', async () => {
      const job = createMockJob();
      mockFindCompletedJobRunsWithOpenPRs.mockResolvedValueOnce([job]);
      mockGetPullRequestByUrl.mockResolvedValueOnce({
        number: 123,
        title: 'Test PR',
        state: 'open',
        merged: false,
        mergedAt: null,
        url: 'https://github.com/org/repo/pull/123',
        repository: 'org/repo',
      });

      const service = new PrMergeStatusPollingService({
        githubTokenManager: mockGitHubTokenManager,
      });

      const result = await service.poll();

      expect(result.jobsSkipped).toBe(1);
      expect(result.results[0].skipReason).toBe('PR still open');
      expect(mockUpdateJobRun).not.toHaveBeenCalled();
    });

    it('marks stale PRs as abandoned when completed more than 30 days ago', async () => {
      const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      const staleJob = createMockJob({ completedAt: thirtyOneDaysAgo });
      mockFindCompletedJobRunsWithOpenPRs.mockResolvedValueOnce([staleJob]);
      mockUpdateJobRun.mockResolvedValueOnce(staleJob);

      const service = new PrMergeStatusPollingService({
        githubTokenManager: mockGitHubTokenManager,
      });

      const result = await service.poll();

      expect(result.jobsProcessed).toBe(1);
      expect(mockGetPullRequestByUrl).not.toHaveBeenCalled();
      expect(mockUpdateJobRun).toHaveBeenCalledWith(staleJob._id, {
        pr: {
          url: 'https://github.com/org/repo/pull/123',
          number: 123,
          repository: 'org/repo',
          status: PRStatus.Abandoned,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('updates job when PR is merged', async () => {
      const job = createMockJob();
      mockFindCompletedJobRunsWithOpenPRs.mockResolvedValueOnce([job]);
      mockGetPullRequestByUrl.mockResolvedValueOnce({
        number: 123,
        title: 'Test PR',
        state: 'closed',
        merged: true,
        mergedAt: '2024-01-01T00:00:00Z',
        url: 'https://github.com/org/repo/pull/123',
        repository: 'org/repo',
      });
      mockUpdateJobRun.mockResolvedValueOnce(job);

      const service = new PrMergeStatusPollingService({
        githubTokenManager: mockGitHubTokenManager,
      });

      const result = await service.poll();

      expect(result.jobsProcessed).toBe(1);
      expect(mockUpdateJobRun).toHaveBeenCalledWith(job._id, {
        pr: {
          url: 'https://github.com/org/repo/pull/123',
          number: 123,
          repository: 'org/repo',
          status: 'MERGED',
          updatedAt: expect.any(Date),
        },
      });
    });

    it('updates job when PR is declined', async () => {
      const job = createMockJob();
      mockFindCompletedJobRunsWithOpenPRs.mockResolvedValueOnce([job]);
      mockGetPullRequestByUrl.mockResolvedValueOnce({
        number: 123,
        title: 'Test PR',
        state: 'closed',
        merged: false,
        mergedAt: null,
        url: 'https://github.com/org/repo/pull/123',
        repository: 'org/repo',
      });
      mockUpdateJobRun.mockResolvedValueOnce(job);

      const service = new PrMergeStatusPollingService({
        githubTokenManager: mockGitHubTokenManager,
      });

      const result = await service.poll();

      expect(result.jobsProcessed).toBe(1);
      expect(mockUpdateJobRun).toHaveBeenCalledWith(job._id, {
        pr: {
          url: 'https://github.com/org/repo/pull/123',
          number: 123,
          repository: 'org/repo',
          status: 'DECLINED',
          updatedAt: expect.any(Date),
        },
      });
    });

    it('handles errors in individual job processing and continues', async () => {
      const job1 = createMockJob({ jiraTicketKey: 'TEST-1' });
      const job2 = createMockJob({
        jiraTicketKey: 'TEST-2',
        pr: {
          url: 'https://github.com/org/repo/pull/456',
          number: 456,
          repository: 'org/repo',
          status: PRStatus.Open,
        },
      });

      mockFindCompletedJobRunsWithOpenPRs.mockResolvedValueOnce([job1, job2]);
      mockGetPullRequestByUrl
        .mockResolvedValueOnce({
          number: 123,
          title: 'Test PR',
          state: 'closed',
          merged: true,
          mergedAt: '2024-01-01T00:00:00Z',
          url: 'https://github.com/org/repo/pull/123',
          repository: 'org/repo',
        })
        .mockResolvedValueOnce({
          number: 456,
          title: 'Test PR 2',
          state: 'closed',
          merged: true,
          mergedAt: '2024-01-01T00:00:00Z',
          url: 'https://github.com/org/repo/pull/456',
          repository: 'org/repo',
        });
      mockUpdateJobRun
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce(job2);

      const service = new PrMergeStatusPollingService({
        githubTokenManager: mockGitHubTokenManager,
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
        githubTokenManager: mockGitHubTokenManager,
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
        githubTokenManager: mockGitHubTokenManager,
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
        githubTokenManager: mockGitHubTokenManager,
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
      mockGetPullRequestByUrl.mockResolvedValueOnce({
        number: 123,
        title: 'Test PR',
        state: 'closed',
        merged: true,
        mergedAt: '2024-01-01T00:00:00Z',
        url: 'https://github.com/org/repo/pull/123',
        repository: 'org/repo',
      });
      mockUpdateJobRun.mockRejectedValueOnce(new Error('Update failed'));
      mockDisconnect.mockResolvedValueOnce(undefined);

      const service = new PrMergeStatusPollingService({
        githubTokenManager: mockGitHubTokenManager,
      });

      const originalExitCode = process.exitCode;

      await service.runAsJob();

      expect(process.exitCode).toBe(1);
      expect(mockDisconnect).toHaveBeenCalled();

      process.exitCode = originalExitCode;
    });
  });
});
