import { createTool } from '@mastra/core';
import { z } from 'zod';
import logger from '@/utils/logger';
import { getK8sClient, getNamespace } from './client';

const getSecretInputSchema = z.object({
  secretName: z
    .string()
    .describe('The name of the Kubernetes secret to retrieve'),
  key: z
    .string()
    .optional()
    .describe(
      'Optional: The specific key within the secret to retrieve. If not provided, returns all keys.'
    ),
});

const getSecretOutputSchema = z.object({
  secretName: z.string(),
  data: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      'All key-value pairs from the secret (base64 decoded). Present when no specific key is requested.'
    ),
  key: z
    .string()
    .optional()
    .describe(
      'The specific key that was requested. Present only when a specific key is requested.'
    ),
  value: z
    .string()
    .optional()
    .describe(
      'The value of the specific key from the secret (base64 decoded). Present only when a specific key is requested.'
    ),
});

/**
 * Tool to retrieve secrets from Kubernetes.
 * Automatically uses the namespace the application is running in.
 * For local development, defaults to "default" namespace if not specified.
 */
export const getK8sSecretTool = createTool({
  id: 'getK8sSecret',
  description:
    'Retrieves a secret from Kubernetes. Can retrieve all keys from a secret or a specific key. The secret values are automatically base64 decoded. Uses the namespace the application is running in (or "default" namespace for local development).',
  inputSchema: getSecretInputSchema,
  outputSchema: getSecretOutputSchema,
  execute: async ({ context }) => {
    const { key, secretName } = context;
    const k8sClient = getK8sClient();
    const namespace = getNamespace();

    try {
      logger.debug('Fetching Kubernetes secret', {
        secretName,
        namespace,
        key,
      });

      const response = await k8sClient.readNamespacedSecret(
        secretName,
        namespace
      );

      if (!response.body.data) {
        throw new Error(`Secret "${secretName}" exists but has no data`);
      }

      // Decode all secret values from base64
      const decodedData: Record<string, string> = {};
      for (const [secretKey, encodedValue] of Object.entries(
        response.body.data
      )) {
        try {
          decodedData[secretKey] = Buffer.from(encodedValue, 'base64').toString(
            'utf8'
          );
        } catch (decodeError) {
          logger.warn('Failed to decode secret value', {
            secretName,
            key: secretKey,
            error:
              decodeError instanceof Error
                ? decodeError.message
                : String(decodeError),
          });
          // Include the raw value if decoding fails
          decodedData[secretKey] = encodedValue;
        }
      }

      // If a specific key was requested, return only that key
      if (key) {
        if (!(key in decodedData)) {
          throw new Error(
            `Key "${key}" not found in secret "${secretName}". Available keys: ${Object.keys(decodedData).join(', ')}`
          );
        }

        return {
          key,
          secretName,
          value: decodedData[key],
        } as const;
      }

      // Return all keys
      return {
        data: decodedData,
        secretName,
      };
    } catch (error) {
      // Handle Kubernetes API errors
      if (error instanceof Error) {
        if (
          error.message.includes('not found') ||
          error.message.includes('404')
        ) {
          throw new Error(
            `Secret "${secretName}" not found in namespace "${namespace}"`
          );
        }
        throw error;
      }

      logger.error('Unexpected error retrieving Kubernetes secret', {
        namespace,
        secretName,
        error: String(error),
      });
      throw new Error(
        `Failed to retrieve secret "${secretName}": ${String(error)}`
      );
    }
  },
});
