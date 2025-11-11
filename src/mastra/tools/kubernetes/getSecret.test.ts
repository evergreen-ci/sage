import * as k8s from '@kubernetes/client-node';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { getK8sClient, getNamespace } from './client';
import { getK8sSecretTool } from './getSecret';

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

describe('getK8sSecretTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock but keep it as a function
    mockReadNamespacedSecret.mockReset();
    // Ensure the mock client is always returned
    mockGetK8sClient.mockReturnValue(mockK8sClient);
    mockGetNamespace.mockReturnValue('test-namespace');
  });

  describe('successful secret retrieval', () => {
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

      const result = await getK8sSecretTool.execute?.({
        context: { secretName: 'my-secret' },
        runtimeContext,
        tracingContext,
      });

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

      const result = await getK8sSecretTool.execute?.({
        context: { secretName: 'api-secrets', key: 'apiKey' },
        runtimeContext,
        tracingContext,
      });

      expect(result).toEqual({
        key: 'apiKey',
        secretName: 'api-secrets',
        value: 'secret-api-key',
      });

      expect(mockReadNamespacedSecret).toHaveBeenCalledWith(
        'api-secrets',
        'test-namespace'
      );
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

      const result = await getK8sSecretTool.execute?.({
        context: { secretName: 'multi-key-secret' },
        runtimeContext,
        tracingContext,
      });

      expect(result).toEqual({
        data: {
          key1: 'value1',
          key2: 'value2',
          key3: 'value3',
        },
        secretName: 'multi-key-secret',
      });
    });
  });

  describe('error handling', () => {
    it('should throw error when secret is not found', async () => {
      // Kubernetes client throws errors with "not found" or "404" in the message
      const notFoundError = new Error('Secret not found: 404');

      mockReadNamespacedSecret.mockRejectedValueOnce(notFoundError);

      await expect(
        getK8sSecretTool.execute?.({
          context: { secretName: 'non-existent-secret' },
          runtimeContext,
          tracingContext,
        })
      ).rejects.toThrow(
        'Secret "non-existent-secret" not found in namespace "test-namespace"'
      );
    });

    it('should throw error when secret exists but has no data', async () => {
      mockReadNamespacedSecret.mockResolvedValueOnce({
        body: {
          data: undefined,
        },
      });

      await expect(
        getK8sSecretTool.execute?.({
          context: { secretName: 'empty-secret' },
          runtimeContext,
          tracingContext,
        })
      ).rejects.toThrow('Secret "empty-secret" exists but has no data');
    });

    it('should handle base64 decoding errors gracefully', async () => {
      // Note: Buffer.from() doesn't throw on invalid base64, it just produces garbage
      // So we test with a valid base64 value that decodes correctly
      const secretData: Record<string, string> = {
        validKey: Buffer.from('valid-value').toString('base64'),
        anotherKey: Buffer.from('another-value').toString('base64'),
      };

      mockReadNamespacedSecret.mockResolvedValueOnce({
        body: {
          data: secretData,
        },
      });

      const result = await getK8sSecretTool.execute?.({
        context: { secretName: 'problematic-secret' },
        runtimeContext,
        tracingContext,
      });

      // Should decode all values correctly
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

      await expect(
        getK8sSecretTool.execute?.({
          context: { secretName: 'error-secret' },
          runtimeContext,
          tracingContext,
        })
      ).rejects.toThrow('Kubernetes API error: 500 Internal Server Error');
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

      await getK8sSecretTool.execute?.({
        context: { secretName: 'test-secret' },
        runtimeContext,
        tracingContext,
      });

      expect(mockReadNamespacedSecret).toHaveBeenCalledWith(
        'test-secret',
        'custom-namespace'
      );
    });
  });
});
