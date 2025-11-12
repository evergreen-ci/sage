import { Tool, ToolExecutionContext } from '@mastra/core';
import { ZodType } from 'zod';
import logger from '@/utils/logger';
import { getK8sClient, getNamespace } from './client';

/**
 * Secret retrieval result type
 */
export type SecretData = {
  secretName: string;
  data?: Record<string, string>;
  key?: string;
  value?: string;
};

/**
 * Configuration for secret middleware
 */
export interface SecretMiddlewareConfig {
  secretName: string;
  key?: string;
  contextKey?: string; // Key to inject secret into runtime context (default: 'secrets')
}

/**
 * Core function to retrieve a secret from Kubernetes.
 * Automatically uses the namespace the application is running in.
 * For local development, defaults to "default" namespace if not specified.
 * @param secretName - The name of the Kubernetes secret to retrieve
 * @param key - Optional: The specific key within the secret to retrieve. If not provided, returns all keys.
 * @returns The secret data (decoded from base64)
 */
export async function getK8sSecret(
  secretName: string,
  key?: string
): Promise<SecretData> {
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
}

/**
 * Middleware function that wraps a tool with secret access.
 * The secret is fetched before the tool executes and injected into the runtime context.
 * @param tool - The tool to wrap with secret access
 * @param config - Configuration for which secret to fetch and how to inject it
 * @returns A new tool that has access to the secret via runtime context
 * @example
 * ```typescript
 * const myTool = createTool({ ... });
 * const toolWithSecret = withK8sSecret(myTool, {
 *   secretName: 'my-secret',
 *   key: 'api-key',
 *   contextKey: 'apiKey'
 * });
 * // In the tool's execute function, access via: runtimeContext.get('apiKey')
 * ```
 */
export function withK8sSecret<
  TInputSchema extends ZodType,
  TOutputSchema extends ZodType,
  TSuspendSchema extends ZodType = ZodType<unknown>,
  TResumeSchema extends ZodType = ZodType<unknown>,
>(
  tool: Tool<TInputSchema, TOutputSchema, TSuspendSchema, TResumeSchema>,
  config: SecretMiddlewareConfig
): Tool<TInputSchema, TOutputSchema, TSuspendSchema, TResumeSchema> {
  const contextKey = config.contextKey || 'secrets';
  const { key, secretName } = config;

  return {
    ...tool,
    execute: async (executionContext: ToolExecutionContext<TInputSchema>) => {
      // Fetch the secret before executing the tool
      const secretData = await getK8sSecret(secretName, key);

      // Inject secret into runtime context
      if (executionContext.runtimeContext) {
        if (key) {
          // If a specific key was requested, inject just the value
          executionContext.runtimeContext.set(contextKey, secretData.value);
        } else {
          // If all keys were requested, inject the entire data object
          executionContext.runtimeContext.set(contextKey, secretData.data);
        }
      }

      // Execute the original tool
      if (!tool.execute) {
        throw new Error(`Tool ${tool.id} does not have an execute function`);
      }
      return tool.execute(executionContext);
    },
  };
}
