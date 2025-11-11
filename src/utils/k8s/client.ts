import * as k8s from '@kubernetes/client-node';
import { readFileSync, existsSync } from 'fs';
import { logger } from '@/utils/logger';

/**
 * Checks if we're running inside a Kubernetes cluster by checking for service account files.
 * @returns True if running in-cluster, false otherwise
 */
function isInCluster(): boolean {
  return (
    existsSync('/var/run/secrets/kubernetes.io/serviceaccount/token') &&
    existsSync('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt')
  );
}

/**
 * Kubernetes client wrapper that handles authentication and namespace detection.
 * Uses in-cluster configuration when running in Kubernetes, falls back to kubeconfig for local development.
 */
class KubernetesClient {
  private k8sApi: k8s.CoreV1Api;
  private namespace: string;

  constructor() {
    const kc = new k8s.KubeConfig();

    // Check if we're running in-cluster first
    if (isInCluster()) {
      try {
        kc.loadFromCluster();
        logger.info('Using in-cluster Kubernetes configuration');
      } catch (error) {
        logger.warn('Failed to load in-cluster config, falling back to kubeconfig', {
          error: error instanceof Error ? error.message : String(error),
        });
        // Fall through to kubeconfig
        try {
          kc.loadFromDefault();
          logger.info('Using kubeconfig for Kubernetes configuration');
        } catch (kubeconfigError) {
          logger.warn('Failed to load Kubernetes configuration', {
            error:
              kubeconfigError instanceof Error
                ? kubeconfigError.message
                : String(kubeconfigError),
          });
          throw new Error(
            'Failed to initialize Kubernetes client. Ensure you are running in a Kubernetes cluster or have kubeconfig configured.'
          );
        }
      }
    } else {
      // Not in cluster, use kubeconfig
      try {
        kc.loadFromDefault();
        logger.info('Using kubeconfig for Kubernetes configuration');
      } catch (error) {
        logger.warn('Failed to load Kubernetes configuration', {
          error: error instanceof Error ? error.message : String(error),
        });
        throw new Error(
          'Failed to initialize Kubernetes client. Ensure you are running in a Kubernetes cluster or have kubeconfig configured.'
        );
      }
    }

    this.k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    this.namespace = this.detectNamespace();
  }

  /**
   * Detects the current namespace from service account token or environment.
   * @returns The namespace name
   */
  private detectNamespace(): string {
    // Try reading from service account namespace file (in-cluster)
    try {
      const namespace = readFileSync(
        '/var/run/secrets/kubernetes.io/serviceaccount/namespace',
        'utf-8'
      ).trim();
      if (namespace) {
        logger.debug('Detected namespace from service account', { namespace });
        return namespace;
      }
    } catch {
      // Not running in-cluster, try environment variable
    }

    // Try environment variable
    const envNamespace = process.env.KUBERNETES_NAMESPACE || process.env.NAMESPACE;
    if (envNamespace) {
      logger.debug('Detected namespace from environment', { namespace: envNamespace });
      return envNamespace;
    }

    // Default fallback (should not happen in production)
    logger.warn('Could not detect namespace, using default', {
      default: 'default',
    });
    return 'default';
  }

  /**
   * Gets a secret from Kubernetes.
   * @param secretName - The name of the secret
   * @param key - Optional specific key to retrieve. If not provided, returns all keys.
   * @returns The secret value(s) as a string or object
   * @throws Error if the secret or key is not found
   */
  async getSecret(
    secretName: string,
    key?: string
  ): Promise<string | Record<string, string>> {
    try {
      logger.debug('Fetching secret from Kubernetes', {
        secretName,
        namespace: this.namespace,
        key,
      });

      const response = await this.k8sApi.readNamespacedSecret(
        secretName,
        this.namespace
      );

      if (!response.body.data) {
        throw new Error(`Secret ${secretName} has no data`);
      }

      // Decode all secret values from base64
      const decodedData: Record<string, string> = {};
      for (const [k, v] of Object.entries(response.body.data)) {
        if (typeof v === 'string') {
          decodedData[k] = Buffer.from(v, 'base64').toString('utf-8');
        }
      }

      // If a specific key is requested, return just that value
      if (key) {
        if (!(key in decodedData)) {
          throw new Error(
            `Key "${key}" not found in secret "${secretName}". Available keys: ${Object.keys(decodedData).join(', ')}`
          );
        }
        return decodedData[key];
      }

      // Return all keys
      return decodedData;
    } catch (error) {
      // Check for HTTP errors (404, 403, etc.)
      if (
        error &&
        typeof error === 'object' &&
        'statusCode' in error &&
        typeof (error as { statusCode: unknown }).statusCode === 'number'
      ) {
        const httpError = error as { statusCode: number; message?: string };
        if (httpError.statusCode === 404) {
          throw new Error(
            `Secret "${secretName}" not found in namespace "${this.namespace}"`
          );
        }
        if (httpError.statusCode === 403) {
          throw new Error(
            `Permission denied: Service account does not have access to secret "${secretName}" in namespace "${this.namespace}". Check RBAC permissions.`
          );
        }
        throw new Error(
          `Failed to fetch secret "${secretName}": HTTP ${httpError.statusCode} - ${httpError.message || 'Unknown error'}`
        );
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Unexpected error fetching secret: ${String(error)}`);
    }
  }

  /**
   * Gets the current namespace.
   * @returns The namespace name
   */
  getNamespace(): string {
    return this.namespace;
  }
}

// Singleton instance
let clientInstance: KubernetesClient | null = null;

/**
 * Gets or creates the Kubernetes client instance.
 * @returns The Kubernetes client instance
 */
export function getKubernetesClient(): KubernetesClient {
  if (!clientInstance) {
    clientInstance = new KubernetesClient();
  }
  return clientInstance;
}

/**
 * Gets a secret from Kubernetes.
 * Convenience function that uses the singleton client.
 * @param secretName - The name of the secret
 * @param key - Optional specific key to retrieve
 * @returns The secret value(s)
 */
export async function getKubernetesSecret(
  secretName: string,
  key?: string
): Promise<string | Record<string, string>> {
  const client = getKubernetesClient();
  return client.getSecret(secretName, key);
}

