import { RuntimeContext } from '@mastra/core/runtime-context';
import { z } from 'zod';
import { USER_ID } from '@/mastra/agents/constants';
import { expectSuccess } from '@/test-utils/workflow-helpers';
import getImageWorkflow from './getImageWorkflow';

const mockGetTaskTool = vi.fn();
const mockGetDistroTool = vi.fn();
const mockGetImageTool = vi.fn();

vi.mock('../../tools/evergreen', () => ({
  getTaskTool: {
    outputSchema: z.any(),
    execute: (...args: any[]) => mockGetTaskTool(...args),
  },
  getDistroTool: {
    outputSchema: z.any(),
    execute: (...args: any[]) => mockGetDistroTool(...args),
  },
  getImageTool: {
    outputSchema: z.any(),
    execute: (...args: any[]) => mockGetImageTool(...args),
  },
}));

const startRun = async (inputData: any, logMetadata?: any) => {
  const runtimeContext = new RuntimeContext();
  runtimeContext.set(USER_ID, 'test_user');
  if (logMetadata) {
    runtimeContext.set('logMetadata', logMetadata);
  }
  const run = await getImageWorkflow.createRunAsync({});
  const wr = await run.start({ inputData, runtimeContext });
  return wr;
};

describe('getImageWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('with distroId', () => {
    it('success: returns full image data from distroId', async () => {
      const mockDistroData = {
        distro: {
          name: 'ubuntu2204-small',
          imageId: 'image-123',
          arch: 'linux_amd64',
          provider: 'ec2',
          disabled: false,
        },
      };

      const mockImageData = {
        image: {
          id: 'image-123',
          ami: 'ami-abc123',
          lastDeployed: new Date('2024-01-15T10:00:00Z'),
          distros: [{ name: 'ubuntu2204-small', arch: 'linux_amd64' }],
          events: {
            count: 2,
            eventLogEntries: [
              {
                timestamp: new Date('2024-01-15T10:00:00Z'),
                amiAfter: 'ami-abc123',
                amiBefore: 'ami-xyz789',
                entries: [
                  {
                    type: 'PACKAGE',
                    action: 'UPDATED',
                    name: 'nodejs',
                    before: '18.0.0',
                    after: '20.0.0',
                  },
                ],
              },
            ],
          },
          packages: {
            data: [
              { name: 'nodejs', manager: 'apt', version: '20.0.0' },
              { name: 'python', manager: 'apt', version: '3.10.0' },
            ],
            filteredCount: 2,
            totalCount: 2,
          },
          toolchains: {
            data: [{ name: 'gcc', path: '/usr/bin/gcc', version: '11.2.0' }],
            filteredCount: 1,
            totalCount: 1,
          },
          operatingSystem: {
            data: [{ name: 'Ubuntu', version: '22.04' }],
            filteredCount: 1,
            totalCount: 1,
          },
        },
      };

      mockGetDistroTool.mockResolvedValueOnce(mockDistroData);
      mockGetImageTool.mockResolvedValueOnce(mockImageData);

      const wr = await startRun({ distroId: 'ubuntu2204-small' });

      expectSuccess(wr);
      expect(wr.result).toBeDefined();
      expect(wr.result.image).toBeDefined();
      const image = wr.result.image!;
      expect(image.id).toBe('image-123');
      expect(image.ami).toBe('ami-abc123');
      expect(image.packages.data).toHaveLength(2);
      expect(image.toolchains.data).toHaveLength(1);
      expect(image.events.eventLogEntries).toHaveLength(1);
      expect(mockGetDistroTool).toHaveBeenCalled();
      expect(mockGetImageTool).toHaveBeenCalled();
      expect(mockGetTaskTool).not.toHaveBeenCalled();
    });
  });

  describe('with taskId', () => {
    it('success: returns full image data from taskId', async () => {
      const mockTaskData = {
        task: {
          id: 'task-123',
          displayName: 'test-task',
          displayStatus: 'success',
          execution: 0,
          patchNumber: 1,
          buildVariant: 'linux',
          projectIdentifier: 'project-1',
          requester: 'user',
          distroId: 'ubuntu2204-small',
          baseTask: null,
          versionMetadata: {
            id: 'version-1',
            isPatch: true,
            message: 'test',
            projectIdentifier: 'project-1',
            revision: 'abc123',
            projectMetadata: null,
          },
          details: null,
        },
      };

      const mockDistroData = {
        distro: {
          name: 'ubuntu2204-small',
          imageId: 'image-123',
          arch: 'linux_amd64',
          provider: 'ec2',
          disabled: false,
        },
      };

      const mockImageData = {
        image: {
          id: 'image-123',
          ami: 'ami-abc123',
          lastDeployed: new Date('2024-01-15T10:00:00Z'),
          distros: [{ name: 'ubuntu2204-small', arch: 'linux_amd64' }],
          events: {
            count: 1,
            eventLogEntries: [],
          },
          packages: {
            data: [],
            filteredCount: 0,
            totalCount: 0,
          },
          toolchains: {
            data: [],
            filteredCount: 0,
            totalCount: 0,
          },
          operatingSystem: {
            data: [],
            filteredCount: 0,
            totalCount: 0,
          },
        },
      };

      mockGetTaskTool.mockResolvedValueOnce(mockTaskData);
      mockGetDistroTool.mockResolvedValueOnce(mockDistroData);
      mockGetImageTool.mockResolvedValueOnce(mockImageData);

      const wr = await startRun({ taskId: 'task-123' });

      expectSuccess(wr);
      expect(wr.result).toBeDefined();
      expect(wr.result.image).toBeDefined();
      expect(mockGetTaskTool).toHaveBeenCalled();
      expect(mockGetDistroTool).toHaveBeenCalled();
      expect(mockGetImageTool).toHaveBeenCalled();
    });
  });

  describe('with runtimeContext logMetadata', () => {
    it('success: returns full image data from runtimeContext.task_id', async () => {
      const mockTaskData = {
        task: {
          id: 'task-from-context',
          displayName: 'test-task',
          displayStatus: 'success',
          execution: 1,
          patchNumber: 1,
          buildVariant: 'linux',
          projectIdentifier: 'project-1',
          requester: 'user',
          distroId: 'ubuntu2204-small',
          baseTask: null,
          versionMetadata: {
            id: 'version-1',
            isPatch: true,
            message: 'test',
            projectIdentifier: 'project-1',
            revision: 'abc123',
            projectMetadata: null,
          },
          details: null,
        },
      };

      const mockDistroData = {
        distro: {
          name: 'ubuntu2204-small',
          imageId: 'image-123',
          arch: 'linux_amd64',
          provider: 'ec2',
          disabled: false,
        },
      };

      const mockImageData = {
        image: {
          id: 'image-123',
          ami: 'ami-abc123',
          lastDeployed: new Date('2024-01-15T10:00:00Z'),
          distros: [{ name: 'ubuntu2204-small', arch: 'linux_amd64' }],
          events: {
            count: 1,
            eventLogEntries: [],
          },
          packages: {
            data: [],
            filteredCount: 0,
            totalCount: 0,
          },
          toolchains: {
            data: [],
            filteredCount: 0,
            totalCount: 0,
          },
          operatingSystem: {
            data: [],
            filteredCount: 0,
            totalCount: 0,
          },
        },
      };

      mockGetTaskTool.mockResolvedValueOnce(mockTaskData);
      mockGetDistroTool.mockResolvedValueOnce(mockDistroData);
      mockGetImageTool.mockResolvedValueOnce(mockImageData);

      const wr = await startRun(
        {},
        { task_id: 'task-from-context', execution: 1 }
      );

      expectSuccess(wr);
      expect(wr.result).toBeDefined();
      expect(wr.result.image).toBeDefined();
      expect(mockGetTaskTool).toHaveBeenCalled();
      const callArgs = mockGetTaskTool.mock.calls[0]![0];
      expect(callArgs.context.taskId).toBe('task-from-context');
      expect(callArgs.context.execution).toBe(1);
      expect(mockGetDistroTool).toHaveBeenCalled();
      expect(mockGetImageTool).toHaveBeenCalled();
    });

    it('success: uses execution from runtimeContext when not provided', async () => {
      const mockTaskData = {
        task: {
          id: 'task-from-context',
          displayName: 'test-task',
          displayStatus: 'success',
          execution: 2,
          patchNumber: 1,
          buildVariant: 'linux',
          projectIdentifier: 'project-1',
          requester: 'user',
          distroId: 'ubuntu2204-small',
          baseTask: null,
          versionMetadata: {
            id: 'version-1',
            isPatch: true,
            message: 'test',
            projectIdentifier: 'project-1',
            revision: 'abc123',
            projectMetadata: null,
          },
          details: null,
        },
      };

      const mockDistroData = {
        distro: {
          name: 'ubuntu2204-small',
          imageId: 'image-123',
          arch: 'linux_amd64',
          provider: 'ec2',
          disabled: false,
        },
      };

      const mockImageData = {
        image: {
          id: 'image-123',
          ami: 'ami-abc123',
          lastDeployed: new Date('2024-01-15T10:00:00Z'),
          distros: [{ name: 'ubuntu2204-small', arch: 'linux_amd64' }],
          events: {
            count: 1,
            eventLogEntries: [],
          },
          packages: {
            data: [],
            filteredCount: 0,
            totalCount: 0,
          },
          toolchains: {
            data: [],
            filteredCount: 0,
            totalCount: 0,
          },
          operatingSystem: {
            data: [],
            filteredCount: 0,
            totalCount: 0,
          },
        },
      };

      mockGetTaskTool.mockResolvedValueOnce(mockTaskData);
      mockGetDistroTool.mockResolvedValueOnce(mockDistroData);
      mockGetImageTool.mockResolvedValueOnce(mockImageData);

      const wr = await startRun(
        {},
        { task_id: 'task-from-context', execution: 2 }
      );

      expectSuccess(wr);
      expect(mockGetTaskTool).toHaveBeenCalled();
      const callArgs = mockGetTaskTool.mock.calls[0]![0];
      expect(callArgs.context.taskId).toBe('task-from-context');
      expect(callArgs.context.execution).toBe(2);
    });

    it('success: explicit taskId takes priority over runtimeContext', async () => {
      const mockTaskData = {
        task: {
          id: 'explicit-task',
          displayName: 'test-task',
          displayStatus: 'success',
          execution: 0,
          patchNumber: 1,
          buildVariant: 'linux',
          projectIdentifier: 'project-1',
          requester: 'user',
          distroId: 'ubuntu2204-small',
          baseTask: null,
          versionMetadata: {
            id: 'version-1',
            isPatch: true,
            message: 'test',
            projectIdentifier: 'project-1',
            revision: 'abc123',
            projectMetadata: null,
          },
          details: null,
        },
      };

      const mockDistroData = {
        distro: {
          name: 'ubuntu2204-small',
          imageId: 'image-123',
          arch: 'linux_amd64',
          provider: 'ec2',
          disabled: false,
        },
      };

      const mockImageData = {
        image: {
          id: 'image-123',
          ami: 'ami-abc123',
          lastDeployed: new Date('2024-01-15T10:00:00Z'),
          distros: [{ name: 'ubuntu2204-small', arch: 'linux_amd64' }],
          events: {
            count: 1,
            eventLogEntries: [],
          },
          packages: {
            data: [],
            filteredCount: 0,
            totalCount: 0,
          },
          toolchains: {
            data: [],
            filteredCount: 0,
            totalCount: 0,
          },
          operatingSystem: {
            data: [],
            filteredCount: 0,
            totalCount: 0,
          },
        },
      };

      mockGetTaskTool.mockResolvedValueOnce(mockTaskData);
      mockGetDistroTool.mockResolvedValueOnce(mockDistroData);
      mockGetImageTool.mockResolvedValueOnce(mockImageData);

      const wr = await startRun(
        { taskId: 'explicit-task' },
        { task_id: 'runtime-context-task', execution: 1 }
      );

      expectSuccess(wr);
      expect(mockGetTaskTool).toHaveBeenCalled();
      const callArgs = mockGetTaskTool.mock.calls[0]![0];
      expect(callArgs.context.taskId).toBe('explicit-task');
      // execution should come from runtimeContext when not explicitly provided
      expect(callArgs.context.execution).toBe(1);
    });

    it('success: explicit distroId takes highest priority', async () => {
      const mockDistroData = {
        distro: {
          name: 'ubuntu2204-small',
          imageId: 'image-123',
          arch: 'linux_amd64',
          provider: 'ec2',
          disabled: false,
        },
      };

      const mockImageData = {
        image: {
          id: 'image-123',
          ami: 'ami-abc123',
          lastDeployed: new Date('2024-01-15T10:00:00Z'),
          distros: [{ name: 'ubuntu2204-small', arch: 'linux_amd64' }],
          events: {
            count: 1,
            eventLogEntries: [],
          },
          packages: {
            data: [],
            filteredCount: 0,
            totalCount: 0,
          },
          toolchains: {
            data: [],
            filteredCount: 0,
            totalCount: 0,
          },
          operatingSystem: {
            data: [],
            filteredCount: 0,
            totalCount: 0,
          },
        },
      };

      mockGetDistroTool.mockResolvedValueOnce(mockDistroData);
      mockGetImageTool.mockResolvedValueOnce(mockImageData);

      const wr = await startRun(
        { distroId: 'ubuntu2204-small' },
        { task_id: 'runtime-context-task', execution: 1 }
      );

      expectSuccess(wr);
      expect(mockGetTaskTool).not.toHaveBeenCalled();
      expect(mockGetDistroTool).toHaveBeenCalled();
      expect(mockGetImageTool).toHaveBeenCalled();
    });
  });

  describe('error cases', () => {
    it('failed: missing both taskId and distroId', async () => {
      const wr = await startRun({});

      expect(wr.status).toBe('failed');
    });

    it('failed: missing taskId in both input and runtimeContext, and no distroId', async () => {
      const wr = await startRun({}, { execution: 1 });

      expect(wr.status).toBe('failed');
    });

    it('failed: task not found', async () => {
      mockGetTaskTool.mockRejectedValueOnce(new Error('Task not found'));

      const wr = await startRun({ taskId: 'nonexistent-task' });

      expect(wr.status).toBe('failed');
    });

    it('failed: task missing distroId', async () => {
      const mockTaskData = {
        task: {
          id: 'task-123',
          displayName: 'test-task',
          displayStatus: 'success',
          execution: 0,
          patchNumber: 1,
          buildVariant: 'linux',
          projectIdentifier: 'project-1',
          requester: 'user',
          distroId: '',
          baseTask: null,
          versionMetadata: {
            id: 'version-1',
            isPatch: true,
            message: 'test',
            projectIdentifier: 'project-1',
            revision: 'abc123',
            projectMetadata: null,
          },
          details: null,
        },
      };

      mockGetTaskTool.mockResolvedValueOnce(mockTaskData);

      const wr = await startRun({ taskId: 'task-123' });

      expect(wr.status).toBe('failed');
    });

    it('failed: distro not found', async () => {
      mockGetDistroTool.mockResolvedValueOnce({
        distro: null,
      });

      const wr = await startRun({ distroId: 'nonexistent-distro' });

      expect(wr.status).toBe('failed');
    });

    it('failed: distro missing imageId', async () => {
      mockGetDistroTool.mockResolvedValueOnce({
        distro: {
          name: 'ubuntu2204-small',
          imageId: '',
          arch: 'linux_amd64',
          provider: 'ec2',
          disabled: false,
        },
      });

      const wr = await startRun({ distroId: 'ubuntu2204-small' });

      expect(wr.status).toBe('failed');
    });

    it('failed: image not found', async () => {
      const mockDistroData = {
        distro: {
          name: 'ubuntu2204-small',
          imageId: 'image-123',
          arch: 'linux_amd64',
          provider: 'ec2',
          disabled: false,
        },
      };

      mockGetDistroTool.mockResolvedValueOnce(mockDistroData);
      mockGetImageTool.mockRejectedValueOnce(new Error('Image not found'));

      const wr = await startRun({ distroId: 'ubuntu2204-small' });

      expect(wr.status).toBe('failed');
    });
  });
});
