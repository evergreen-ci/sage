import { RuntimeContext } from '@mastra/core/runtime-context';
import { z } from 'zod';
import { USER_ID } from '@/mastra/agents/constants';
import { expectSuccess } from '@/test-utils/workflow-helpers';
import getImageByDistroWorkflow from './getImageByDistroWorkflow';

const mockGetDistroTool = vi.fn();
const mockGetImageTool = vi.fn();

vi.mock('../../tools/evergreen', () => ({
  getDistroTool: {
    outputSchema: z.any(),
    execute: (...args: any[]) => mockGetDistroTool(...args),
  },
  getImageTool: {
    outputSchema: z.any(),
    execute: (...args: any[]) => mockGetImageTool(...args),
  },
}));

const startRun = async (distroId: string) => {
  const runtimeContext = new RuntimeContext();
  runtimeContext.set(USER_ID, 'test_user');
  const run = await getImageByDistroWorkflow.createRunAsync({});
  const wr = await run.start({ inputData: { distroId }, runtimeContext });
  return wr;
};

describe('getImageByDistroWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

    const wr = await startRun('ubuntu2204-small');

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
  });

  it('success: handles image with no events', async () => {
    const mockDistroData = {
      distro: {
        name: 'ubuntu2204-small',
        imageId: 'image-new',
        arch: 'linux_amd64',
        provider: 'ec2',
        disabled: false,
      },
    };

    const mockImageData = {
      image: {
        id: 'image-new',
        ami: 'ami-new123',
        lastDeployed: new Date('2024-01-20T10:00:00Z'),
        distros: [],
        events: {
          count: 0,
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

    const wr = await startRun('ubuntu2204-small');

    expectSuccess(wr);
    expect(wr.result.image).toBeDefined();
    const image = wr.result.image!;
    expect(image.id).toBe('image-new');
    expect(image.events.eventLogEntries).toHaveLength(0);
  });

  it('failed: distro data is missing', async () => {
    mockGetDistroTool.mockResolvedValueOnce({
      distro: null,
    });

    const wr = await startRun('nonexistent-distro');

    expect(wr.status).toBe('failed');
  });

  it('failed: distro.imageId is missing', async () => {
    // Mock a distro with empty string imageId (which would fail validation)
    mockGetDistroTool.mockResolvedValueOnce({
      distro: {
        name: 'ubuntu2204-small',
        imageId: '',
        arch: 'linux_amd64',
        provider: 'ec2',
        disabled: false,
      },
    });

    const wr = await startRun('ubuntu2204-small');

    expect(wr.status).toBe('failed');
  });

  it('failed: getDistroTool throws error', async () => {
    mockGetDistroTool.mockRejectedValueOnce(new Error('Distro not found'));

    const wr = await startRun('invalid-distro');

    expect(wr.status).toBe('failed');
  });

  it('failed: getImageTool throws error', async () => {
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

    const wr = await startRun('ubuntu2204-small');

    expect(wr.status).toBe('failed');
  });

  it('failed: invalid input - missing distroId', async () => {
    const runtimeContext = new RuntimeContext();
    runtimeContext.set(USER_ID, 'test_user');
    const run = await getImageByDistroWorkflow.createRunAsync({});
    const wr = await run.start({
      inputData: {}, // missing distroId
      runtimeContext,
    });

    expect(wr.status).toBe('failed');
  });
});
