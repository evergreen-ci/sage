import { wrapLanguageModel } from 'ai';
import { BraintrustMiddleware } from 'braintrust';
import BaseModel from './baseModel';

/**
 * gpt 4.1
 * https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/models?tabs=global-standard,standard-chat-completions#gpt-41-series
 */
const gpt41 = wrapLanguageModel({
  model: new BaseModel('gpt-4.1').getModel(),
  middleware: [BraintrustMiddleware()],
});

/**
 * gpt 4.1 nano
 * https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/models?tabs=global-standard,standard-chat-completions#gpt-41-series
 */
const gpt41Nano = wrapLanguageModel({
  model: new BaseModel('gpt-4.1-nano').getModel(),
  middleware: [BraintrustMiddleware()],
});

export { gpt41, gpt41Nano };
