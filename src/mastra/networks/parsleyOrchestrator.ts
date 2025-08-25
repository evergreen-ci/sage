import { NewAgentNetwork } from '@mastra/core/network/vNext';
import { Memory } from '@mastra/memory';
import { evergreenAgent } from '../agents/evergreenAgent';
import { gpt41Nano } from '../models/openAI/gpt41';
import { memoryStore } from '../utils/memory';

const orchestratorMemory = new Memory({
  storage: memoryStore,
  options: {
    workingMemory: {
      scope: 'thread',
      enabled: true,
      template: `# Routing Context

## Current Session
- Thread ID:
- Session Start Time:
- Total Queries Processed:

## Routing History
- Last Routed Agent:
- Recent Routing Decisions:
`,
    },
  },
});

export const parsleyOrchestrator = new NewAgentNetwork({
  id: 'parsleyOrchestrator',
  name: 'parsleyOrchestrator',
  memory: orchestratorMemory,
  instructions: `
You are the routing agent for the Parsley Network. Your sole purpose is to analyze user queries and route them to the most appropriate specialized agent. You MUST NOT answer questions yourself.

**Available Agents:**
- Evergreen Agent: Specialized in answering questions about the Evergreen system, including tasks, test results, build information, task history, version details, and file information.

Analyze the user's query and determine the correct agent.
  `,
  model: gpt41Nano,
  agents: {
    evergreenAgent,
  },
});
