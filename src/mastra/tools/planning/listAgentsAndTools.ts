import { createTool } from '@mastra/core';
import { z } from 'zod';

/**
 * Lists all agents and the tools available to each one.
 * Useful for capability discovery before routing a request.
 */
const listAgentsAndTools = createTool({
  id: 'list-agents-and-tools',
  description:
    'List all agents and their respective tools available in the network for capability discovery.',
  outputSchema: z.array(
    z.object({
      agentId: z.string(),
      tools: z.array(
        z.object({
          id: z.string(),
          description: z.string(),
        })
      ),
    })
  ),
  execute: async ({ mastra }) => {
    const agents = Object.values(mastra?.getAgents() ?? {});

    return (
      agents.map(agent => {
        const tools = agent.getTools?.() ?? {};
        const toolEntries = Object.entries(tools).map(([toolId, tool]) => ({
          id: toolId,
          description: tool.description ?? '',
        }));

        return {
          agentId: agent.id,
          tools: toolEntries,
        };
      }) ?? []
    );
  },
});

export default listAgentsAndTools;
