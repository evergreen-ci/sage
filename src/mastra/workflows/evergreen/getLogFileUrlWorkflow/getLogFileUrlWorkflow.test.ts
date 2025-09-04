import { RuntimeContext } from '@mastra/core/runtime-context';
import { z } from 'zod';
import { USER_ID } from 'mastra/agents/constants';
import { expectSuccess } from 'test-utils/workflow-helpers';
import { LogTypes } from '../../../../types/parsley';
import getLogFileUrlWorkflow from '.';

const mockGetTasksTool = vi.fn();
vi.mock('../../../tools/evergreen', () => ({
  getTaskTestsTool: {
    outputSchema: z.any(),
    execute: (...args: any[]) => mockGetTasksTool(...args),
  },
}));

const startRun = async (logMetadata: any) => {
  const runtimeContext = new RuntimeContext();
  runtimeContext.set(USER_ID, 'test_user');
  const run = getLogFileUrlWorkflow.createRun({});
  const wr = await run.start({ inputData: { logMetadata }, runtimeContext });
  console.log('wr', wr);
  return wr;
};

describe('getLogFileUrlWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('success: EVERGREEN_TASK_FILE returns a URL', async () => {
    const meta = {
      log_type: LogTypes.EVERGREEN_TASK_FILE,
      task_id: 't-file-1',
      execution: 7,
      fileName: 'agent.log',
    };

    const wr = await startRun(meta);

    expectSuccess(wr);
    expect(wr.result).toMatch(/^https?:\/\//);
    expect(wr.result).toContain('t-file-1');
    expect(wr.result).toContain('7');
  });

  it('success: EVERGREEN_TASK_LOGS returns a URL', async () => {
    const meta = {
      log_type: LogTypes.EVERGREEN_TASK_LOGS,
      task_id: 't-logs-1',
      execution: 3,
      origin: 'agent',
    };

    const wr = await startRun(meta);

    expectSuccess(wr);
    expect(wr.result).toMatch(/^https?:\/\//);
    expect(wr.result).toContain('t-logs-1');
    expect(wr.result).toContain('3');
  });

  it('success: EVERGREEN_TEST_LOGS returns raw test log URL', async () => {
    const meta = {
      log_type: LogTypes.EVERGREEN_TEST_LOGS,
      task_id: 't-test-1',
      execution: 0,
      test_id: 'myTestId',
      group_id: 'g1',
    };

    mockGetTasksTool.mockResolvedValueOnce({
      task: {
        id: 't-test-1',
        execution: 0,
        tests: {
          filteredTestCount: 1,
          totalTestCount: 1,
          testResults: [
            {
              id: 'myTestId',
              status: 'pass',
              testFile: 'foo.js',
              logs: {
                urlParsley: 'https://parsley/ui',
                urlRaw: 'https://example/raw/log.txt',
              },
            },
          ],
        },
      },
    });

    const wr = await startRun(meta);

    // optional sanity check that we passed through variables shape you expect
    expect(mockGetTasksTool).toHaveBeenCalled();

    expectSuccess(wr);
    expect(wr.result).toBe('https://example/raw/log.txt');
  });

  it('failed: test result with given test_id not found', async () => {
    const meta = {
      log_type: LogTypes.EVERGREEN_TEST_LOGS,
      task_id: 't-missing',
      execution: 1,
      test_id: 'missing-id',
    };

    mockGetTasksTool.mockResolvedValueOnce({
      task: {
        id: 't-missing',
        execution: 1,
        tests: {
          filteredTestCount: 1,
          totalTestCount: 1,
          testResults: [
            {
              id: 'different-id',
              status: 'fail',
              testFile: 'x',
              logs: { urlRaw: 'y' },
            },
          ],
        },
      },
    });

    const wr = await startRun(meta);

    expect(wr.status).toBe('failed');
  });

  it('failed: logs are null so no urlRaw available', async () => {
    const meta = {
      log_type: LogTypes.EVERGREEN_TEST_LOGS,
      task_id: 't-null-logs',
      execution: 2,
      test_id: 'target',
    };

    mockGetTasksTool.mockResolvedValueOnce({
      task: {
        id: 't-null-logs',
        execution: 2,
        tests: {
          filteredTestCount: 1,
          totalTestCount: 1,
          testResults: [
            {
              id: 'target',
              status: 'fail',
              testFile: 'foo',
              logs: null,
            },
          ],
        },
      },
    });

    const wr = await startRun(meta);
    expect(wr.status).toBe('failed');
  });

  it('failed: invalid log metadata at validation step', async () => {
    const invalid = {
      log_type: LogTypes.EVERGREEN_TASK_FILE,
      task_id: 'tX',
      // execution and fileName missing
    };

    const wr = await startRun(invalid);
    expect(wr.status).toBe('failed');
  });
});
