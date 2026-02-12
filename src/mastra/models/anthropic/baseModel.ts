import { createAnthropic } from '@ai-sdk/anthropic';
import { LanguageModelV2 } from '@ai-sdk/provider';
import { config } from '@/config';
import { logger } from '@/utils/logger';

/**
 * BaseModel is a class that creates a language model from an Azure OpenAI deployment.
 * It is a wrapper around the Azure OpenAI SDK.
 */
class BaseModel {
  private model: LanguageModelV2;

  constructor(deploymentName: string, apiVersion?: string) {
    // Create Azure OpenAI client with Vercel AI SDK
    const endpointParts = config.aiModels.azure.anthropic.endpoint.split('//');
    const resourceName = endpointParts[1]?.split('/')[0] || 'default';

    const azureAnthropic = createAnthropic({
      apiKey: config.aiModels.azure.anthropic.apiKey,
      baseURL: config.aiModels.azure.anthropic.endpoint,
    });

    logger.info('Azure Anthropic client created', {
      deploymentName,
      resourceName,
      endpoint: config.aiModels.azure.anthropic.endpoint,
      apiVersion: apiVersion || config.aiModels.azure.anthropic.apiVersion,
    });

    this.model = azureAnthropic.languageModel(deploymentName);
  }

  public getModel() {
    return this.model;
  }

  public getModelName() {
    return this.model.modelId;
  }
}

export default BaseModel;
