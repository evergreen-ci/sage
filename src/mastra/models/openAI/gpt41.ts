import GPTModel from './baseModel';

/**
 * gpt 4.1
 * https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/models?tabs=global-standard,standard-chat-completions#gpt-41-series
 */
const gpt41 = new GPTModel('gpt-4.1').getModel();

/**
 * gpt 4.1 nano
 * https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/models?tabs=global-standard,standard-chat-completions#gpt-41-series
 */
const gpt41Nano = new GPTModel('gpt-4.1-nano').getModel();

export { gpt41, gpt41Nano };
