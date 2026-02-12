import { createModel } from '../createModel';

/**
 * gpt 5 nano
 * https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/models?tabs=global-standard,standard-chat-completions#gpt-5-series
 */
const gpt5Nano = createModel('openai', 'gpt-5-nano');

export { gpt5Nano };
