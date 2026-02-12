import BaseModel from './baseModel';

/**
 * gpt 5 nano
 * https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/models?tabs=global-standard,standard-chat-completions#gpt-5-series
 */
const gpt5Nano = new BaseModel('gpt-5-nano').getModel();

export { gpt5Nano };
