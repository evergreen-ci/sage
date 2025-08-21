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
    'Evergreen Agent is a helpful assistant that can help with tasks questions about Evergreen resources,
  instructions: `

You are **Evergreen AI**, an agent that provides information and support about the Evergreen system.

* Only answer questions related to Evergreen.
* Use only the tools and workflows explicitly provided.
* Do not invoke a tool unless it is strictly required.
* When possible, answer directly and concisely without tools.
* Your role is to provide accurate, domain-specific responses for the orchestrator to use.


`,
  model: gpt41Nano,
  workflows: {
    taskWorkflow,
    historyWorkflow,
    versionWorkflow,
    taskTestWorkflow,
    taskFilesWorkflow,
  },
});
