import { createTool } from '@mastra/core';
import { z } from 'zod';
import { getKubernetesSecret } from '@/utils/k8s/client';
import logger from '@/utils/logger';

const getSecretInputSchema = z.object({
  secretName: z.string().describe('The name of the Kubernetes secret to retrieve'),
  key: z
    .string()
    .optional()
    .describe(
      'Optional: The specific key within the secret to retrieve. If not provided, all keys will be returned.'
    ),
});

const getSecretOutputSchema = z.union([
  z.string().describe('The value of the requested secret key'),
  z.record(z.string()).describe('All key-value pairs in the secret'),
]);

/**
 * Tool for retrieving secrets from Kubernetes.
 * This tool allows agents to access secrets stored in Kubernetes secrets in the same namespace as the pod.
 */
const getSecretTool = createTool({
  id: 'getKubernetesSecret',
  description:
    'Retrieves a secret from Kubernetes. Returns the value of a specific key or all keys in the secret. Secrets are automatically base64 decoded. The secret must exist in the same namespace as the pod.',
  inputSchema: getSecretInputSchema,
  outputSchema: getSecretOutputSchema,
  execute: async ({ context }) => {
    const { secretName, key } = context;

    try {
      logger.info('Agent requesting Kubernetes secret', {
        secretName,
        key: key || 'all',
      });

      const result = await getKubernetesSecret(secretName, key);

      logger.debug('Successfully retrieved Kubernetes secret', {
        secretName,
        key: key || 'all',
        hasResult: !!result,
      });

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to retrieve Kubernetes secret', {
        secretName,
        key,
        error: errorMessage,
      });
      throw new Error(
        `Failed to retrieve secret "${secretName}": ${errorMessage}`
      );
    }
  },
});

export default getSecretTool;

