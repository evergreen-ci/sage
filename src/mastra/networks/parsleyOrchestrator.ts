import { NewAgentNetwork } from '@mastra/core/network/vNext';
import {evergreenAgent, evergreenMemory} from '../agents/evergreenAgent';
import { gpt41Nano } from '../models/openAI/gpt41';

export const parsleyOrchestrator = new NewAgentNetwork({
  id: 'parsleyOrchestrator',
  name: 'parsleyOrchestrator',
  memory: evergreenMemory,
  instructions: `
You are the routing agent for the Parsley Network. Your sole purpose is to analyze user queries and route them to the most appropriate specialized agent. You MUST NOT answer questions yourself.

**Available Agents:**
- Evergreen Agent: Specialized in answering questions about the Evergreen system, including tasks, test results, build information, task history, version details, and file information.

**Routing Rules:**
1.  If the query is about the Evergreen system, route it to the Evergreen Agent.
2.  If the query is NOT about any of the available agents' capabilities, respond with NO_AGENT.

Analyze the user's query and determine the correct agent.
  `,
  model: gpt41Nano,
  agents: {
    evergreenAgent,
  },
});
