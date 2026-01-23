import { ObjectId } from 'mongodb';
import { JobRun, JobRunStatus } from '@/db/types';
import { JiraClient } from '@/services/jira/jiraClient';
import { CursorAgentStatusPollingService } from '.';

const {
  mockConnect,
  mockDisconnect,
  mockFindRunningJobRuns,
  mockGetAgentStatus,
  mockUpdateJobRun,
  mockValidateConfig,
} = vi.hoisted(() => ({
  mockConnect: vi.fn(),
  mockDisconnect: vi.fn(),
  mockFindRunningJobRuns: vi.fn(),
  mockGetAgentStatus: vi.fn(),
  mockUpdateJobRun: vi.fn(),
  mockValidateConfig: vi.fn(),
}));

vi.mock('@/db/repositories/jobRunsRepository', () => ({
  findRunningJobRuns: mockFindRunningJobRuns,
  updateJobRun: mockUpdateJobRun,
}));

vi.mock('@/services/cursor', () => ({
  getAgentStatus: mockGetAgentStatus,
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

describe('CursorAgentStatusPollingService', () => {
  let mockJiraClient: JiraClient;
  let mockAddComment: ReturnType<typeof vi.fn>;

  const createMockJob = (overrides: Partial<JobRun> = {}): JobRun => ({
    _id: new ObjectId(),
    jiraTicketKey: 'TEST-123',
    cursorAgentId: 'agent-123',
    status: JobRunStatus.Running,
    initiatedBy: 'initiator@example.com',
    assignee: 'assignee@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
    startedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockAddComment = vi.fn().mockResolvedValue(undefined);
    mockJiraClient = {
      addComment: mockAddComment,
    } as unknown as JiraClient;
  });

  describe('poll()', () => {
    it('returns empty result when no running jobs found', async () => {
      mockFindRunningJobRuns.mockResolvedValueOnce([]);

      const service = new CursorAgentStatusPollingService({
        jiraClient: mockJiraClient,
      });

      const result = await service.poll();

      expect(mockFindRunningJobRuns).toHaveBeenCalled();
      expect(result).toEqual({
        jobsFound: 0,
        jobsProcessed: 0,
        jobsSkipped: 0,
        jobsErrored: 0,
        results: [],
      });
    });

    it('skips jobs missing cursor agent metadata', async () => {
      const jobWithoutAgentId = createMockJob({
        cursorAgentId: undefined,
      });

      mockFindRunningJobRuns.mockResolvedValueOnce([jobWithoutAgentId]);

      const service = new CursorAgentStatusPollingService({
        jiraClient: mockJiraClient,
      });

      const result = await service.poll();

      expect(result.jobsFound).toBe(1);
      expect(result.jobsSkipped).toBe(1);
      expect(result.jobsProcessed).toBe(0);
      expect(result.results[0].skipped).toBe(true);
      expect(result.results[0].skipReason).toContain(
        'Missing cursor agent id or assignee'
      );
      expect(mockGetAgentStatus).not.toHaveBeenCalled();
    });

    it('skips jobs missing assignee email', async () => {
      const jobWithoutAssignee = createMockJob({
        assignee: null,
      });

      mockFindRunningJobRuns.mockResolvedValueOnce([jobWithoutAssignee]);

      const service = new CursorAgentStatusPollingService({
        jiraClient: mockJiraClient,
      });

      const result = await service.poll();

      expect(result.jobsSkipped).toBe(1);
      expect(result.results[0].skipped).toBe(true);
    });

    it('skips jobs when Cursor API returns error (transient failure)', async () => {
      const job = createMockJob();
      mockFindRunningJobRuns.mockResolvedValueOnce([job]);
      mockGetAgentStatus.mockResolvedValueOnce({
        success: false,
        error: 'API rate limited',
      });

      const service = new CursorAgentStatusPollingService({
        jiraClient: mockJiraClient,
      });

      const result = await service.poll();

      expect(result.jobsSkipped).toBe(1);
      expect(result.results[0].skipped).toBe(true);
      expect(result.results[0].skipReason).toContain('API error');
      expect(mockUpdateJobRun).not.toHaveBeenCalled();
    });

    it('marks job as timed out when TTL exceeded and agent still running', async () => {
      const oldStartTime = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
      const job = createMockJob({
        startedAt: oldStartTime,
      });

      mockFindRunningJobRuns.mockResolvedValueOnce([job]);
      mockGetAgentStatus.mockResolvedValueOnce({
        success: true,
        status: 'RUNNING',
      });

      const service = new CursorAgentStatusPollingService({
        jiraClient: mockJiraClient,
        ttlMinutes: 120, // 2 hour TTL
      });

      const result = await service.poll();

      expect(result.jobsProcessed).toBe(1);
      expect(mockUpdateJobRun).toHaveBeenCalledWith(job._id, {
        status: JobRunStatus.FailedTimeout,
        errorMessage: 'Job exceeded maximum runtime',
      });
      expect(mockAddComment).toHaveBeenCalledWith(
        'TEST-123',
        expect.stringContaining('timed out')
      );
    });

    it('does not timeout completed agents even if TTL exceeded', async () => {
      const oldStartTime = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
      const job = createMockJob({
        startedAt: oldStartTime,
      });

      mockFindRunningJobRuns.mockResolvedValueOnce([job]);
      mockGetAgentStatus.mockResolvedValueOnce({
        success: true,
        status: 'FINISHED',
        prUrl: 'https://github.com/org/repo/pull/123',
      });

      const service = new CursorAgentStatusPollingService({
        jiraClient: mockJiraClient,
        ttlMinutes: 120,
      });

      const result = await service.poll();

      expect(result.jobsProcessed).toBe(1);
      expect(mockUpdateJobRun).toHaveBeenCalledWith(job._id, {
        status: JobRunStatus.Completed,
      });
      expect(mockAddComment).toHaveBeenCalledWith(
        'TEST-123',
        expect.stringContaining('completed')
      );
    });

    it('updates job to completed when agent finishes successfully', async () => {
      const job = createMockJob();
      mockFindRunningJobRuns.mockResolvedValueOnce([job]);
      mockGetAgentStatus.mockResolvedValueOnce({
        success: true,
        status: 'FINISHED',
        prUrl: 'https://github.com/org/repo/pull/456',
        summary: 'Implemented the feature',
      });

      const service = new CursorAgentStatusPollingService({
        jiraClient: mockJiraClient,
      });

      const result = await service.poll();

      expect(result.jobsProcessed).toBe(1);
      expect(mockUpdateJobRun).toHaveBeenCalledWith(job._id, {
        status: JobRunStatus.Completed,
      });
      expect(mockAddComment).toHaveBeenCalledWith(
        'TEST-123',
        expect.stringContaining('completed')
      );
    });

    it('updates job to failed when agent encounters error', async () => {
      const job = createMockJob();
      mockFindRunningJobRuns.mockResolvedValueOnce([job]);
      mockGetAgentStatus.mockResolvedValueOnce({
        success: true,
        status: 'ERROR',
      });

      const service = new CursorAgentStatusPollingService({
        jiraClient: mockJiraClient,
      });

      const result = await service.poll();

      expect(result.jobsProcessed).toBe(1);
      expect(mockUpdateJobRun).toHaveBeenCalledWith(job._id, {
        status: JobRunStatus.Failed,
        errorMessage: 'Cursor agent encountered an error',
      });
      expect(mockAddComment).toHaveBeenCalledWith(
        'TEST-123',
        expect.stringContaining('error')
      );
    });

    it('updates job to failed when agent session expires', async () => {
      const job = createMockJob();
      mockFindRunningJobRuns.mockResolvedValueOnce([job]);
      mockGetAgentStatus.mockResolvedValueOnce({
        success: true,
        status: 'EXPIRED',
      });

      const service = new CursorAgentStatusPollingService({
        jiraClient: mockJiraClient,
      });

      const result = await service.poll();

      expect(result.jobsProcessed).toBe(1);
      expect(mockUpdateJobRun).toHaveBeenCalledWith(job._id, {
        status: JobRunStatus.Failed,
        errorMessage: 'Cursor agent session expired',
      });
      expect(mockAddComment).toHaveBeenCalledWith(
        'TEST-123',
        expect.stringContaining('expired')
      );
    });

    it('does not update job when agent is still running', async () => {
      const job = createMockJob();
      mockFindRunningJobRuns.mockResolvedValueOnce([job]);
      mockGetAgentStatus.mockResolvedValueOnce({
        success: true,
        status: 'RUNNING',
      });

      const service = new CursorAgentStatusPollingService({
        jiraClient: mockJiraClient,
      });

      const result = await service.poll();

      expect(result.jobsProcessed).toBe(1);
      expect(mockUpdateJobRun).not.toHaveBeenCalled();
      expect(mockAddComment).not.toHaveBeenCalled();
    });

    it('does not update job when agent is still creating', async () => {
      const job = createMockJob();
      mockFindRunningJobRuns.mockResolvedValueOnce([job]);
      mockGetAgentStatus.mockResolvedValueOnce({
        success: true,
        status: 'CREATING',
      });

      const service = new CursorAgentStatusPollingService({
        jiraClient: mockJiraClient,
      });

      const result = await service.poll();

      expect(result.jobsProcessed).toBe(1);
      expect(mockUpdateJobRun).not.toHaveBeenCalled();
      expect(mockAddComment).not.toHaveBeenCalled();
    });

    it('processes multiple jobs and aggregates results', async () => {
      const job1 = createMockJob({ jiraTicketKey: 'TEST-1' });
      const job2 = createMockJob({ jiraTicketKey: 'TEST-2' });
      const job3 = createMockJob({
        jiraTicketKey: 'TEST-3',
        cursorAgentId: undefined,
      });

      mockFindRunningJobRuns.mockResolvedValueOnce([job1, job2, job3]);
      mockGetAgentStatus
        .mockResolvedValueOnce({ success: true, status: 'FINISHED' })
        .mockResolvedValueOnce({ success: true, status: 'RUNNING' });

      const service = new CursorAgentStatusPollingService({
        jiraClient: mockJiraClient,
      });

      const result = await service.poll();

      expect(result.jobsFound).toBe(3);
      expect(result.jobsProcessed).toBe(2);
      expect(result.jobsSkipped).toBe(1);
      expect(result.jobsErrored).toBe(0);
      expect(mockGetAgentStatus).toHaveBeenCalledTimes(2);
    });

    it('handles errors in individual job processing', async () => {
      const job = createMockJob();
      mockFindRunningJobRuns.mockResolvedValueOnce([job]);
      mockGetAgentStatus.mockResolvedValueOnce({
        success: true,
        status: 'FINISHED',
      });
      mockUpdateJobRun.mockRejectedValueOnce(new Error('Database error'));

      const service = new CursorAgentStatusPollingService({
        jiraClient: mockJiraClient,
      });

      const result = await service.poll();

      expect(result.jobsErrored).toBe(1);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain('Database error');
    });

    it('uses createdAt for TTL check when startedAt is not available', async () => {
      const oldCreatedTime = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
      const job = createMockJob({
        createdAt: oldCreatedTime,
        startedAt: undefined,
      });

      mockFindRunningJobRuns.mockResolvedValueOnce([job]);
      mockGetAgentStatus.mockResolvedValueOnce({
        success: true,
        status: 'CREATING',
      });

      const service = new CursorAgentStatusPollingService({
        jiraClient: mockJiraClient,
        ttlMinutes: 120,
      });

      const result = await service.poll();

      expect(result.jobsProcessed).toBe(1);
      expect(mockUpdateJobRun).toHaveBeenCalledWith(job._id, {
        status: JobRunStatus.FailedTimeout,
        errorMessage: 'Job exceeded maximum runtime',
      });
    });
  });

  describe('runAsJob()', () => {
    it('connects to database, runs polling, and disconnects', async () => {
      mockValidateConfig.mockReturnValueOnce(null);
      mockConnect.mockResolvedValueOnce(undefined);
      mockFindRunningJobRuns.mockResolvedValueOnce([]);
      mockDisconnect.mockResolvedValueOnce(undefined);

      const service = new CursorAgentStatusPollingService({
        jiraClient: mockJiraClient,
      });

      await service.runAsJob();

      expect(mockValidateConfig).toHaveBeenCalled();
      expect(mockConnect).toHaveBeenCalled();
      expect(mockFindRunningJobRuns).toHaveBeenCalled();
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('disconnects even when polling fails', async () => {
      mockValidateConfig.mockReturnValueOnce(null);
      mockConnect.mockResolvedValueOnce(undefined);
      mockFindRunningJobRuns.mockRejectedValueOnce(
        new Error('DB query failed')
      );
      mockDisconnect.mockResolvedValueOnce(undefined);

      const service = new CursorAgentStatusPollingService({
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
      mockFindRunningJobRuns.mockResolvedValueOnce([job]);
      mockGetAgentStatus.mockResolvedValueOnce({
        success: true,
        status: 'FINISHED',
      });
      mockUpdateJobRun.mockRejectedValueOnce(new Error('Update failed'));
      mockDisconnect.mockResolvedValueOnce(undefined);

      const service = new CursorAgentStatusPollingService({
        jiraClient: mockJiraClient,
      });

      const originalExitCode = process.exitCode;

      await service.runAsJob();

      expect(process.exitCode).toBe(1);
      expect(mockDisconnect).toHaveBeenCalled();

      process.exitCode = originalExitCode;
    });

    it('does not set exit code for skipped jobs', async () => {
      const jobWithoutAgent = createMockJob({ cursorAgentId: undefined });

      mockValidateConfig.mockReturnValueOnce(null);
      mockConnect.mockResolvedValueOnce(undefined);
      mockFindRunningJobRuns.mockResolvedValueOnce([jobWithoutAgent]);
      mockDisconnect.mockResolvedValueOnce(undefined);

      const service = new CursorAgentStatusPollingService({
        jiraClient: mockJiraClient,
      });

      const originalExitCode = process.exitCode;
      process.exitCode = undefined;

      await service.runAsJob();

      expect(process.exitCode).toBeUndefined();
      expect(mockDisconnect).toHaveBeenCalled();

      process.exitCode = originalExitCode;
    });

    it('exits early with error code when config validation fails', async () => {
      mockValidateConfig.mockReturnValueOnce(['Missing JIRA_URL']);

      const service = new CursorAgentStatusPollingService({
        jiraClient: mockJiraClient,
      });

      const originalExitCode = process.exitCode;

      await service.runAsJob();

      expect(process.exitCode).toBe(1);
      expect(mockConnect).not.toHaveBeenCalled();

      process.exitCode = originalExitCode;
    });
  });

  describe('TTL configuration', () => {
    it('uses default TTL of 120 minutes', async () => {
      // Job started 119 minutes ago - should NOT timeout
      const recentJob = createMockJob({
        startedAt: new Date(Date.now() - 119 * 60 * 1000),
      });

      mockFindRunningJobRuns.mockResolvedValueOnce([recentJob]);
      mockGetAgentStatus.mockResolvedValueOnce({
        success: true,
        status: 'RUNNING',
      });

      const service = new CursorAgentStatusPollingService({
        jiraClient: mockJiraClient,
      });

      await service.poll();

      expect(mockUpdateJobRun).not.toHaveBeenCalled();
    });

    it('respects custom TTL configuration', async () => {
      // Job started 31 minutes ago - should timeout with 30 min TTL
      const job = createMockJob({
        startedAt: new Date(Date.now() - 31 * 60 * 1000),
      });

      mockFindRunningJobRuns.mockResolvedValueOnce([job]);
      mockGetAgentStatus.mockResolvedValueOnce({
        success: true,
        status: 'RUNNING',
      });

      const service = new CursorAgentStatusPollingService({
        jiraClient: mockJiraClient,
        ttlMinutes: 30,
      });

      await service.poll();

      expect(mockUpdateJobRun).toHaveBeenCalledWith(job._id, {
        status: JobRunStatus.FailedTimeout,
        errorMessage: 'Job exceeded maximum runtime',
      });
    });
  });
});
