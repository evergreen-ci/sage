import { LogTypes } from 'types/parsley';
import { logMetadataSchema } from './logMetadata';

describe('logMetadataSchema (discriminated union)', () => {
  describe('EVERGREEN_TASK_FILE', () => {
    it('passes when required fields are present', () => {
      const result = logMetadataSchema.safeParse({
        log_type: LogTypes.EVERGREEN_TASK_FILE,
        task_id: 'task-123',
        execution: 0, // min(0) per current schema
      });
      expect(result.success).toBe(true);
    });

    it('fails when task_id is missing', () => {
      const result = logMetadataSchema.safeParse({
        log_type: LogTypes.EVERGREEN_TASK_FILE,
        execution: 0,
      } as unknown);
      expect(result.success).toBe(false);
    });

    it('fails when execution is negative', () => {
      const result = logMetadataSchema.safeParse({
        log_type: LogTypes.EVERGREEN_TASK_FILE,
        task_id: 't',
        execution: -1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('EVERGREEN_TASK_LOGS', () => {
    it('passes when origin is provided', () => {
      const result = logMetadataSchema.safeParse({
        log_type: LogTypes.EVERGREEN_TASK_LOGS,
        task_id: 'task-123',
        execution: 1,
        origin: 'agent',
      });
      expect(result.success).toBe(true);
    });

    it('fails when origin is missing', () => {
      const result = logMetadataSchema.safeParse({
        log_type: LogTypes.EVERGREEN_TASK_LOGS,
        task_id: 'task-123',
        execution: 1,
      } as unknown);
      expect(result.success).toBe(false);
    });

    it('fails when origin is empty', () => {
      const result = logMetadataSchema.safeParse({
        log_type: LogTypes.EVERGREEN_TASK_LOGS,
        task_id: 'task-123',
        execution: 1,
        origin: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('EVERGREEN_TEST_LOGS', () => {
    it('passes when test_id is provided', () => {
      const result = logMetadataSchema.safeParse({
        log_type: LogTypes.EVERGREEN_TEST_LOGS,
        task_id: 'task-123',
        execution: 2,
        test_id: 'my/test/name',
      });
      expect(result.success).toBe(true);
    });

    it('fails when test_id is missing', () => {
      const result = logMetadataSchema.safeParse({
        log_type: LogTypes.EVERGREEN_TEST_LOGS,
        task_id: 'task-123',
        execution: 2,
      } as unknown);
      expect(result.success).toBe(false);
    });

    it('fails when test_id is empty', () => {
      const result = logMetadataSchema.safeParse({
        log_type: LogTypes.EVERGREEN_TEST_LOGS,
        task_id: 'task-123',
        execution: 2,
        test_id: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('type errors and union discrimination', () => {
    it('fails when execution is not a number', () => {
      const result = logMetadataSchema.safeParse({
        log_type: LogTypes.EVERGREEN_TASK_FILE,
        task_id: 't',
        execution: '1', // wrong type
      } as unknown);
      expect(result.success).toBe(false);
    });

    it('fails when required field for log_type is wrong', () => {
      const result = logMetadataSchema.safeParse({
        log_type: LogTypes.EVERGREEN_TASK_LOGS,
        task_id: 't',
        execution: 1,
        test_id: 'x', // doesn't match schema, should have origin
      } as unknown);
      expect(result.success).toBe(false);
    });

    it('fails on unknown log_type', () => {
      const result = logMetadataSchema.safeParse({
        log_type: 'NOT_A_REAL_TYPE',
        task_id: 't',
        execution: 1,
      } as unknown);
      expect(result.success).toBe(false);
    });
  });
});
