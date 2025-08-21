import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { gpt41Nano } from '../models/openAI/gpt41';
import { memoryStore } from '../utils/memory';
import {
  historyWorkflow,
  taskFilesWorkflow,
  taskTestWorkflow,
  taskWorkflow,
  versionWorkflow,
} from '../workflows';

export const evergreenMemory = new Memory({
  storage: memoryStore,
  options: {
    workingMemory: {
      // TODO: Memory is scoped to the thread, so we will only recall from the current chat window.
      scope: 'thread',
      enabled: true,
      // Define the template for the working memory
      // The working memory is like a notepad that the agent can use to remember information
      template: `
      # Task Information
      - Task ID: {{taskId}}
      - Execution: {{execution}}
      - Task Name: {{displayName}}
      - Task Status: {{displayStatus}}
      - Version: {{version}}
      - Build Variant: {{buildVariant}}
      - Patch Number: {{patchNumber}}
      - Details: {{details}}

      # Other interesting information
      - {{otherInformation}}
      `,
    },
  },
});

export const evergreenAgent: Agent = new Agent({
  name: 'Evergreen Agent',
  description:
    'Evergreen Agent is a helpful assistant that can help with tasks questions about Evergreen resources when embedded in the parsley log viewer',
  instructions: `
   You are Evergreen ai, a helpful assistant that can help with tasks and questions about Evergreen resources. You should only use the tools and workflows provided to you.
   You do not need to use a tool to answer a question. Only use a tool if you are sure that you need to.
`,
  model: gpt41Nano,
  memory: evergreenMemory,
  workflows: {
    taskWorkflow,
    historyWorkflow,
    versionWorkflow,
    taskTestWorkflow,
    taskFilesWorkflow,
  },
});
