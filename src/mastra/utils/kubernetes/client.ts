import { readFileSync } from 'fs';
import * as k8s from '@kubernetes/client-node';
import logger from '@/utils/logger';

const SERVICE_ACCOUNT_NAMESPACE_PATH =
  '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

/**
 * Gets the Kubernetes namespace from the pod's service account or environment variable.
 * For local development, defaults to "default" namespace if not specified.
 * @returns The namespace string
 */
function detectNamespace(): string {
  // Try to read from service account file (when running in-cluster)
  try {
    const detectedNamespace = readFileSync(
      SERVICE_ACCOUNT_NAMESPACE_PATH,
      'utf8'
    ).trim();
    if (detectedNamespace) {
      logger.debug('Detected namespace from service account', {
        namespace: detectedNamespace,
      });
      return detectedNamespace;
    }
  } catch (error) {
    // Not running in-cluster, fall back to environment variable
    logger.debug(
      'Could not read namespace from service account, checking environment variables',
      {
        error: error instanceof Error ? error.message : String(error),
      }
    );
  }

  // Fallback to environment variable
  const envNamespace =
    process.env.KUBERNETES_NAMESPACE || process.env.NAMESPACE;
  if (envNamespace) {
    logger.debug('Using namespace from environment variable', {
      namespace: envNamespace,
    });
    return envNamespace;
  }

  // For local development, default to "default" namespace
  // This allows the tool to work locally without requiring namespace configuration
  logger.info(
    'No namespace detected, defaulting to "default" namespace for local development'
  );
  return 'default';
}

/**
 * Initializes and returns a Kubernetes API client configured for in-cluster access.
 * Falls back to default kubeconfig for local development.
 * @returns Configured Kubernetes API client
 * @throws {Error} If neither in-cluster nor default config can be loaded
 */
function createK8sClient(): k8s.KubeConfig {
  const kc = new k8s.KubeConfig();

  // Try to load in-cluster config first (when running in a pod)
  try {
    kc.loadFromCluster();
    logger.debug('Loaded Kubernetes config from cluster');
    return kc;
  } catch (error) {
    // Fallback to default config (for local development)
    logger.debug(
      'Could not load in-cluster config, trying default kubeconfig',
      {
        error: error instanceof Error ? error.message : String(error),
      }
    );

    try {
      kc.loadFromDefault();
      logger.debug('Loaded Kubernetes config from default kubeconfig');
      return kc;
    } catch (defaultError) {
      logger.error(
        'Failed to load Kubernetes config from both cluster and default',
        {
          clusterError: error instanceof Error ? error.message : String(error),
          defaultError:
            defaultError instanceof Error
              ? defaultError.message
              : String(defaultError),
        }
      );
      throw new Error(
        'Could not load Kubernetes configuration. For local development, ensure you have a valid kubeconfig file (~/.kube/config) or are running in a Kubernetes pod.'
      );
    }
  }
}

// Singleton instances
let k8sClient: k8s.KubeConfig | null = null;
let coreV1Api: k8s.CoreV1Api | null = null;
let namespace: string | null = null;

/**
 * Gets the Kubernetes CoreV1Api client instance (singleton).
 * @returns The CoreV1Api client instance
 */
export function getK8sClient(): k8s.CoreV1Api {
  if (!coreV1Api) {
    k8sClient = createK8sClient();
    coreV1Api = k8sClient.makeApiClient(k8s.CoreV1Api);
  }
  return coreV1Api;
}

/**
 * Gets the current Kubernetes namespace (singleton).
 * @returns The namespace string
 */
export function getNamespace(): string {
  if (!namespace) {
    namespace = detectNamespace();
  }
  return namespace;
}
