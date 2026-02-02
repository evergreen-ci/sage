import { ObjectId } from 'mongodb';
import { db } from '@/db/connection';
import {
  createJobRun,
  ensureIndexes,
  findJobRunByTicketKey,
  findRunningJobRuns,
  updateJobRun,
} from '@/db/repositories/jobRunsRepository';
import { JobRunStatus } from '@/db/types';
import {
  cleanupTestJobRuns,
  createTestJobRunInput,
  dropCollectionIndexes,
  generateTestTicketKey,
  getCollectionIndexes,
  JOB_RUNS_COLLECTION_NAME,
  TEST_PREFIX,
} from './helpers';

beforeAll(async () => {
  await db.connect();
});

afterAll(async () => {
  await cleanupTestJobRuns();
  await db.disconnect();
});

afterEach(async () => {
  await cleanupTestJobRuns();
});

describe('jobRunsRepository', () => {
  describe('ensureIndexes', () => {
    it('should create all required indexes and be idempotent', async () => {
      await dropCollectionIndexes(JOB_RUNS_COLLECTION_NAME);

      await ensureIndexes();
      await ensureIndexes(); // Should not throw on second call

      const indexes = await getCollectionIndexes(JOB_RUNS_COLLECTION_NAME);
      expect(indexes).toContain('jiraTicketKey_idx');
      expect(indexes).toContain('cursorAgentId_idx');
      expect(indexes).toContain('status_idx');
    });
  });

  describe('createJobRun', () => {
    it('should create a job run with correct initial state', async () => {
      const input = createTestJobRunInput({
        assignee: null,
        metadata: { test: true },
      });

      const result = await createJobRun(input);

      expect(result._id).toBeInstanceOf(ObjectId);
      expect(result.jiraTicketKey).toBe(input.jiraTicketKey);
      expect(result.status).toBe(JobRunStatus.Pending);
      expect(result.assignee).toBeNull();
      expect(result.metadata).toEqual({ test: true });
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.startedAt).toBeUndefined();
      expect(result.completedAt).toBeUndefined();
    });
  });

  describe('updateJobRun', () => {
    it('should set startedAt when status changes to Running', async () => {
      const jobRun = await createJobRun(createTestJobRunInput());

      const updated = await updateJobRun(jobRun._id!, {
        status: JobRunStatus.Running,
      });

      expect(updated!.status).toBe(JobRunStatus.Running);
      expect(updated!.startedAt).toBeInstanceOf(Date);
      expect(updated!.completedAt).toBeUndefined();
    });

    it('should set completedAt for terminal statuses', async () => {
      const statuses = [
        JobRunStatus.Completed,
        JobRunStatus.Failed,
        JobRunStatus.FailedTimeout,
        JobRunStatus.Cancelled,
      ];

      const jobRuns = await Promise.all(
        statuses.map(() => createJobRun(createTestJobRunInput()))
      );

      const updates = await Promise.all(
        jobRuns.map((jobRun, i) =>
          updateJobRun(jobRun._id!, { status: statuses[i] })
        )
      );

      updates.forEach(updated => {
        expect(updated!.completedAt).toBeInstanceOf(Date);
      });
    });

    it('should update cursorAgentId and errorMessage', async () => {
      const jobRun = await createJobRun(createTestJobRunInput());

      const updated = await updateJobRun(jobRun._id!, {
        cursorAgentId: 'agent-123',
        status: JobRunStatus.Failed,
        errorMessage: 'Test error',
      });

      expect(updated!.cursorAgentId).toBe('agent-123');
      expect(updated!.errorMessage).toBe('Test error');
    });

    it('should return null for non-existent ID', async () => {
      const updated = await updateJobRun(new ObjectId(), {
        status: JobRunStatus.Running,
      });
      expect(updated).toBeNull();
    });
  });

  describe('findJobRunByTicketKey', () => {
    it('should return most recent job run for ticket key', async () => {
      const ticketKey = generateTestTicketKey('find-test');

      await createJobRun(createTestJobRunInput({ jiraTicketKey: ticketKey }));
      await new Promise(resolve => setTimeout(resolve, 10));
      const secondJob = await createJobRun(
        createTestJobRunInput({ jiraTicketKey: ticketKey })
      );

      const found = await findJobRunByTicketKey(ticketKey);

      expect(found!._id!.toString()).toBe(secondJob._id!.toString());
    });

    it('should return null for non-existent ticket key', async () => {
      const found = await findJobRunByTicketKey('NONEXISTENT-99999');
      expect(found).toBeNull();
    });
  });

  describe('findRunningJobRuns', () => {
    it('should find only running jobs sorted by startedAt', async () => {
      const job1 = await createJobRun(createTestJobRunInput());
      const job2 = await createJobRun(createTestJobRunInput());
      const completedJob = await createJobRun(createTestJobRunInput());

      await updateJobRun(job1._id!, { status: JobRunStatus.Running });
      await new Promise(resolve => setTimeout(resolve, 10));
      await updateJobRun(job2._id!, { status: JobRunStatus.Running });
      await updateJobRun(completedJob._id!, { status: JobRunStatus.Completed });

      const result = await findRunningJobRuns();
      const testJobs = result.filter(job =>
        job.jiraTicketKey.startsWith(TEST_PREFIX.ticketKey)
      );

      expect(testJobs).toHaveLength(2);
      expect(testJobs[0]._id!.toString()).toBe(job1._id!.toString());
      expect(testJobs[1]._id!.toString()).toBe(job2._id!.toString());
    });
  });
});
