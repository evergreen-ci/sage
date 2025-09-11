import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { wrapTraced } from 'braintrust';
import { gpt41 } from '../models/openAI/gpt41';
import {
  getTaskTool,
  getTaskFilesTool,
  getTaskTestsTool,
} from '../tools/evergreen';
import { createToolFromAgent } from '../tools/utils';
import { memoryStore } from '../utils/memory';
import {
  getTaskHistoryWorkflow,
  getVersionWorkflow,
} from '../workflows/evergreen';

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
  name: 'evergreenAgent',
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
  model: gpt41,
  memory: evergreenAgentMemory,
  workflows: {
    getTaskHistoryWorkflow,
    getVersionWorkflow,
  },
  tools: {
    getTaskTool,
    getTaskFilesTool,
    getTaskTestsTool,
  },
});

// Temporary workaround: Bind the traced functions to the agent for observability and monitoring
// This wraps the streamVNext method with tracing capabilities to track streaming responses
// TODO: Remove when Mastra observability is fully supported
evergreenAgent.streamVNext = wrapTraced(
  evergreenAgent.streamVNext.bind(evergreenAgent),
  {
    name: 'evergreenAgent.streamVNext',
  }
);

// Temporary workaround: Bind the traced functions to the agent for observability and monitoring
// This wraps the generateVNext method with tracing capabilities to track generation calls
// TODO: Remove when Mastra observability is fully supported
evergreenAgent.generateVNext = wrapTraced(
  evergreenAgent.generateVNext.bind(evergreenAgent),
  {
    name: 'evergreenAgent.generateVNext',
  }
);

export const askEvergreenAgentTool = createToolFromAgent(
  evergreenAgent.id,
  evergreenAgent.getDescription()
);
