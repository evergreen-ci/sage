import { createAzure } from '@ai-sdk/azure';
import { config } from '../../config';

class GPTModel {
  private model: any;

  constructor(deploymentName: string) {
    // Create Azure OpenAI client with Vercel AI SDK
    const endpointParts = config.aiModels.azure.openai.endpoint.split('//');
    const resourceName = endpointParts[1]?.split('.')[0] || 'default';

    const azureOpenAI = createAzure({
      apiKey: config.aiModels.azure.openai.apiKey,
      resourceName,
      apiVersion: config.aiModels.azure.openai.apiVersion,
    });

    this.model = azureOpenAI(deploymentName);
  }

  public getModel() {
    return this.model;
  }
}

export default GPTModel;
