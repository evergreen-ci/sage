import { createModel } from '../createModel';

/**
 * gpt 4.1
 * https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/models?tabs=global-standard,standard-chat-completions#gpt-41-series
 */
const gpt41 = createModel('openai', 'gpt-4.1');

/**
 * gpt 4.1 nano
 * https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/models?tabs=global-standard,standard-chat-completions#gpt-41-series
 */
const gpt41Nano = createModel('openai', 'gpt-4.1-nano');

export { gpt41, gpt41Nano };
