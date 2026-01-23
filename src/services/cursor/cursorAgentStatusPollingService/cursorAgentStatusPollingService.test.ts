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
      const jobWithoutAgentId = createMockJob({ cursorAgentId: undefined });
      const jobWithoutAssignee = createMockJob({
        jiraTicketKey: 'TEST-456',
        assignee: null,
      });

      mockFindRunningJobRuns.mockResolvedValueOnce([
        jobWithoutAgentId,
        jobWithoutAssignee,
      ]);

      const service = new CursorAgentStatusPollingService({
        jiraClient: mockJiraClient,
      });

      const result = await service.poll();

      expect(result.jobsFound).toBe(2);
      expect(result.jobsSkipped).toBe(2);
      expect(result.results[0].skipReason).toContain('Missing cursor agent');
      expect(mockGetAgentStatus).not.toHaveBeenCalled();
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
      expect(result.results[0].skipReason).toContain('API error');
      expect(mockUpdateJobRun).not.toHaveBeenCalled();
    });

    it('marks job as timed out when TTL exceeded and agent still running', async () => {
      const oldStartTime = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
      const job = createMockJob({ startedAt: oldStartTime });

      mockFindRunningJobRuns.mockResolvedValueOnce([job]);
      mockGetAgentStatus.mockResolvedValueOnce({
        success: true,
        status: 'RUNNING',
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
      expect(mockAddComment).toHaveBeenCalledWith(
        'TEST-123',
        expect.stringContaining('timed out')
      );
    });

    it('does not timeout completed agents even if TTL exceeded', async () => {
      const oldStartTime = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const job = createMockJob({ startedAt: oldStartTime });

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
    });

    it('updates job status based on agent completion states', async () => {
      const finishedJob = createMockJob({ jiraTicketKey: 'TEST-1' });
      const errorJob = createMockJob({ jiraTicketKey: 'TEST-2' });
      const expiredJob = createMockJob({ jiraTicketKey: 'TEST-3' });

      mockFindRunningJobRuns.mockResolvedValueOnce([
        finishedJob,
        errorJob,
        expiredJob,
      ]);
      mockGetAgentStatus
        .mockResolvedValueOnce({
          success: true,
          status: 'FINISHED',
          prUrl: 'https://github.com/org/repo/pull/456',
        })
        .mockResolvedValueOnce({ success: true, status: 'ERROR' })
        .mockResolvedValueOnce({ success: true, status: 'EXPIRED' });

      const service = new CursorAgentStatusPollingService({
        jiraClient: mockJiraClient,
      });

      const result = await service.poll();

      expect(result.jobsProcessed).toBe(3);
      expect(mockUpdateJobRun).toHaveBeenCalledWith(finishedJob._id, {
        status: JobRunStatus.Completed,
      });
      expect(mockUpdateJobRun).toHaveBeenCalledWith(errorJob._id, {
        status: JobRunStatus.Failed,
        errorMessage: 'Cursor agent encountered an error',
      });
      expect(mockUpdateJobRun).toHaveBeenCalledWith(expiredJob._id, {
        status: JobRunStatus.Failed,
        errorMessage: 'Cursor agent session expired',
      });
      expect(mockAddComment).toHaveBeenCalledTimes(3);
    });

    it('does not update job when agent is still in progress', async () => {
      const runningJob = createMockJob({ jiraTicketKey: 'TEST-1' });
      const creatingJob = createMockJob({ jiraTicketKey: 'TEST-2' });

      mockFindRunningJobRuns.mockResolvedValueOnce([runningJob, creatingJob]);
      mockGetAgentStatus
        .mockResolvedValueOnce({ success: true, status: 'RUNNING' })
        .mockResolvedValueOnce({ success: true, status: 'CREATING' });

      const service = new CursorAgentStatusPollingService({
        jiraClient: mockJiraClient,
      });

      const result = await service.poll();

      expect(result.jobsProcessed).toBe(2);
      expect(mockUpdateJobRun).not.toHaveBeenCalled();
      expect(mockAddComment).not.toHaveBeenCalled();
    });

    it('handles errors in individual job processing and continues', async () => {
      const job1 = createMockJob({ jiraTicketKey: 'TEST-1' });
      const job2 = createMockJob({ jiraTicketKey: 'TEST-2' });

      mockFindRunningJobRuns.mockResolvedValueOnce([job1, job2]);
      mockGetAgentStatus
        .mockResolvedValueOnce({ success: true, status: 'FINISHED' })
        .mockResolvedValueOnce({ success: true, status: 'RUNNING' });
      mockUpdateJobRun.mockRejectedValueOnce(new Error('Database error'));

      const service = new CursorAgentStatusPollingService({
        jiraClient: mockJiraClient,
      });

      const result = await service.poll();

      expect(result.jobsErrored).toBe(1);
      expect(result.jobsProcessed).toBe(1);
      expect(result.results[0].error).toContain('Database error');
    });

    it('throws error when database query fails', async () => {
      mockFindRunningJobRuns.mockRejectedValueOnce(
        new Error('Connection failed')
      );

      const service = new CursorAgentStatusPollingService({
        jiraClient: mockJiraClient,
      });

      await expect(service.poll()).rejects.toThrow('Connection failed');
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
  });
});
