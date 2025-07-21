import { createAzure } from '@ai-sdk/azure';
import { LanguageModelV1 } from 'ai';
import { logger } from 'utils/logger';
import { config } from '../../../config';

/**
 * BaseModel is a class that creates a language model from an Azure OpenAI deployment.
 * It is a wrapper around the Azure OpenAI SDK.
 */
class GPTModel {
  private model: LanguageModelV1;

  constructor(deploymentName: string) {
    // Create Azure OpenAI client with Vercel AI SDK
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

    this.model = azureOpenAI(deploymentName);
  }

  public getModel() {
    return this.model;
  }

  public getModelName() {
    return this.model.modelId;
  }
}

export default GPTModel;
