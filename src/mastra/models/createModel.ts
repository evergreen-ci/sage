import { createAnthropic } from '@ai-sdk/anthropic';
import { createAzure } from '@ai-sdk/azure';
import { config } from '@/config';
import { logger } from '@/utils/logger';

type ModelProvider = 'openai' | 'anthropic';

/**
 * createModel is a factory function that creates a language model for the given provider and deployment.
 * It handles provider-specific configuration for Azure-hosted OpenAI and Anthropic models.
 * @param provider - The model provider ('openai' or 'anthropic').
 * @param deploymentName - The Azure deployment name for the model.
 * @returns The configured language model instance.
 */
export const createModel = (
  provider: ModelProvider,
  deploymentName: string
): any => {
  if (provider === 'openai') {
    const endpointParts = config.aiModels.azure.openai.endpoint.split('//');
    const resourceName = endpointParts[1]?.split('.')[0] || 'default';

    const azureOpenAI = createAzure({
      apiKey: config.aiModels.azure.openai.apiKey,
      resourceName,
      apiVersion: config.aiModels.azure.openai.apiVersion,
    });
    logger.info('Azure OpenAI client created', {
      deploymentName,
      resourceName,
      apiVersion: config.aiModels.azure.openai.apiVersion,
    });

    return azureOpenAI(deploymentName) as any;
  }

  const azureAnthropic = createAnthropic({
    apiKey: config.aiModels.azure.anthropic.apiKey,
    baseURL: config.aiModels.azure.anthropic.endpoint,
    headers: {
      'api-version': config.aiModels.azure.anthropic.apiVersion,
    },
  });

  logger.info('Azure Anthropic client created', {
    deploymentName,
    endpoint: config.aiModels.azure.anthropic.endpoint,
    apiVersion: config.aiModels.azure.anthropic.apiVersion,
  });

  return azureAnthropic.languageModel(deploymentName) as any;
};
