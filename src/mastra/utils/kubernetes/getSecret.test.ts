import * as k8s from '@kubernetes/client-node';
import { createTool } from '@mastra/core';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { z } from 'zod';
import { getK8sClient, getNamespace } from './client';
import { getK8sSecret, withK8sSecret } from './getSecret';

// Mock the client module
vi.mock('./client', () => ({
  getK8sClient: vi.fn(),
  getNamespace: vi.fn(),
}));

// Mock logger
vi.mock('@/utils/logger', () => ({
  default: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockReadNamespacedSecret = vi.fn();

const mockK8sClient = {
  readNamespacedSecret: mockReadNamespacedSecret,
} as unknown as k8s.CoreV1Api;

const mockGetK8sClient = getK8sClient as unknown as ReturnType<typeof vi.fn>;
const mockGetNamespace = getNamespace as unknown as ReturnType<typeof vi.fn>;

const runtimeContext = new RuntimeContext();
const tracingContext = {};

describe('getK8sSecret', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadNamespacedSecret.mockReset();
    mockGetK8sClient.mockReturnValue(mockK8sClient);
    mockGetNamespace.mockReturnValue('test-namespace');
  });

  it('should retrieve all keys from a secret', async () => {
    const secretData = {
      username: Buffer.from('testuser').toString('base64'),
      password: Buffer.from('testpass').toString('base64'),
    };

    mockReadNamespacedSecret.mockResolvedValueOnce({
      body: {
        data: secretData,
      },
    });

    const result = await getK8sSecret('my-secret');

    expect(result).toEqual({
      data: {
        username: 'testuser',
        password: 'testpass',
      },
      secretName: 'my-secret',
    });

    expect(mockReadNamespacedSecret).toHaveBeenCalledWith(
      'my-secret',
      'test-namespace'
    );
  });

  it('should retrieve a specific key from a secret', async () => {
    const secretData = {
      apiKey: Buffer.from('secret-api-key').toString('base64'),
      apiSecret: Buffer.from('secret-api-secret').toString('base64'),
    };

    mockReadNamespacedSecret.mockResolvedValueOnce({
      body: {
        data: secretData,
      },
    });

    const result = await getK8sSecret('api-secrets', 'apiKey');

    expect(result).toEqual({
      key: 'apiKey',
      secretName: 'api-secrets',
      value: 'secret-api-key',
    });
  });

  it('should handle secrets with multiple keys', async () => {
    const secretData = {
      key1: Buffer.from('value1').toString('base64'),
      key2: Buffer.from('value2').toString('base64'),
      key3: Buffer.from('value3').toString('base64'),
    };

    mockReadNamespacedSecret.mockResolvedValueOnce({
      body: {
        data: secretData,
      },
    });

    const result = await getK8sSecret('multi-key-secret');

    expect(result).toEqual({
      data: {
        key1: 'value1',
        key2: 'value2',
        key3: 'value3',
      },
      secretName: 'multi-key-secret',
    });
  });

  describe('error handling', () => {
    it('should throw error when secret is not found', async () => {
      const notFoundError = new Error('Secret not found: 404');

      mockReadNamespacedSecret.mockRejectedValueOnce(notFoundError);

      await expect(getK8sSecret('non-existent-secret')).rejects.toThrow(
        'Secret "non-existent-secret" not found in namespace "test-namespace"'
      );
    });

    it('should throw error when secret exists but has no data', async () => {
      mockReadNamespacedSecret.mockResolvedValueOnce({
        body: {
          data: undefined,
        },
      });

      await expect(getK8sSecret('empty-secret')).rejects.toThrow(
        'Secret "empty-secret" exists but has no data'
      );
    });

    it('should handle base64 decoding errors gracefully', async () => {
      const secretData: Record<string, string> = {
        validKey: Buffer.from('valid-value').toString('base64'),
        anotherKey: Buffer.from('another-value').toString('base64'),
      };

      mockReadNamespacedSecret.mockResolvedValueOnce({
        body: {
          data: secretData,
        },
      });

      const result = await getK8sSecret('problematic-secret');

      expect(result).toEqual({
        data: {
          anotherKey: 'another-value',
          validKey: 'valid-value',
        },
        secretName: 'problematic-secret',
      });
    });

    it('should handle generic Kubernetes API errors', async () => {
      const apiError = new Error(
        'Kubernetes API error: 500 Internal Server Error'
      );

      mockReadNamespacedSecret.mockRejectedValueOnce(apiError);

      await expect(getK8sSecret('error-secret')).rejects.toThrow(
        'Kubernetes API error: 500 Internal Server Error'
      );
    });
  });

  describe('namespace handling', () => {
    it('should use the namespace from getNamespace', async () => {
      mockGetNamespace.mockReturnValue('custom-namespace');

      const secretData = {
        key: Buffer.from('value').toString('base64'),
      };

      mockReadNamespacedSecret.mockResolvedValueOnce({
        body: {
          data: secretData,
        },
      });

      await getK8sSecret('test-secret');

      expect(mockReadNamespacedSecret).toHaveBeenCalledWith(
        'test-secret',
        'custom-namespace'
      );
    });
  });
});

describe('withK8sSecret', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadNamespacedSecret.mockReset();
    mockGetK8sClient.mockReturnValue(mockK8sClient);
    mockGetNamespace.mockReturnValue('test-namespace');
  });

  it('should inject secret value into runtime context when key is specified', async () => {
    const secretData = {
      apiKey: Buffer.from('secret-api-key').toString('base64'),
    };

    mockReadNamespacedSecret.mockResolvedValueOnce({
      body: {
        data: secretData,
      },
    });

    const mockTool = createTool({
      id: 'test-tool',
      description: 'Test tool',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ output: z.string() }),
      execute: async ({ runtimeContext: rtCtx }) => {
        const apiKey = rtCtx?.get('apiKey') as string;
        return { output: `Received: ${apiKey}` };
      },
    });

    const wrappedTool = withK8sSecret(mockTool, {
      secretName: 'api-secrets',
      key: 'apiKey',
      contextKey: 'apiKey',
    });

    const result = await wrappedTool.execute?.({
      context: { input: 'test' },
      runtimeContext,
      tracingContext,
    });

    expect(result).toEqual({ output: 'Received: secret-api-key' });
    expect(mockReadNamespacedSecret).toHaveBeenCalledWith(
      'api-secrets',
      'test-namespace'
    );
  });

  it('should inject all secret data into runtime context when no key is specified', async () => {
    const secretData = {
      username: Buffer.from('testuser').toString('base64'),
      password: Buffer.from('testpass').toString('base64'),
    };

    mockReadNamespacedSecret.mockResolvedValueOnce({
      body: {
        data: secretData,
      },
    });

    const mockTool = createTool({
      id: 'test-tool',
      description: 'Test tool',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ output: z.string() }),
      execute: async ({ runtimeContext: rtCtx }) => {
        const secrets = rtCtx?.get('secrets') as Record<string, string>;
        return {
          output: `Username: ${secrets?.username}, Password: ${secrets?.password}`,
        };
      },
    });

    const wrappedTool = withK8sSecret(mockTool, {
      secretName: 'user-secrets',
    });

    const result = await wrappedTool.execute?.({
      context: { input: 'test' },
      runtimeContext,
      tracingContext,
    });

    expect(result).toEqual({
      output: 'Username: testuser, Password: testpass',
    });
  });

  it('should use custom contextKey when provided', async () => {
    const secretData = {
      token: Buffer.from('my-token').toString('base64'),
    };

    mockReadNamespacedSecret.mockResolvedValueOnce({
      body: {
        data: secretData,
      },
    });

    const mockTool = createTool({
      id: 'test-tool',
      description: 'Test tool',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ output: z.string() }),
      execute: async ({ runtimeContext: rtCtx }) => {
        const token = rtCtx?.get('authToken') as string;
        return { output: `Token: ${token}` };
      },
    });

    const wrappedTool = withK8sSecret(mockTool, {
      secretName: 'auth-secrets',
      key: 'token',
      contextKey: 'authToken',
    });

    const result = await wrappedTool.execute?.({
      context: { input: 'test' },
      runtimeContext,
      tracingContext,
    });

    expect(result).toEqual({ output: 'Token: my-token' });
  });

  it('should throw error if tool does not have execute function', async () => {
    const mockTool = {
      id: 'test-tool',
      description: 'Test tool',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ output: z.string() }),
    } as {
      id: string;
      description: string;
      inputSchema: z.ZodType;
      outputSchema: z.ZodType;
    };

    const wrappedTool = withK8sSecret(mockTool, {
      secretName: 'test-secret',
    });

    await expect(
      wrappedTool.execute?.({
        context: { input: 'test' },
        runtimeContext,
        tracingContext,
      })
    ).rejects.toThrow('Tool test-tool does not have an execute function');
  });

  it('should propagate secret retrieval errors', async () => {
    const notFoundError = new Error('Secret not found: 404');
    mockReadNamespacedSecret.mockRejectedValueOnce(notFoundError);

    const mockTool = createTool({
      id: 'test-tool',
      description: 'Test tool',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ output: z.string() }),
      execute: async () => ({ output: 'should not reach here' }),
    });

    const wrappedTool = withK8sSecret(mockTool, {
      secretName: 'non-existent-secret',
    });

    await expect(
      wrappedTool.execute?.({
        context: { input: 'test' },
        runtimeContext,
        tracingContext,
      })
    ).rejects.toThrow(
      'Secret "non-existent-secret" not found in namespace "test-namespace"'
    );
  });
});
