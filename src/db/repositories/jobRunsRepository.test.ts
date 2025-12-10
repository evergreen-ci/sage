import { ObjectId } from 'mongodb';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { JobRunStatus } from '@/db/types';
// Import after mocking
import * as jobRunsRepository from './jobRunsRepository';

// Mock the db module
const mockCollection = {
  createIndex: vi.fn().mockResolvedValue('index_name'),
  insertOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
};

vi.mock('@/db/connection', () => ({
  db: {
    getClient: () => ({
      db: () => ({
        collection: () => mockCollection,
      }),
    }),
  },
}));

vi.mock('@/config', () => ({
  config: {
    db: {
      dbName: 'test_db',
    },
  },
}));

vi.mock('@/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('jobRunsRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ensureIndexes', () => {
    it('creates the required indexes', async () => {
      await jobRunsRepository.ensureIndexes();

      expect(mockCollection.createIndex).toHaveBeenCalledTimes(3);
      expect(mockCollection.createIndex).toHaveBeenCalledWith(
        { jiraTicketKey: 1 },
        { name: 'jiraTicketKey_idx' }
      );
      expect(mockCollection.createIndex).toHaveBeenCalledWith(
        { cursorAgentId: 1 },
        { name: 'cursorAgentId_idx', sparse: true }
      );
      expect(mockCollection.createIndex).toHaveBeenCalledWith(
        { status: 1 },
        { name: 'status_idx' }
      );
    });
  });

  describe('createJobRun', () => {
    it('creates a job run with pending status', async () => {
      const insertedId = new ObjectId();
      mockCollection.insertOne.mockResolvedValueOnce({ insertedId });

      const result = await jobRunsRepository.createJobRun({
        jiraTicketKey: 'PROJ-123',
        initiatedBy: 'user@example.com',
      });

      expect(result).toMatchObject({
        jiraTicketKey: 'PROJ-123',
        initiatedBy: 'user@example.com',
        status: JobRunStatus.Pending,
        _id: insertedId,
      });
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(mockCollection.insertOne).toHaveBeenCalled();
    });

    it('includes metadata if provided', async () => {
      const insertedId = new ObjectId();
      mockCollection.insertOne.mockResolvedValueOnce({ insertedId });

      const metadata = { source: 'slack', channel: '#dev' };
      const result = await jobRunsRepository.createJobRun({
        jiraTicketKey: 'PROJ-456',
        initiatedBy: 'user@example.com',
        metadata,
      });

      expect(result.metadata).toEqual(metadata);
    });
  });

  describe('updateJobRunStatus', () => {
    it('sets status to Running with startedAt timestamp', async () => {
      const id = new ObjectId();
      mockCollection.findOneAndUpdate.mockResolvedValueOnce({
        _id: id,
        status: JobRunStatus.Running,
      });

      await jobRunsRepository.updateJobRunStatus(id, JobRunStatus.Running);

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: id },
        {
          $set: expect.objectContaining({
            status: JobRunStatus.Running,
            startedAt: expect.any(Date),
            updatedAt: expect.any(Date),
          }),
        },
        { returnDocument: 'after' }
      );
    });

    it('sets status to Completed with completedAt timestamp', async () => {
      const id = new ObjectId();
      mockCollection.findOneAndUpdate.mockResolvedValueOnce({
        _id: id,
        status: JobRunStatus.Completed,
      });

      await jobRunsRepository.updateJobRunStatus(id, JobRunStatus.Completed);

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: id },
        {
          $set: expect.objectContaining({
            status: JobRunStatus.Completed,
            completedAt: expect.any(Date),
            updatedAt: expect.any(Date),
          }),
        },
        { returnDocument: 'after' }
      );
    });

    it('sets status to Failed with error message and completedAt', async () => {
      const id = new ObjectId();
      const errorMessage = 'Something went wrong';
      mockCollection.findOneAndUpdate.mockResolvedValueOnce({
        _id: id,
        status: JobRunStatus.Failed,
        errorMessage,
      });

      await jobRunsRepository.updateJobRunStatus(
        id,
        JobRunStatus.Failed,
        errorMessage
      );

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: id },
        {
          $set: expect.objectContaining({
            status: JobRunStatus.Failed,
            errorMessage,
            completedAt: expect.any(Date),
            updatedAt: expect.any(Date),
          }),
        },
        { returnDocument: 'after' }
      );
    });

    it('sets status to Cancelled with completedAt', async () => {
      const id = new ObjectId();
      mockCollection.findOneAndUpdate.mockResolvedValueOnce({
        _id: id,
        status: JobRunStatus.Cancelled,
      });

      await jobRunsRepository.updateJobRunStatus(id, JobRunStatus.Cancelled);

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: id },
        {
          $set: expect.objectContaining({
            status: JobRunStatus.Cancelled,
            completedAt: expect.any(Date),
            updatedAt: expect.any(Date),
          }),
        },
        { returnDocument: 'after' }
      );
    });

    it('accepts string ID and converts to ObjectId', async () => {
      const id = new ObjectId();
      mockCollection.findOneAndUpdate.mockResolvedValueOnce({
        _id: id,
        status: JobRunStatus.Running,
      });

      await jobRunsRepository.updateJobRunStatus(
        id.toString(),
        JobRunStatus.Running
      );

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        expect.any(Object),
        { returnDocument: 'after' }
      );
    });

    it('returns null if job run not found', async () => {
      mockCollection.findOneAndUpdate.mockResolvedValueOnce(null);

      const result = await jobRunsRepository.updateJobRunStatus(
        new ObjectId(),
        JobRunStatus.Running
      );

      expect(result).toBeNull();
    });
  });
});
