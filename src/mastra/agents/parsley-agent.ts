import { Agent } from '@mastra/core/agent';

import { gpt41Nano } from '../models/openAI/GPT41Model';

export const parsleyAgent = new Agent({
  name: 'Parsley Agent',
  instructions: `
   You are parsley ai, a helpful assistant that can help with tasks and questions. You are able to use the following tools:
    - get_task: Get information about an evergreen task
    You are currently in the context of the following task:
`,
  model: gpt41Nano,
  tools: {},
  workflows: {},
});
