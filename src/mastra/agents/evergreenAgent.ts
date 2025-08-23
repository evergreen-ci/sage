import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { gpt41Nano } from '../models/openAI/gpt41';
import {
  getTaskTool,
  getTaskFilesTool,
  getTaskTestsTool,
} from '../tools/evergreen';
import { memoryStore } from '../utils/memory';
import { historyWorkflow, versionWorkflow } from '../workflows';

const evergreenAgentMemory = new Memory({
  storage: memoryStore,
  options: {
    workingMemory: {
      // TODO: Memory is scoped to the thread, so we will only recall from the current chat window.
      scope: 'thread',
      enabled: true,
      template: `# Evergreen Task Context

## Current Task
- Task ID:
- Task Name:
- Execution ID:
- Status:
- Build Variant:
- Version:
- Patch Number:
- Details:

## Task Details
- Test Results:
- Related Files:

## Analysis Notes
- Key Findings:
- Potential Issues:
`,
    },
  },
});

export const evergreenAgent: Agent = new Agent({
  name: 'Evergreen Agent',
  description:
    'Evergreen Agent is a helpful assistant that can help with tasks questions about Evergreen resources',
  instructions: `
You are **Evergreen AI**, an agent that provides information and support about the Evergreen system.

* Only answer questions related to Evergreen.
* Use only the tools and workflows explicitly provided.
* Do not invoke a tool unless it is strictly required.
* When possible, answer directly and concisely without tools.
* Your role is to provide accurate, domain-specific responses for the orchestrator to use.
`,
  model: gpt41Nano,
  memory: evergreenAgentMemory,
  workflows: {
    historyWorkflow,
    versionWorkflow,
  },
  tools: {
    getTaskTool,
    getTaskFilesTool,
    getTaskTestsTool,
  },
});
