import { RuntimeContext } from '@mastra/core/runtime-context';
import { z } from 'zod';
import { USER_ID } from '@/mastra/agents/constants';
import { expectSuccess } from '@/test-utils/workflow-helpers';
import getImageChangesWorkflow from './getImageChangesWorkflow';

const mockGetImageTool = vi.fn();
vi.mock('../../tools/evergreen', () => ({
  getImageTool: {
    outputSchema: z.any(),
    execute: (...args: any[]) => mockGetImageTool(...args),
  },
}));

const startRun = async (imageId: string) => {
  const runtimeContext = new RuntimeContext();
  runtimeContext.set(USER_ID, 'test_user');
  const run = await getImageChangesWorkflow.createRunAsync({});
  const wr = await run.start({ inputData: { imageId }, runtimeContext });
  return wr;
};

describe('getImageChangesWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('success: returns image with recent changes', async () => {
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
                {
                  type: 'TOOLCHAIN',
                  action: 'ADDED',
                  name: 'gcc',
                  before: '',
                  after: '11.2.0',
                },
              ],
            },
            {
              timestamp: new Date('2024-01-10T08:00:00Z'),
              amiAfter: 'ami-xyz789',
              amiBefore: 'ami-old456',
              entries: [
                {
                  type: 'PACKAGE',
                  action: 'ADDED',
                  name: 'python',
                  before: '',
                  after: '3.10.0',
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

    mockGetImageTool.mockResolvedValueOnce(mockImageData);

    const wr = await startRun('image-123');

    expectSuccess(wr);
    expect(wr.result).toBeDefined();
    expect(wr.result.image).toBeDefined();
    expect(wr.result.image.id).toBe('image-123');
    expect(wr.result.image.ami).toBe('ami-abc123');
    expect(wr.result.image.recentChanges).toHaveLength(2);
    expect(wr.result.image.recentChanges[0].entries).toHaveLength(2);
    expect(wr.result.image.recentChanges[0].entries[0].type).toBe('PACKAGE');
    expect(wr.result.image.recentChanges[0].entries[0].action).toBe('UPDATED');
  });

  it('success: handles image with no changes', async () => {
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

    mockGetImageTool.mockResolvedValueOnce(mockImageData);

    const wr = await startRun('image-new');

    expectSuccess(wr);
    expect(wr.result.image.id).toBe('image-new');
    expect(wr.result.image.recentChanges).toHaveLength(0);
  });

  it('failed: image data is missing', async () => {
    mockGetImageTool.mockResolvedValueOnce({
      image: null,
    });

    const wr = await startRun('missing-image');

    expect(wr.status).toBe('failed');
  });

  it('failed: getImageTool throws error', async () => {
    mockGetImageTool.mockRejectedValueOnce(new Error('Image not found'));

    const wr = await startRun('invalid-image');

    expect(wr.status).toBe('failed');
  });

  it('failed: invalid input - missing imageId', async () => {
    const runtimeContext = new RuntimeContext();
    runtimeContext.set(USER_ID, 'test_user');
    const run = await getImageChangesWorkflow.createRunAsync({});
    const wr = await run.start({
      inputData: {}, // missing imageId
      runtimeContext,
    });

    expect(wr.status).toBe('failed');
  });

  it('success: extracts only change-related fields', async () => {
    const mockImageData = {
      image: {
        id: 'image-456',
        ami: 'ami-456',
        lastDeployed: new Date('2024-01-15T10:00:00Z'),
        distros: [{ name: 'distro1', arch: 'amd64' }],
        events: {
          count: 1,
          eventLogEntries: [
            {
              timestamp: new Date('2024-01-15T10:00:00Z'),
              amiAfter: 'ami-456',
              amiBefore: null,
              entries: [
                {
                  type: 'PACKAGE',
                  action: 'ADDED',
                  name: 'docker',
                  before: '',
                  after: '24.0.0',
                },
              ],
            },
          ],
        },
        packages: {
          data: [{ name: 'docker', manager: 'apt', version: '24.0.0' }],
          filteredCount: 1,
          totalCount: 1,
        },
        toolchains: { data: [], filteredCount: 0, totalCount: 0 },
        operatingSystem: { data: [], filteredCount: 0, totalCount: 0 },
      },
    };

    mockGetImageTool.mockResolvedValueOnce(mockImageData);

    const wr = await startRun('image-456');

    expectSuccess(wr);
    // Verify that only change-related fields are in the result
    expect(wr.result.image).toHaveProperty('id');
    expect(wr.result.image).toHaveProperty('ami');
    expect(wr.result.image).toHaveProperty('lastDeployed');
    expect(wr.result.image).toHaveProperty('recentChanges');
    // Verify packages, toolchains, etc. are NOT in the result
    expect(wr.result.image).not.toHaveProperty('packages');
    expect(wr.result.image).not.toHaveProperty('toolchains');
    expect(wr.result.image).not.toHaveProperty('operatingSystem');
    expect(wr.result.image).not.toHaveProperty('distros');
  });
});
